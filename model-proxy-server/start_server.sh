#!/bin/bash

# Model Proxy Server Startup Script v2.0
echo "Starting Model Proxy Server v2.0..."

# Set environment variables
export TRANSFORMERS_CACHE=/mnt/models/huggingface_cache
export HF_HOME=/mnt/models/huggingface_cache
export CUDA_VISIBLE_DEVICES=""
export MODEL_PROXY_HOST=0.0.0.0
export MODEL_PROXY_PORT=8000
export MODEL_PROXY_LOG_LEVEL=INFO

# Create necessary directories
mkdir -p /mnt/models/huggingface_cache
mkdir -p /mnt/models/user_models
mkdir -p logs

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Check if TPU is available
echo "Checking TPU availability..."
python3 -c "import jax; print('TPU devices:', jax.devices())" || echo "Warning: TPU not detected"

# Kill any existing servers
pkill -f "python.*main.py" || true
pkill -f "python.*model_proxy_server.py" || true

# Start the server
echo "Starting server on ${MODEL_PROXY_HOST}:${MODEL_PROXY_PORT}..."
python3 main.py > logs/server.log 2>&1 &

# Get the process ID
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Wait a moment and check if server is running
sleep 2
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server is running successfully!"
    echo "📊 Web Interface: http://localhost:${MODEL_PROXY_PORT}"
    echo "📋 API Documentation: http://localhost:${MODEL_PROXY_PORT}/docs"
    echo "📝 Log file: logs/server.log"
    echo ""
    echo "🔧 Management commands:"
    echo "  - View logs: tail -f logs/server.log"
    echo "  - Stop server: kill $SERVER_PID"
    echo "  - Check status: curl http://localhost:${MODEL_PROXY_PORT}/health"
else
    echo "❌ Server failed to start. Check logs/server.log for details."
    exit 1
fi
