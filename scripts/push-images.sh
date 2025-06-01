#!/bin/bash
set -e

echo "🚀 Pushing MCP Server Docker Images..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="ghcr.io/create-fun-work/opendoor"
VERSION=${1:-"latest"}

# Check if user is logged in to registry
echo -e "${YELLOW}Checking registry authentication...${NC}"
if ! docker info | grep -q "Registry: https://ghcr.io"; then
    echo -e "${YELLOW}Please login to GitHub Container Registry:${NC}"
    echo "docker login ghcr.io -u YOUR_GITHUB_USERNAME"
    exit 1
fi

echo -e "${BLUE}Pushing to registry: ${REGISTRY}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo ""

# List of images to push
IMAGES=(
    "mcp-server"
    "mcp-python"
    "mcp-node"
    "mcp-vscode"
    "mcp-playwright"
)

# Push each image
for image in "${IMAGES[@]}"; do
    echo -e "${YELLOW}Pushing ${image}...${NC}"
    docker push "${REGISTRY}/${image}:${VERSION}"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${image} pushed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to push ${image}${NC}"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}🎉 All images pushed successfully!${NC}"
echo ""
echo -e "${BLUE}Available for pull:${NC}"
for image in "${IMAGES[@]}"; do
    echo "docker pull ${REGISTRY}/${image}:${VERSION}"
done
echo ""
echo -e "${YELLOW}To start the full stack:${NC}"
echo "docker-compose -f docker-compose.production.yml up -d"
