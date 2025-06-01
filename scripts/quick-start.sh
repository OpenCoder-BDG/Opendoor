#!/bin/bash
set -e

echo "🚀 Quick Start - Enhanced MCP Server"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose and try again.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Pulling latest MCP Server images...${NC}"
docker-compose -f docker-compose.production.yml pull

echo -e "${BLUE}🚀 Starting MCP Server stack...${NC}"
docker-compose -f docker-compose.production.yml up -d

echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Check if services are healthy
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Check Redis
if docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Redis health check pending...${NC}"
fi

# Check MCP Server
for i in {1..10}; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MCP Server is healthy${NC}"
        break
    else
        if [ $i -eq 10 ]; then
            echo -e "${RED}❌ MCP Server health check failed${NC}"
        else
            echo -e "${YELLOW}⏳ Waiting for MCP Server... (${i}/10)${NC}"
            sleep 3
        fi
    fi
done

echo ""
echo -e "${GREEN}🎉 MCP Server is running!${NC}"
echo ""
echo -e "${BLUE}📡 Access Points:${NC}"
echo "• MCP Server:     http://localhost:3000"
echo "• Health Check:   http://localhost:3000/health"
echo "• Configuration:  http://localhost:3000/config"
echo "• Frontend:       http://localhost:8080"
echo "• Redis:          localhost:6379"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "• View logs:      docker-compose -f docker-compose.production.yml logs -f"
echo "• Stop services:  docker-compose -f docker-compose.production.yml down"
echo "• Restart:        docker-compose -f docker-compose.production.yml restart"
echo ""
echo -e "${YELLOW}🤖 For LLM Integration:${NC}"
echo "Visit http://localhost:8080 to copy the MCP configuration JSON"
echo ""
echo -e "${GREEN}Ready for LLM connections! 🚀${NC}"
