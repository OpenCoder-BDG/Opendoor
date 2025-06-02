#!/bin/bash

# Startup script for MCP Server on Google Compute Engine
# This script sets up Docker containers with optimized resource allocation

set -e

# Variables from Terraform
REDIS_HOST="${redis_host}"
REDIS_PORT="${redis_port}"
PROJECT_ID="${project_id}"
ENVIRONMENT="${environment}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/mcp-startup.log
}

log "Starting MCP Server setup on Compute Engine..."

# Update system and install dependencies
log "Installing system dependencies..."
apt-get update
apt-get install -y \
    curl \
    wget \
    unzip \
    git \
    htop \
    iotop \
    netstat-nat \
    tcpdump

# Install Docker if not present (COS should have it)
if ! command -v docker &> /dev/null; then
    log "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose
log "Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Configure Docker daemon for performance
log "Configuring Docker daemon..."
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    }
  },
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 5
}
EOF

systemctl restart docker

# Create application directory
log "Setting up application directory..."
mkdir -p /opt/mcp-server
cd /opt/mcp-server

# Create optimized Docker Compose configuration
log "Creating Docker Compose configuration..."
cat > docker-compose.yml << EOF
version: '3.8'

services:
  mcp-server:
    image: gcr.io/${PROJECT_ID}/mcp-server:latest
    container_name: mcp-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=${REDIS_PORT}
      - GOOGLE_CLOUD_REGION=us-central1
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /opt/mcp-server/sessions:/app/sessions
      - /opt/mcp-server/logs:/app/logs
    networks:
      - mcp-network
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Pre-warmed Python container
  mcp-python-1:
    image: gcr.io/${PROJECT_ID}/mcp-python:latest
    container_name: mcp-python-1
    restart: unless-stopped
    networks:
      - mcp-network
    deploy:
      resources:
        limits:
          memory: 5G
          cpus: '0.5'
        reservations:
          memory: 1G
          cpus: '0.25'
    security_opt:
      - no-new-privileges:true
    ulimits:
      nproc: 1024
      nofile: 65536
    tmpfs:
      - /tmp:size=1G,noexec,nosuid,nodev

  mcp-python-2:
    image: gcr.io/${PROJECT_ID}/mcp-python:latest
    container_name: mcp-python-2
    restart: unless-stopped
    networks:
      - mcp-network
    deploy:
      resources:
        limits:
          memory: 5G
          cpus: '0.5'
        reservations:
          memory: 1G
          cpus: '0.25'
    security_opt:
      - no-new-privileges:true
    ulimits:
      nproc: 1024
      nofile: 65536
    tmpfs:
      - /tmp:size=1G,noexec,nosuid,nodev

  # Pre-warmed JavaScript container
  mcp-javascript-1:
    image: gcr.io/${PROJECT_ID}/mcp-javascript:latest
    container_name: mcp-javascript-1
    restart: unless-stopped
    networks:
      - mcp-network
    deploy:
      resources:
        limits:
          memory: 5G
          cpus: '0.5'
        reservations:
          memory: 1G
          cpus: '0.25'
    security_opt:
      - no-new-privileges:true
    ulimits:
      nproc: 1024
      nofile: 65536
    tmpfs:
      - /tmp:size=1G,noexec,nosuid,nodev

  # Pre-warmed VS Code container
  mcp-vscode-1:
    image: gcr.io/${PROJECT_ID}/mcp-vscode:latest
    container_name: mcp-vscode-1
    restart: unless-stopped
    networks:
      - mcp-network
    deploy:
      resources:
        limits:
          memory: 5G
          cpus: '1.0'
        reservations:
          memory: 2G
          cpus: '0.5'
    security_opt:
      - no-new-privileges:true
    ulimits:
      nproc: 1024
      nofile: 65536
    tmpfs:
      - /tmp:size=1G,noexec,nosuid,nodev

  # Pre-warmed Playwright container
  mcp-playwright-1:
    image: gcr.io/${PROJECT_ID}/mcp-playwright:latest
    container_name: mcp-playwright-1
    restart: unless-stopped
    networks:
      - mcp-network
    deploy:
      resources:
        limits:
          memory: 5G
          cpus: '1.0'
        reservations:
          memory: 2G
          cpus: '0.5'
    security_opt:
      - no-new-privileges:true
    ulimits:
      nproc: 1024
      nofile: 65536
    tmpfs:
      - /tmp:size=1G,noexec,nosuid,nodev

networks:
  mcp-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: mcp-bridge
      com.docker.network.driver.mtu: 1500

volumes:
  sessions:
    driver: local
  logs:
    driver: local
EOF

# Create directories
log "Creating required directories..."
mkdir -p /opt/mcp-server/sessions
mkdir -p /opt/mcp-server/logs
chmod 755 /opt/mcp-server/sessions
chmod 755 /opt/mcp-server/logs

# Configure Google Cloud logging
log "Setting up Google Cloud logging..."
curl -sSO https://dl.google.com/cloudagents/add-logging-agent-repo.sh
bash add-logging-agent-repo.sh --also-install

# Configure log forwarding
cat > /etc/google-fluentd/config.d/mcp-server.conf << EOF
<source>
  @type tail
  path /opt/mcp-server/logs/*.log
  pos_file /var/lib/google-fluentd/pos/mcp-server.log.pos
  tag mcp.server
  format json
</source>

<filter mcp.server>
  @type record_transformer
  <record>
    hostname \${hostname}
    environment ${ENVIRONMENT}
    service mcp-server
  </record>
</filter>
EOF

systemctl restart google-fluentd

# Configure Google Cloud monitoring
log "Setting up Google Cloud monitoring..."
curl -sSO https://dl.google.com/cloudagents/add-monitoring-agent-repo.sh
bash add-monitoring-agent-repo.sh --also-install

# Authenticate with Google Cloud
log "Authenticating with Google Cloud..."
gcloud auth configure-docker --quiet

# Pull container images
log "Pulling container images..."
docker-compose pull

# Start services
log "Starting MCP Server services..."
docker-compose up -d

# Wait for services to be ready
log "Waiting for services to start..."
sleep 30

# Verify services are running
log "Verifying services..."
docker-compose ps

# Setup health check endpoint
log "Setting up health check..."
cat > /opt/mcp-server/health-check.sh << 'EOF'
#!/bin/bash
# Health check script for load balancer

# Check if main service is responding
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo "MCP Server is healthy"
    exit 0
else
    echo "MCP Server is unhealthy"
    exit 1
fi
EOF

chmod +x /opt/mcp-server/health-check.sh

# Setup log rotation
log "Setting up log rotation..."
cat > /etc/logrotate.d/mcp-server << EOF
/opt/mcp-server/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        docker-compose -f /opt/mcp-server/docker-compose.yml restart mcp-server
    endscript
}
EOF

# Setup monitoring script
log "Setting up monitoring script..."
cat > /opt/mcp-server/monitor.sh << 'EOF'
#!/bin/bash
# Monitoring script for MCP Server

LOG_FILE="/var/log/mcp-monitor.log"

log_metric() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Check container health
check_containers() {
    local unhealthy_containers=$(docker ps --filter "health=unhealthy" --format "table {{.Names}}" | grep -v NAMES | wc -l)
    if [ $unhealthy_containers -gt 0 ]; then
        log_metric "WARNING: $unhealthy_containers unhealthy containers detected"
        docker ps --filter "health=unhealthy" --format "table {{.Names}}\t{{.Status}}" >> $LOG_FILE
    fi
}

# Check disk space
check_disk_space() {
    local disk_usage=$(df /opt/mcp-server | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $disk_usage -gt 80 ]; then
        log_metric "WARNING: Disk usage is ${disk_usage}%"
    fi
}

# Check memory usage
check_memory() {
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ $mem_usage -gt 85 ]; then
        log_metric "WARNING: Memory usage is ${mem_usage}%"
    fi
}

# Run checks
check_containers
check_disk_space
check_memory

log_metric "Health check completed"
EOF

chmod +x /opt/mcp-server/monitor.sh

# Setup cron job for monitoring
echo "*/5 * * * * /opt/mcp-server/monitor.sh" | crontab -

# Setup systemd service for auto-restart
log "Setting up systemd service..."
cat > /etc/systemd/system/mcp-server.service << EOF
[Unit]
Description=MCP Server Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/mcp-server
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl enable mcp-server.service

# Final health check
log "Performing final health check..."
sleep 10
if curl -f http://localhost:3000/health; then
    log "✅ MCP Server setup completed successfully!"
else
    log "❌ MCP Server setup completed but health check failed"
fi

# Log system information
log "System Information:"
log "CPU: $(nproc) cores"
log "Memory: $(free -h | awk 'NR==2{print $2}')"
log "Disk: $(df -h /opt/mcp-server | awk 'NR==2{print $2}')"
log "Docker version: $(docker --version)"
log "Docker Compose version: $(docker-compose --version)"

log "MCP Server startup script completed!"