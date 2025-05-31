#!/bin/bash

# Build and deploy MCP Server to GCP
set -e

PROJECT_ID="capable-acrobat-460705-t1"
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/mcp-server"

echo "Starting MCP Server deployment to GCP..."

# Ensure we're authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "Not authenticated with gcloud. Running authentication..."
    ./scripts/install-gcloud.sh
fi

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    redis.googleapis.com \
    compute.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iam.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    storage-api.googleapis.com \
    storage-component.googleapis.com \
    vpcaccess.googleapis.com

# Create Artifact Registry repository
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create mcp-server \
    --repository-format=docker \
    --location=${REGION} \
    --description="MCP Server container registry" || true

# Build and push base container images
echo "Building base container images..."

# Build language-specific containers
LANGUAGES=("python" "javascript" "typescript" "java" "c" "cpp" "csharp" "rust" "go" "php" "perl" "ruby" "lua" "swift" "objc")

for lang in "${LANGUAGES[@]}"; do
    echo "Building ${lang} container..."
    docker build -f containers/languages/Dockerfile.${lang} -t ${REGISTRY}/mcp-${lang}:latest containers/languages/
    docker push ${REGISTRY}/mcp-${lang}:latest
done

# Build VS Code container
echo "Building VS Code container..."
docker build -f containers/vscode/Dockerfile -t ${REGISTRY}/mcp-vscode:latest containers/vscode/
docker push ${REGISTRY}/mcp-vscode:latest

# Build Playwright container
echo "Building Playwright container..."
docker build -f containers/playwright/Dockerfile -t ${REGISTRY}/mcp-playwright:latest containers/playwright/
docker push ${REGISTRY}/mcp-playwright:latest

# Build main MCP server
echo "Building MCP Server..."
docker build -t ${REGISTRY}/mcp-server:latest .
docker push ${REGISTRY}/mcp-server:latest

# Build frontend
echo "Building Frontend..."
docker build -f frontend/Dockerfile -t ${REGISTRY}/mcp-frontend:latest frontend/
docker push ${REGISTRY}/mcp-frontend:latest

# Deploy infrastructure with Terraform
echo "Deploying infrastructure with Terraform..."
cd infrastructure

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply deployment
terraform apply -auto-approve

# Get deployment URLs
echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo "MCP Server URL: $(terraform output -raw mcp_server_url)"
echo "Frontend URL: $(terraform output -raw frontend_url)"
echo "Redis Host: $(terraform output -raw redis_host)"
echo "Artifact Registry: $(terraform output -raw artifact_registry_url)"
echo ""
echo "Your MCP Server is now live and ready for LLM connections!"
