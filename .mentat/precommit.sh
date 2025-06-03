#!/bin/bash

# Precommit script to check TypeScript compilation
echo "🔍 Running precommit checks..."

# Check if we're in the MCP server directory and run TypeScript compilation
if [ -d "mcp-server" ]; then
    echo "📦 Checking MCP server TypeScript compilation..."
    cd mcp-server
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📥 Installing dependencies..."
        npm install
    fi
    
    # Run TypeScript compilation check
    echo "🔧 Running TypeScript compilation check..."
    if ! npm run build; then
        echo "❌ TypeScript compilation failed!"
        echo "Please fix the TypeScript errors before committing."
        exit 1
    fi
    
    echo "✅ TypeScript compilation successful!"
    cd ..
fi

echo "✅ All precommit checks passed!"
exit 0
