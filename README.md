# 🤖 Enhanced MCP Server Platform - LLM Exclusive

**FOR LARGE LANGUAGE MODELS ONLY - NOT FOR HUMAN INTERACTION**

A production-ready Multi-Container Platform (MCP) server designed exclusively for Large Language Models (LLMs) to programmatically execute code, manage development environments, and control browsers via SSE/STDIO protocols.

## 🎯 LLM-Focused Features

- **🔌 LLM Protocols**: SSE (Server-Sent Events) and STDIO for programmatic LLM access
- **💻 Code Execution**: 15 programming languages with 5GB isolated containers
- **🛠️ VS Code Environments**: Full web IDE instances for LLM development tasks
- **🌐 Browser Automation**: Playwright control for web scraping and automation
- **🔒 Complete Isolation**: Each LLM session runs in isolated 5GB containers
- **⚡ Production Ready**: Scalable architecture for high-volume LLM usage

## ⚠️ Important: LLM-Only Design

This MCP server is **specifically designed for Large Language Models** to connect and use programmatically. It provides:

- **NO human user interface** (except config display frontend)
- **Programmatic access only** via MCP protocols
- **Tool-based interactions** for LLMs to call specific functions
- **Automated resource management** for LLM sessions

## Architecture

```
├── mcp-server/           # Core MCP server implementation
├── containers/           # Docker containers for different services
├── frontend/            # Configuration display frontend
├── infrastructure/      # GCP deployment configuration
├── security/           # Security and isolation components
└── docs/              # Documentation
```

## 🤖 LLM Session Types

For Large Language Models to programmatically create and use:

- **🔧 Execution Sessions**: Isolated code execution in 15 languages (5GB memory each)
- **💼 VS Code Sessions**: Full development environments with tools and extensions (5GB memory)
- **🌍 Playwright Sessions**: Browser automation for web scraping and testing (5GB memory)

## 🚀 LLM Connection Setup

### 1. Deploy MCP Server
```bash
# Deploy to GCP
chmod +x scripts/*.sh
./scripts/quick-deploy.sh
```

### 2. Get LLM Configuration
Visit the frontend URL to copy the JSON configuration for your LLM:

```json
{
  "sse_servers": ["wss://your-server.com/mcp/sse"],
  "stdio_servers": [
    {
      "name": "enhanced-mcp-server", 
      "command": "curl",
      "args": ["-X", "POST", "-H", "Content-Type: application/json", "-d", "@-", "https://your-server.com/mcp/stdio"]
    }
  ]
}
```

### 3. LLM Tool Access
Your LLM can now use these tools programmatically:
- `execute_code` - Run code in isolated containers
- `create_vscode_session` - Spin up development environments  
- `create_playwright_session` - Control browsers for automation

## 💾 Resource Allocation

Each LLM session receives dedicated 5GB memory allocation for optimal performance and complete isolation.
