#!/bin/bash

# Complete deployment script for Opendoor MCP to GCP
set -e

echo "🚀 Starting Opendoor MCP deployment to GCP..."

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "Installing Google Cloud CLI..."
    ./scripts/install-gcloud.sh
fi

# Authenticate and set project
echo "🔐 Authenticating with GCP..."
gcloud auth activate-service-account --key-file=infrastructure/gcp-credentials.json
gcloud config set project capable-acrobat-460705-t1

# Build and push containers
echo "🐳 Building and pushing containers..."
./scripts/setup-containers.sh

# Build main application containers
PROJECT_ID="capable-acrobat-460705-t1"
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/mcp-server"

echo "🏗️ Building Opendoor MCP server..."
docker build -t ${REGISTRY}/mcp-server:latest .
docker push ${REGISTRY}/mcp-server:latest

echo "🌐 Building Opendoor MCP documentation frontend..."
docker build -f frontend/Dockerfile -t ${REGISTRY}/mcp-frontend:latest frontend/
docker push ${REGISTRY}/mcp-frontend:latest

# Deploy infrastructure
echo "☁️ Deploying infrastructure with Terraform..."
cd infrastructure

# Initialize Terraform if not already done
if [ ! -d ".terraform" ]; then
    terraform init
fi

# Plan and apply
terraform plan -out=tfplan
terraform apply tfplan

# Get outputs
MCP_SERVER_URL=$(terraform output -raw mcp_server_url)
FRONTEND_URL=$(terraform output -raw frontend_url)

cd ..

echo ""
echo "🎉 Deployment completed successfully!"
echo "=================================="
echo "🔗 Opendoor MCP Server URL: ${MCP_SERVER_URL}"
echo "🌐 Documentation Frontend URL: ${FRONTEND_URL}"
echo "📋 LLM Configuration: ${FRONTEND_URL}/config"
echo ""
echo "✅ Your Opendoor MCP platform is now live!"
echo "💡 Visit the documentation frontend to get JSON configuration for LLM connections"
echo ""
echo "🔧 Available endpoints:"
echo "   • SSE: wss://${MCP_SERVER_URL#https://}/mcp/sse"
echo "   • STDIO: ${MCP_SERVER_URL}/mcp/stdio"
echo "   • Health: ${MCP_SERVER_URL}/health"
echo "   • Sessions: ${MCP_SERVER_URL}/sessions"
echo ""
echo "🎯 Features enabled:"
echo "   • 15 programming languages with 5GB memory each"
echo "   • VS Code web IDE integration"
echo "   • Playwright browser automation"
echo "   • Complete container isolation"
echo "   • Production-ready scaling"
