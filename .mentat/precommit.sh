#!/bin/bash
set -e

echo "🔧 Running MCP Server pre-commit checks..."

# Check if we're in the repo root
if [ ! -f "mcp-server/package.json" ]; then
    echo "❌ Must run from repository root"
    exit 1
fi

cd mcp-server

# Install pnpm if not available
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Generate lockfile if it doesn't exist
if [ ! -f "pnpm-lock.yaml" ]; then
    echo "🔒 Generating pnpm-lock.yaml..."
    pnpm install --lockfile-only
    echo "✅ Generated pnpm-lock.yaml"
fi

# Update lockfile if package.json changed
if [ "package.json" -nt "pnpm-lock.yaml" ]; then
    echo "🔄 Updating pnpm-lock.yaml..."
    pnpm install --lockfile-only
    echo "✅ Updated pnpm-lock.yaml"
fi

cd ..

echo "✅ Pre-commit checks completed successfully!"
