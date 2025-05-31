#!/bin/bash

# Build all container images for the MCP platform
set -e

echo "Building MCP Platform containers..."

PROJECT_ID="capable-acrobat-460705-t1"
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/mcp-server"

# Ensure we're authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "Not authenticated with gcloud. Please run ./scripts/install-gcloud.sh first"
    exit 1
fi

# Build base image first
echo "Building base image..."
docker build -f containers/base/Dockerfile.base -t mcp-base:latest containers/base/

# Build language-specific containers
echo "Building language containers..."

# Python
docker build -f containers/languages/Dockerfile.python -t ${REGISTRY}/mcp-python:latest containers/languages/
docker push ${REGISTRY}/mcp-python:latest

# JavaScript
docker build -f containers/languages/Dockerfile.javascript -t ${REGISTRY}/mcp-javascript:latest containers/languages/
docker push ${REGISTRY}/mcp-javascript:latest

# TypeScript  
docker build -f containers/languages/Dockerfile.typescript -t ${REGISTRY}/mcp-typescript:latest containers/languages/
docker push ${REGISTRY}/mcp-typescript:latest

# Java
docker build -f containers/languages/Dockerfile.java -t ${REGISTRY}/mcp-java:latest containers/languages/
docker push ${REGISTRY}/mcp-java:latest

# Rust
docker build -f containers/languages/Dockerfile.rust -t ${REGISTRY}/mcp-rust:latest containers/languages/
docker push ${REGISTRY}/mcp-rust:latest

# Go
docker build -f containers/languages/Dockerfile.go -t ${REGISTRY}/mcp-go:latest containers/languages/
docker push ${REGISTRY}/mcp-go:latest

# Build additional language containers (C, C++, C#, PHP, Perl, Ruby, Lua, Swift, Objective-C)
for lang in c cpp csharp php perl ruby lua swift objc; do
    if [ -f "containers/languages/Dockerfile.${lang}" ]; then
        echo "Building ${lang} container..."
        docker build -f containers/languages/Dockerfile.${lang} -t ${REGISTRY}/mcp-${lang}:latest containers/languages/
        docker push ${REGISTRY}/mcp-${lang}:latest
    fi
done

# Build VS Code container
echo "Building VS Code container..."
docker build -f containers/vscode/Dockerfile -t ${REGISTRY}/mcp-vscode:latest containers/vscode/
docker push ${REGISTRY}/mcp-vscode:latest

# Build Playwright container
echo "Building Playwright container..."
docker build -f containers/playwright/Dockerfile -t ${REGISTRY}/mcp-playwright:latest containers/playwright/
docker push ${REGISTRY}/mcp-playwright:latest

echo "All containers built and pushed successfully!"
