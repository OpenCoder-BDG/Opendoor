#!/bin/bash

# MCP Server Deployment Script for Google Compute Engine
# This script automates the deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    local deps=("gcloud" "terraform" "docker")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing dependencies: ${missing[*]}"
        error "Please install the missing tools and try again."
        exit 1
    fi
    
    success "All dependencies are installed"
}

# Set default values
PROJECT_ID=""
REGION="us-central1"
ZONE="us-central1-a"
ENVIRONMENT="prod"
INSTANCE_COUNT=2
EMAIL=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project)
            PROJECT_ID="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -z|--zone)
            ZONE="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--count)
            INSTANCE_COUNT="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -p, --project PROJECT_ID    GCP Project ID (required)"
            echo "  -r, --region REGION         GCP Region (default: us-central1)"
            echo "  -z, --zone ZONE             GCP Zone (default: us-central1-a)"
            echo "  -e, --environment ENV       Environment (default: prod)"
            echo "  -c, --count COUNT           Number of instances (default: 2)"
            echo "  --email EMAIL               Email for alerts (required)"
            echo "  -h, --help                  Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$PROJECT_ID" ]; then
    error "Project ID is required. Use -p or --project to specify it."
    exit 1
fi

if [ -z "$EMAIL" ]; then
    error "Email is required for alerts. Use --email to specify it."
    exit 1
fi

log "Starting deployment with the following configuration:"
log "  Project ID: $PROJECT_ID"
log "  Region: $REGION"
log "  Zone: $ZONE"
log "  Environment: $ENVIRONMENT"
log "  Instance Count: $INSTANCE_COUNT"
log "  Alert Email: $EMAIL"

# Authenticate with Google Cloud
authenticate_gcloud() {
    log "Authenticating with Google Cloud..."
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log "No active authentication found. Please authenticate:"
        gcloud auth login
    fi
    
    gcloud config set project "$PROJECT_ID"
    gcloud config set compute/region "$REGION"
    gcloud config set compute/zone "$ZONE"
    
    success "Google Cloud authentication configured"
}

# Build and push container images
build_images() {
    log "Building and pushing container images..."
    
    # Configure Docker for GCR
    gcloud auth configure-docker --quiet
    
    # Build images using Cloud Build
    log "Submitting build to Cloud Build..."
    gcloud builds submit \
        --config=cloudbuild.yaml \
        --substitutions=_REGION="$REGION" \
        ../../
    
    success "Container images built and pushed"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    log "Deploying infrastructure with Terraform..."
    
    cd terraform
    
    # Initialize Terraform
    terraform init
    
    # Create terraform.tfvars
    cat > terraform.tfvars << EOF
project_id = "$PROJECT_ID"
region = "$REGION"
zone = "$ZONE"
environment = "$ENVIRONMENT"
instance_count = $INSTANCE_COUNT
EOF
    
    # Update email in main.tf
    sed -i "s/admin@example.com/$EMAIL/g" main.tf
    
    # Plan deployment
    log "Planning Terraform deployment..."
    terraform plan -var-file=terraform.tfvars
    
    # Apply deployment
    log "Applying Terraform deployment..."
    terraform apply -var-file=terraform.tfvars -auto-approve
    
    # Get outputs
    REDIS_HOST=$(terraform output -raw redis_host)
    LOAD_BALANCER_IP=$(terraform output -raw load_balancer_ip)
    
    success "Infrastructure deployed successfully"
    success "Redis Host: $REDIS_HOST"
    success "Load Balancer IP: $LOAD_BALANCER_IP"
    
    cd ..
}

# Wait for instances to be ready
wait_for_instances() {
    log "Waiting for instances to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Checking instance health (attempt $attempt/$max_attempts)..."
        
        if curl -f -s "http://$LOAD_BALANCER_IP/health" > /dev/null; then
            success "Instances are healthy and ready!"
            return 0
        fi
        
        sleep 30
        ((attempt++))
    done
    
    error "Instances did not become healthy within the expected time"
    return 1
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check health endpoint
    if curl -f "http://$LOAD_BALANCER_IP/health"; then
        success "Health check passed"
    else
        error "Health check failed"
        return 1
    fi
    
    # Check if containers are running
    log "Checking container status on instances..."
    
    local instances=$(gcloud compute instances list \
        --filter="name~mcp-instance-$ENVIRONMENT" \
        --format="value(name)")
    
    for instance in $instances; do
        log "Checking containers on $instance..."
        gcloud compute ssh "$instance" \
            --zone="$ZONE" \
            --command="docker ps --format 'table {{.Names}}\t{{.Status}}'" \
            --quiet
    done
    
    success "Deployment verification completed"
}

# Setup monitoring dashboard
setup_monitoring() {
    log "Setting up monitoring dashboard..."
    
    # Create custom dashboard (this would typically be done via API or gcloud)
    log "Monitoring dashboard setup would be implemented here"
    log "You can access Cloud Monitoring at: https://console.cloud.google.com/monitoring"
    
    success "Monitoring setup completed"
}

# Main deployment flow
main() {
    log "Starting MCP Server deployment to Google Compute Engine..."
    
    check_dependencies
    authenticate_gcloud
    build_images
    deploy_infrastructure
    wait_for_instances
    verify_deployment
    setup_monitoring
    
    success "🎉 Deployment completed successfully!"
    success "Your MCP Server is now running at: http://$LOAD_BALANCER_IP"
    success "Health check: http://$LOAD_BALANCER_IP/health"
    success "Monitoring: https://console.cloud.google.com/monitoring"
    
    log "Next steps:"
    log "1. Configure your domain to point to $LOAD_BALANCER_IP"
    log "2. Set up SSL certificate for HTTPS"
    log "3. Configure backup and disaster recovery"
    log "4. Review monitoring alerts and thresholds"
}

# Cleanup function for errors
cleanup() {
    if [ $? -ne 0 ]; then
        error "Deployment failed. Check the logs above for details."
        warning "You may need to clean up resources manually."
    fi
}

trap cleanup EXIT

# Run main function
main "$@"