#!/bin/bash

# Setup script for Google Cloud credentials
# This script helps securely configure credentials for deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if service account file exists
if [ ! -f "service-account.json" ]; then
    error "service-account.json not found!"
    echo ""
    echo "Please create the service-account.json file with your Google Cloud credentials:"
    echo "1. Go to Google Cloud Console"
    echo "2. Navigate to IAM & Admin > Service Accounts"
    echo "3. Create or select a service account"
    echo "4. Create a new key (JSON format)"
    echo "5. Save it as 'service-account.json' in this directory"
    echo ""
    echo "Required permissions for the service account:"
    echo "- Compute Engine Admin"
    echo "- Cloud Build Editor"
    echo "- Storage Admin"
    echo "- Redis Admin"
    echo "- Monitoring Admin"
    echo "- Logging Admin"
    exit 1
fi

# Validate the service account file
log "Validating service account credentials..."
if ! jq -e '.type == "service_account"' service-account.json > /dev/null 2>&1; then
    error "Invalid service account file format"
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' service-account.json)
CLIENT_EMAIL=$(jq -r '.client_email' service-account.json)

if [ "$PROJECT_ID" = "null" ] || [ "$CLIENT_EMAIL" = "null" ]; then
    error "Invalid service account file - missing project_id or client_email"
    exit 1
fi

success "Service account validated:"
success "  Project ID: $PROJECT_ID"
success "  Service Account: $CLIENT_EMAIL"

# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json"
export PROJECT_ID="$PROJECT_ID"

log "Setting up Google Cloud authentication..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    warning "Google Cloud SDK not found. Installing..."
    
    # Install Google Cloud SDK
    curl https://sdk.cloud.google.com | bash
    source ~/.bashrc
    
    if ! command -v gcloud &> /dev/null; then
        error "Failed to install Google Cloud SDK"
        exit 1
    fi
fi

# Authenticate with service account
gcloud auth activate-service-account --key-file=service-account.json

# Set project
gcloud config set project "$PROJECT_ID"

# Enable required APIs
log "Enabling required Google Cloud APIs..."
gcloud services enable compute.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable storage.googleapis.com

success "Google Cloud setup completed!"
success "You can now run the deployment script:"
success "  ./deploy.sh --project $PROJECT_ID --email your-email@domain.com"