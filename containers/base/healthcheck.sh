#!/bin/bash

# Basic health check for containers
echo "Container health check at $(date)"

# Check if workspace is accessible
if [ ! -d "/workspace" ]; then
    echo "ERROR: Workspace directory not accessible"
    exit 1
fi

# Check if we can write to workspace
if [ ! -w "/workspace" ]; then
    echo "ERROR: Workspace directory not writable"
    exit 1
fi

# Check memory usage (basic check)
memory_used=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$memory_used" -gt 95 ]; then
    echo "WARNING: High memory usage: ${memory_used}%"
fi

echo "Health check passed"
exit 0
