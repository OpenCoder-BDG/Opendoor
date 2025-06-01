#!/bin/bash
set -e

echo "🐳 One-Docker MCP Server Startup"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${BLUE}🏗️  Building all-in-one MCP server container...${NC}"
docker build -f Dockerfile.all-in-one -t mcp-server-all-in-one .

echo -e "${BLUE}🚀 Starting MCP server container...${NC}"
docker run -d \
    --name mcp-server \
    -p 3000:3000 \
    -p 8080:80 \
    -p 8081:8080 \
    -v $(pwd)/sessions:/app/sessions \
    -v $(pwd)/workspaces:/app/workspaces \
    -v $(pwd)/logs:/app/logs \
    --restart unless-stopped \
    mcp-server-all-in-one

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

echo ""
echo -e "${GREEN}🎉 All-in-One MCP Server is running!${NC}"
echo ""
echo -e "${BLUE}📡 Access Points:${NC}"
echo "• MCP Server API:     http://localhost:3000"
echo "• Health Check:       http://localhost:3000/health"
echo "• Configuration:      http://localhost:3000/config"
echo "• Web Interface:      http://localhost:8080"
echo "• VS Code Direct:     http://localhost:8081"
echo "• MCP SSE Endpoint:   ws://localhost:3000/mcp/sse"
echo "• MCP STDIO Endpoint: http://localhost:3000/mcp/stdio"
echo ""
echo -e "${BLUE}🔧 Container Management:${NC}"
echo "• View logs:          docker logs -f mcp-server"
echo "• Stop server:        docker stop mcp-server"
echo "• Restart:            docker restart mcp-server"
echo "• Remove:             docker rm -f mcp-server"
echo ""
echo -e "${YELLOW}🤖 For LLM Integration:${NC}"
echo "Visit http://localhost:3000/config to get the MCP configuration JSON"
echo ""
echo -e "${GREEN}Everything is ready in one container! 🚀${NC}"
