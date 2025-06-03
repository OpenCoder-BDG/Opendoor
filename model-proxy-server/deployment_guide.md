# Deployment Guide

## Quick Start

### 1. Google Cloud Setup

```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Authenticate with service account
gcloud auth activate-service-account --key-file=service-account-key.json
gcloud config set project capable-acrobat-460705-t1
```

### 2. Create Infrastructure

```bash
# Create TPU VM
gcloud compute tpus tpu-vm create vllm-model-server \
  --zone=us-central1-b \
  --accelerator-type=v2-8 \
  --version=tpu-ubuntu2204-base

# Create storage disk
gcloud compute disks create vllm-storage-disk \
  --size=100GB \
  --zone=us-central1-b \
  --type=pd-standard

# Attach disk
gcloud compute tpus tpu-vm attach-disk vllm-model-server \
  --zone=us-central1-b \
  --disk=vllm-storage-disk

# Create firewall rules
gcloud compute firewall-rules create allow-model-server \
  --allow tcp:8000,tcp:8001 \
  --source-ranges 0.0.0.0/0 \
  --description "Allow model server ports"
```

### 3. Setup TPU VM

```bash
# SSH into TPU VM
gcloud compute tpus tpu-vm ssh vllm-model-server --zone=us-central1-b

# Format and mount storage
sudo mkfs.ext4 -F /dev/sdb
sudo mkdir -p /mnt/models
sudo mount /dev/sdb /mnt/models
sudo chown -R $USER:$USER /mnt/models

# Add to fstab for persistence
echo '/dev/sdb /mnt/models ext4 defaults 0 2' | sudo tee -a /etc/fstab

# Create directory structure
mkdir -p /mnt/models/huggingface_cache
mkdir -p /mnt/models/user_models
```

### 4. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git

# Create virtual environment
mkdir -p ~/vllm-server
cd ~/vllm-server
python3 -m venv venv
source venv/bin/activate

# Install JAX for TPU
pip install -U pip
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html

# Install other dependencies
pip install flax==0.10.6
pip install transformers==4.52.4
pip install torch==2.7.0+cpu torch_xla==2.7.0
pip install fastapi==0.115.12 uvicorn[standard]
pip install huggingface_hub==0.32.3 datasets==3.6.0 accelerate==1.7.0
pip install sentencepiece tokenizers requests pydantic python-multipart
pip install aiofiles numpy pandas
```

### 5. Deploy Application

```bash
# Copy files to TPU VM (from local machine)
scp -r model-proxy-server/* user@[TPU-VM-IP]:~/vllm-server/

# On TPU VM, set environment variables
export TRANSFORMERS_CACHE=/mnt/models/huggingface_cache
export HF_HOME=/mnt/models/huggingface_cache
export CUDA_VISIBLE_DEVICES=""

# Make scripts executable
chmod +x start_enhanced_server.sh start_server.sh

# Start the server
./start_enhanced_server.sh
```

## Production Deployment

### 1. Systemd Service

Create `/etc/systemd/system/model-proxy-server.service`:

```ini
[Unit]
Description=Model Proxy Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/home/your-user/vllm-server
Environment=PATH=/home/your-user/vllm-server/venv/bin
Environment=TRANSFORMERS_CACHE=/mnt/models/huggingface_cache
Environment=HF_HOME=/mnt/models/huggingface_cache
Environment=CUDA_VISIBLE_DEVICES=""
ExecStart=/home/your-user/vllm-server/venv/bin/python model_proxy_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable model-proxy-server
sudo systemctl start model-proxy-server
sudo systemctl status model-proxy-server
```

### 2. Nginx Reverse Proxy

Install and configure Nginx:

```bash
sudo apt install nginx

# Create configuration
sudo tee /etc/nginx/sites-available/model-proxy-server << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/model-proxy-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Monitoring and Maintenance

### 1. Log Monitoring

```bash
# Server logs
tail -f ~/vllm-server/proxy_server_final.log

# System logs
sudo journalctl -u model-proxy-server -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. Health Checks

```bash
# API health check
curl http://localhost:8000/health

# TPU status
python3 -c "import jax; print('TPU devices:', jax.devices())"

# Disk usage
df -h /mnt/models
```

### 3. Backup Strategy

```bash
# Create backup script
cat > ~/backup_models.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /mnt/models/backup_${DATE}.tar.gz \
  ~/vllm-server/*.py \
  ~/vllm-server/*.html \
  ~/vllm-server/*.sh \
  /mnt/models/user_models/
EOF

chmod +x ~/backup_models.sh

# Add to crontab for daily backups
echo "0 2 * * * /home/$(whoami)/backup_models.sh" | crontab -
```

## Scaling Considerations

### 1. Multiple TPU VMs

For high availability, deploy multiple TPU VMs with a load balancer:

```bash
# Create additional TPU VMs
for i in {2..3}; do
  gcloud compute tpus tpu-vm create vllm-model-server-$i \
    --zone=us-central1-b \
    --accelerator-type=v2-8 \
    --version=tpu-ubuntu2204-base
done
```

### 2. Database Backend

For production, consider using a database for user management:

```python
# Add to requirements.txt
sqlalchemy
alembic
psycopg2-binary  # for PostgreSQL
```

### 3. Redis for Caching

```bash
# Install Redis
sudo apt install redis-server

# Add to requirements.txt
redis
aioredis
```

## Security Considerations

### 1. API Key Management

- Use strong, randomly generated API keys
- Implement key rotation
- Store keys securely (consider HashiCorp Vault)

### 2. Network Security

```bash
# Restrict firewall rules to specific IPs
gcloud compute firewall-rules update allow-model-server \
  --source-ranges YOUR_IP_RANGE/32
```

### 3. Authentication

Consider implementing OAuth2 or JWT authentication for production use.

## Troubleshooting

### Common Issues

1. **TPU Not Available**: Check TPU quota and zone availability
2. **Out of Memory**: Monitor model sizes and TPU memory usage
3. **Slow Model Loading**: Ensure fast storage and network connectivity
4. **API Timeouts**: Increase timeout values in Nginx and application

### Debug Commands

```bash
# Check TPU status
python3 -c "import jax; print(jax.local_devices())"

# Monitor resources
htop
nvidia-smi  # if using GPU fallback
df -h

# Test connectivity
curl -v http://localhost:8000/health
```