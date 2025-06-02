# Google Compute Engine Infrastructure for MCP Server Platform
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
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
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "instance_count" {
  description = "Number of VM instances"
  type        = number
  default     = 2
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "redis.googleapis.com",
    "cloudbuild.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "oslogin.googleapis.com"
  ])
  
  service = each.value
  disable_on_destroy = false
}

# VPC Network
resource "google_compute_network" "mcp_network" {
  name                    = "mcp-network-${var.environment}"
  auto_create_subnetworks = false
  depends_on             = [google_project_service.apis]
}

# Subnet
resource "google_compute_subnetwork" "mcp_subnet" {
  name          = "mcp-subnet-${var.environment}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.mcp_network.id
}

# Redis Instance for session storage and caching
resource "google_redis_instance" "mcp_redis" {
  name           = "mcp-redis-${var.environment}"
  tier           = "STANDARD_HA"
  memory_size_gb = 4
  region         = var.region
  
  authorized_network = google_compute_network.mcp_network.id
  
  redis_version     = "REDIS_7_0"
  display_name      = "MCP Server Redis Cache"
  
  # Performance optimizations
  redis_configs = {
    maxmemory-policy = "allkeys-lru"
    timeout          = "300"
    tcp-keepalive    = "60"
  }
  
  depends_on = [google_project_service.apis]
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "mcp-allow-internal-${var.environment}"
  network = google_compute_network.mcp_network.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  source_ranges = ["10.0.0.0/8"]
}

resource "google_compute_firewall" "allow_http_https" {
  name    = "mcp-allow-http-https-${var.environment}"
  network = google_compute_network.mcp_network.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080", "3000"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["mcp-server"]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "mcp-allow-ssh-${var.environment}"
  network = google_compute_network.mcp_network.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["mcp-server"]
}

# Service account for VM instances
resource "google_service_account" "mcp_vm" {
  account_id   = "mcp-vm-${var.environment}"
  display_name = "MCP Server VM Service Account"
}

# IAM bindings for VM service account
resource "google_project_iam_member" "mcp_vm_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/storage.objectViewer",
    "roles/artifactregistry.reader"
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.mcp_vm.email}"
}

# Instance template for MCP Server VMs
resource "google_compute_instance_template" "mcp_template" {
  name_prefix  = "mcp-template-${var.environment}-"
  machine_type = "e2-standard-4" # 4 vCPU, 16GB RAM - enough for multiple 5GB containers
  
  # Boot disk
  disk {
    source_image = "projects/cos-cloud/global/images/family/cos-stable"
    auto_delete  = true
    boot         = true
    disk_size_gb = 100
    disk_type    = "pd-ssd"
  }

  # Network interface
  network_interface {
    network    = google_compute_network.mcp_network.id
    subnetwork = google_compute_subnetwork.mcp_subnet.id
    
    # External IP for internet access
    access_config {
      network_tier = "PREMIUM"
    }
  }

  # Service account
  service_account {
    email  = google_service_account.mcp_vm.email
    scopes = ["cloud-platform"]
  }

  # Metadata and startup script
  metadata = {
    enable-oslogin = "TRUE"
    startup-script = templatefile("${path.module}/startup-script.sh", {
      redis_host = google_redis_instance.mcp_redis.host
      redis_port = google_redis_instance.mcp_redis.port
      project_id = var.project_id
      environment = var.environment
    })
  }

  # Tags
  tags = ["mcp-server", "http-server", "https-server"]

  # Lifecycle
  lifecycle {
    create_before_destroy = true
  }

  depends_on = [google_project_service.apis]
}

# Health check for load balancer
resource "google_compute_health_check" "mcp_health_check" {
  name = "mcp-health-check-${var.environment}"

  timeout_sec        = 5
  check_interval_sec = 10
  healthy_threshold  = 2
  unhealthy_threshold = 3

  http_health_check {
    port         = 3000
    request_path = "/health"
  }
}

# Instance group manager
resource "google_compute_region_instance_group_manager" "mcp_group" {
  name   = "mcp-group-${var.environment}"
  region = var.region

  base_instance_name = "mcp-instance-${var.environment}"
  target_size        = var.instance_count

  version {
    instance_template = google_compute_instance_template.mcp_template.id
  }

  # Auto healing
  auto_healing_policies {
    health_check      = google_compute_health_check.mcp_health_check.id
    initial_delay_sec = 300
  }

  # Update policy
  update_policy {
    type                         = "PROACTIVE"
    instance_redistribution_type = "PROACTIVE"
    minimal_action               = "REPLACE"
    max_surge_fixed              = 1
    max_unavailable_fixed        = 0
  }

  # Named ports for load balancer
  named_port {
    name = "http"
    port = 3000
  }
}

# Autoscaler
resource "google_compute_region_autoscaler" "mcp_autoscaler" {
  name   = "mcp-autoscaler-${var.environment}"
  region = var.region
  target = google_compute_region_instance_group_manager.mcp_group.id

  autoscaling_policy {
    max_replicas    = 10
    min_replicas    = 2
    cooldown_period = 300

    cpu_utilization {
      target = 0.7
    }

    metric {
      name   = "compute.googleapis.com/instance/memory/utilization"
      target = 0.8
      type   = "GAUGE"
    }
  }
}

# Load balancer backend service
resource "google_compute_backend_service" "mcp_backend" {
  name        = "mcp-backend-${var.environment}"
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group           = google_compute_region_instance_group_manager.mcp_group.instance_group
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }

  health_checks = [google_compute_health_check.mcp_health_check.id]

  # Connection draining
  connection_draining_timeout_sec = 300

  # Load balancing scheme
  load_balancing_scheme = "EXTERNAL"
}

# URL map
resource "google_compute_url_map" "mcp_url_map" {
  name            = "mcp-url-map-${var.environment}"
  default_service = google_compute_backend_service.mcp_backend.id
}

# HTTP(S) proxy
resource "google_compute_target_http_proxy" "mcp_http_proxy" {
  name    = "mcp-http-proxy-${var.environment}"
  url_map = google_compute_url_map.mcp_url_map.id
}

# Global forwarding rule
resource "google_compute_global_forwarding_rule" "mcp_forwarding_rule" {
  name       = "mcp-forwarding-rule-${var.environment}"
  target     = google_compute_target_http_proxy.mcp_http_proxy.id
  port_range = "80"
}

# Cloud Storage bucket for container images and artifacts
resource "google_storage_bucket" "mcp_artifacts" {
  name     = "${var.project_id}-mcp-artifacts-${var.environment}"
  location = var.region
  
  # Lifecycle management
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
  
  # Versioning
  versioning {
    enabled = true
  }
  
  # Uniform bucket-level access
  uniform_bucket_level_access = true
}

# Monitoring and alerting
resource "google_monitoring_notification_channel" "email" {
  display_name = "MCP Server Email Alerts"
  type         = "email"
  
  labels = {
    email_address = "admin@example.com" # Replace with actual email
  }
}

resource "google_monitoring_alert_policy" "high_cpu" {
  display_name = "MCP Server High CPU Usage"
  combiner     = "OR"
  
  conditions {
    display_name = "CPU usage above 80%"
    
    condition_threshold {
      filter          = "resource.type=\"gce_instance\" AND resource.labels.instance_name=~\"mcp-instance-.*\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0.8
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  
  notification_channels = [google_monitoring_notification_channel.email.name]
  
  alert_strategy {
    auto_close = "1800s"
  }
}

resource "google_monitoring_alert_policy" "high_memory" {
  display_name = "MCP Server High Memory Usage"
  combiner     = "OR"
  
  conditions {
    display_name = "Memory usage above 85%"
    
    condition_threshold {
      filter          = "resource.type=\"gce_instance\" AND resource.labels.instance_name=~\"mcp-instance-.*\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0.85
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  
  notification_channels = [google_monitoring_notification_channel.email.name]
}

# Outputs
output "redis_host" {
  description = "Redis instance host"
  value       = google_redis_instance.mcp_redis.host
}

output "redis_port" {
  description = "Redis instance port"
  value       = google_redis_instance.mcp_redis.port
}

output "load_balancer_ip" {
  description = "Load balancer external IP"
  value       = google_compute_global_forwarding_rule.mcp_forwarding_rule.ip_address
}

output "storage_bucket" {
  description = "Storage bucket for artifacts"
  value       = google_storage_bucket.mcp_artifacts.name
}

output "instance_group" {
  description = "Instance group manager"
  value       = google_compute_region_instance_group_manager.mcp_group.instance_group
}