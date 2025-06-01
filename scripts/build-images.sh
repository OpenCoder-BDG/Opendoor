#!/bin/bash
set -e

echo "🐳 Building MCP Server Docker Images..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="ghcr.io/create-fun-work/opendoor"
VERSION=${1:-"latest"}

echo -e "${BLUE}Registry: ${REGISTRY}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo ""

# Build main MCP server
echo -e "${YELLOW}Building MCP Server...${NC}"
docker build -t "${REGISTRY}/mcp-server:${VERSION}" .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ MCP Server built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build MCP Server${NC}"
    exit 1
fi

# Build language containers
echo -e "${YELLOW}Building Python container...${NC}"
docker build -f containers/languages/Dockerfile.python -t "${REGISTRY}/mcp-python:${VERSION}" containers/languages/
echo -e "${GREEN}✅ Python container built${NC}"

echo -e "${YELLOW}Building Node.js container...${NC}"
docker build -f containers/languages/Dockerfile.node -t "${REGISTRY}/mcp-node:${VERSION}" containers/languages/
echo -e "${GREEN}✅ Node.js container built${NC}"

# Build VS Code container
echo -e "${YELLOW}Building VS Code container...${NC}"
docker build -f containers/vscode/Dockerfile -t "${REGISTRY}/mcp-vscode:${VERSION}" containers/vscode/
echo -e "${GREEN}✅ VS Code container built${NC}"

# Build Playwright container
echo -e "${YELLOW}Building Playwright container...${NC}"
docker build -f containers/playwright/Dockerfile -t "${REGISTRY}/mcp-playwright:${VERSION}" containers/playwright/
echo -e "${GREEN}✅ Playwright container built${NC}"

echo ""
echo -e "${GREEN}🎉 All images built successfully!${NC}"
echo ""
echo -e "${BLUE}Built images:${NC}"
echo "- ${REGISTRY}/mcp-server:${VERSION}"
echo "- ${REGISTRY}/mcp-python:${VERSION}"
echo "- ${REGISTRY}/mcp-node:${VERSION}"
echo "- ${REGISTRY}/mcp-vscode:${VERSION}"
echo "- ${REGISTRY}/mcp-playwright:${VERSION}"
echo ""
echo -e "${YELLOW}To push to registry:${NC}"
echo "./scripts/push-images.sh ${VERSION}"
