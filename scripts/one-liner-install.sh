#!/bin/bash
set -e

# Enhanced MCP Server - One-Liner Installation
# Usage: curl -fsSL https://raw.githubusercontent.com/Create-fun-work/Opendoor/main/scripts/one-liner-install.sh | bash

echo "🚀 Enhanced MCP Server - One-Liner Installation"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ All dependencies satisfied${NC}"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo -e "${BLUE}📥 Downloading configuration files...${NC}"

# Download docker-compose file
curl -fsSL -o docker-compose.production.yml \
    "https://raw.githubusercontent.com/Create-fun-work/Opendoor/main/docker-compose.production.yml"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to download configuration files${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration downloaded${NC}"

# Pull images
echo -e "${BLUE}📦 Pulling Docker images...${NC}"
docker-compose -f docker-compose.production.yml pull

# Start services
echo -e "${BLUE}🚀 Starting MCP Server...${NC}"
docker-compose -f docker-compose.production.yml up -d

# Wait for services
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 15

# Health check
echo -e "${BLUE}🔍 Checking service health...${NC}"
for i in {1..12}; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MCP Server is healthy and ready!${NC}"
        break
    else
        if [ $i -eq 12 ]; then
            echo -e "${YELLOW}⚠️  Health check timeout, but services may still be starting...${NC}"
        else
            echo -e "${YELLOW}⏳ Waiting for health check... (${i}/12)${NC}"
            sleep 5
        fi
    fi
done

# Copy compose file to home directory for easy management
cp docker-compose.production.yml "$HOME/mcp-server-compose.yml"

# Cleanup
cd "$HOME"
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}🎉 Enhanced MCP Server Installation Complete!${NC}"
echo ""
echo -e "${BLUE}📡 Your MCP server is running at:${NC}"
echo "• Server:         http://localhost:3000"
echo "• Health Check:   http://localhost:3000/health" 
echo "• Configuration:  http://localhost:3000/config"
echo "• Frontend:       http://localhost:8080"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "• View logs:      docker-compose -f ~/mcp-server-compose.yml logs -f"
echo "• Stop server:    docker-compose -f ~/mcp-server-compose.yml down"
echo "• Restart:        docker-compose -f ~/mcp-server-compose.yml restart"
echo "• Update:         docker-compose -f ~/mcp-server-compose.yml pull && docker-compose -f ~/mcp-server-compose.yml up -d"
echo ""
echo -e "${YELLOW}🤖 For LLM Integration:${NC}"
echo "1. Visit http://localhost:8080"
echo "2. Copy the MCP configuration JSON"
echo "3. Add it to your LLM client (Claude Desktop, etc.)"
echo ""
echo -e "${GREEN}Your MCP server is ready for LLM connections! 🚀${NC}"
