#!/bin/bash
set -e

echo "🚀 Starting All-in-One MCP Server Container..."

# Create log directories
mkdir -p /var/log/redis /var/log/supervisor

# Fix permissions
chown -R mcpuser:mcpuser /app
chown -R redis:redis /var/log/redis
chmod 755 /app/sessions /app/workspaces

# Start supervisor to manage all services
echo "📊 Starting services with supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
</mentat_start_file>
<mentat_write_file filepath="docker-compose.simple.yml">
version: '3.8'

services:
  mcp-all-in-one:
    build:
      context: .
      dockerfile: Dockerfile.all-in-one
    ports:
      - "3000:3000"    # MCP Server API
      - "8080:80"      # Web interface (nginx)
      - "8081:8080"    # Direct VS Code access
    volumes:
      - ./sessions:/app/sessions
      - ./workspaces:/app/workspaces
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - MAX_CONCURRENT_EXECUTIONS=20
      - RATE_LIMIT_POINTS=200
      - SESSION_TIMEOUT_HOURS=24
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  sessions:
  workspaces:
  logs:
