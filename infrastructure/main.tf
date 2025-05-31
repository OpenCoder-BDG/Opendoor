terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# Configure the Google Cloud Provider
provider "google" {
  credentials = file("gcp-credentials.json")
  project     = var.project_id
  region      = var.region
  zone        = var.zone
}

provider "google-beta" {
  credentials = file("gcp-credentials.json")
  project     = var.project_id
  region      = var.region
  zone        = var.zone
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "capable-acrobat-460705-t1"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP Zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "redis.googleapis.com",
    "compute.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "storage-api.googleapis.com",
    "storage-component.googleapis.com"
  ])

  project = var.project_id
  service = each.value

  disable_dependent_services = true
}

# Artifact Registry for container images
resource "google_artifact_registry_repository" "mcp_registry" {
  location      = var.region
  repository_id = "mcp-server"
  description   = "MCP Server container registry"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}

# VPC Network
resource "google_compute_network" "mcp_network" {
  name                    = "mcp-network"
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"

  depends_on = [google_project_service.required_apis]
}

# Subnet
resource "google_compute_subnetwork" "mcp_subnet" {
  name          = "mcp-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.mcp_network.id

  secondary_ip_range {
    range_name    = "services-range"
    ip_cidr_range = "10.1.0.0/24"
  }

  secondary_ip_range {
    range_name    = "pod-ranges"
    ip_cidr_range = "10.2.0.0/24"
  }
}

# Cloud NAT for outbound internet access
resource "google_compute_router" "mcp_router" {
  name    = "mcp-router"
  region  = var.region
  network = google_compute_network.mcp_network.id
}

resource "google_compute_router_nat" "mcp_nat" {
  name                               = "mcp-nat"
  router                            = google_compute_router.mcp_router.name
  region                            = var.region
  nat_ip_allocate_option            = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Memorystore Redis instance
resource "google_redis_instance" "mcp_redis" {
  name           = "mcp-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 1
  region         = var.region

  location_id             = var.zone
  alternative_location_id = "${substr(var.region, 0, length(var.region)-1)}b"

  authorized_network = google_compute_network.mcp_network.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version     = "REDIS_7_0"
  display_name      = "MCP Redis Instance"
  reserved_ip_range = "10.3.0.0/29"

  depends_on = [google_project_service.required_apis]
}

# Cloud Run service for MCP Server
resource "google_cloud_run_v2_service" "mcp_server" {
  name     = "mcp-server"
  location = var.region

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }

    vpc_access {
      connector = google_vpc_access_connector.mcp_connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/mcp-server/mcp-server:latest"

      ports {
        name           = "http1"
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.mcp_redis.host}:6379"
      }

      env {
        name  = "BASE_URL"
        value = "https://mcp-server-${random_id.service_suffix.hex}-uc.a.run.app"
      }

      env {
        name  = "SSE_URL"
        value = "wss://mcp-server-${random_id.service_suffix.hex}-uc.a.run.app/mcp/sse"
      }

      env {
        name  = "STDIO_URL"
        value = "https://mcp-server-${random_id.service_suffix.hex}-uc.a.run.app/mcp/stdio"
      }

      env {
        name  = "DOCKER_HOST"
        value = "unix:///var/run/docker.sock"
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "4Gi"
        }
        cpu_idle = true
        startup_cpu_boost = true
      }

    }

    service_account = google_service_account.mcp_service_account.email

    annotations = {
      "autoscaling.knative.dev/minScale" = "1"
      "autoscaling.knative.dev/maxScale" = "10"
      "run.googleapis.com/cpu-throttling" = "false"
      "run.googleapis.com/execution-environment" = "gen2"
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  depends_on = [
    google_project_service.required_apis,
    google_artifact_registry_repository.mcp_registry,
    google_redis_instance.mcp_redis
  ]
}

# VPC Connector for Cloud Run to access VPC resources
resource "google_vpc_access_connector" "mcp_connector" {
  name          = "mcp-connector"
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.mcp_network.name
  region        = var.region

  min_instances = 2
  max_instances = 3

  depends_on = [google_project_service.required_apis]
}

# Service Account for MCP Server
resource "google_service_account" "mcp_service_account" {
  account_id   = "mcp-server-sa"
  display_name = "MCP Server Service Account"
  description  = "Service account for MCP Server Cloud Run service"
}

# IAM bindings for service account
resource "google_project_iam_member" "mcp_service_account_bindings" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/redis.editor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudtrace.agent",
    "roles/artifactregistry.reader"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.mcp_service_account.email}"
}

# Allow unauthenticated access to Cloud Run service
resource "google_cloud_run_service_iam_member" "noauth" {
  location = google_cloud_run_v2_service.mcp_server.location
  project  = google_cloud_run_v2_service.mcp_server.project
  service  = google_cloud_run_v2_service.mcp_server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Random suffix for unique service names
resource "random_id" "service_suffix" {
  byte_length = 4
}

# Cloud Run service for Frontend
resource "google_cloud_run_v2_service" "mcp_frontend" {
  name     = "mcp-frontend"
  location = var.region

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/mcp-server/mcp-frontend:latest"

      ports {
        name           = "http1"
        container_port = 80
      }

      env {
        name  = "REACT_APP_MCP_SERVER_URL"
        value = google_cloud_run_v2_service.mcp_server.uri
      }

      env {
        name  = "REACT_APP_SITE_NAME"
        value = "Opendoor MCP"
      }

      env {
        name  = "REACT_APP_SITE_DESCRIPTION"
        value = "LLM-Exclusive Multi-Container Platform"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
        cpu_idle = true
      }
    }

    service_account = google_service_account.mcp_service_account.email
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  depends_on = [
    google_project_service.required_apis,
    google_cloud_run_v2_service.mcp_server
  ]
}

# Allow unauthenticated access to Frontend
resource "google_cloud_run_service_iam_member" "frontend_noauth" {
  location = google_cloud_run_v2_service.mcp_frontend.location
  project  = google_cloud_run_v2_service.mcp_frontend.project
  service  = google_cloud_run_v2_service.mcp_frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "mcp_server_url" {
  value = google_cloud_run_v2_service.mcp_server.uri
  description = "URL of the MCP Server"
}

output "frontend_url" {
  value = google_cloud_run_v2_service.mcp_frontend.uri
  description = "URL of the Frontend"
}

output "redis_host" {
  value = google_redis_instance.mcp_redis.host
  description = "Redis instance host"
}

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/mcp-server"
  description = "Artifact Registry URL"
}
