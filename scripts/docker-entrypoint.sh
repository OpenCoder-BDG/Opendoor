#!/bin/sh
set -e

echo "🚀 Starting Enhanced MCP Server..."
echo "📊 Environment: $NODE_ENV"
echo "🔧 Port: $PORT"
echo "📝 Log Level: $LOG_LEVEL"

# Wait for Redis if configured
if [ -n "$REDIS_HOST" ]; then
    echo "⏳ Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
    timeout=30
    while ! nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -eq 0 ]; then
            echo "❌ Redis connection timeout. Continuing with memory storage..."
            break
        fi
        sleep 1
    done
    echo "✅ Redis connection established"
fi

# Check Docker socket access
if [ -S "$DOCKER_SOCKET" ]; then
    echo "✅ Docker socket accessible"
else
    echo "⚠️  Docker socket not found at $DOCKER_SOCKET"
    echo "   Make sure to mount the Docker socket: -v /var/run/docker.sock:/var/run/docker.sock"
fi

# Create log directory with proper permissions
mkdir -p /app/logs /app/sessions

echo "🎉 Starting MCP Server..."
exec node dist/index.js
