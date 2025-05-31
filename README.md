# Enhanced MCP Server Platform

A production-ready Multi-Container Platform (MCP) server with SSE and STDIO support, featuring multi-language development environments, VS Code integration, and Playwright automation.

## Features

- **Multi-Protocol Support**: SSE (Server-Sent Events) and STDIO protocols
- **15 Programming Languages**: Python, JavaScript, TypeScript, Java, C, C++, C#, Rust, Go, PHP, Perl, Ruby, Lua, Swift, Objective-C
- **VS Code Server Integration**: Isolated web-based IDE instances with 5GB memory per user
- **Playwright Automation**: Browser automation with Chromium, Firefox, and WebKit support
- **Docker Isolation**: Complete container isolation with 5GB memory allocation per session
- **Production Ready**: Scalable architecture with proper resource management and security

## Architecture

```
├── mcp-server/           # Core MCP server implementation
├── containers/           # Docker containers for different services
├── frontend/            # Configuration display frontend
├── infrastructure/      # GCP deployment configuration
├── security/           # Security and isolation components
└── docs/              # Documentation
```

## Session Types

- **Execution Sessions**: Isolated environments for code execution (5GB memory)
- **VS Code Sessions**: Full-featured web IDE (5GB memory)
- **Playwright Sessions**: Browser automation environment (5GB memory)

## Quick Start

1. Deploy to GCP using provided Terraform configuration
2. Access the frontend at your deployed URL to get JSON configuration
3. Connect LLMs using the provided SSE/STDIO endpoints

## Memory Allocation

Each session type receives dedicated 5GB memory allocation for optimal performance and isolation.
