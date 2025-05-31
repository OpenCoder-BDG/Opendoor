# Enhanced MCP Server Documentation

## Overview

The Enhanced MCP Server is a production-ready Multi-Container Platform that provides isolated development environments with support for 15 programming languages, VS Code integration, and Playwright browser automation.

## Features

### 🚀 Core Capabilities
- **Multi-Protocol Support**: SSE (Server-Sent Events) and STDIO protocols
- **15 Programming Languages**: Python, JavaScript, TypeScript, Java, C, C++, C#, Rust, Go, PHP, Perl, Ruby, Lua, Swift, Objective-C
- **Complete Isolation**: Each session runs in its own Docker container with 5GB memory
- **Production Ready**: Scalable architecture with proper resource management

### 🔧 Session Types

#### Execution Sessions
- Isolated code execution environments
- 5GB memory allocation per session
- Support for all 15 languages
- Package installation capabilities

#### VS Code Sessions
- Full-featured web-based IDE
- 5GB memory per instance
- Language-specific extensions
- Git integration and terminal access

#### Playwright Sessions
- Browser automation environment
- Support for Chromium, Firefox, and WebKit
- Python and JavaScript APIs
- Screenshot and PDF generation

### 🔒 Security Features
- Complete container isolation
- Network isolation between sessions
- Code validation and sanitization
- Resource limits enforcement
- No shared file systems

## Quick Start

### 1. Deploy to GCP
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Quick deployment
./scripts/quick-deploy.sh
```

### 2. Get Configuration
After deployment, visit your frontend URL to get the JSON configuration for LLM connections.

### 3. Connect LLMs
Use the SSE or STDIO endpoints provided in the configuration to connect your LLM clients.

## API Endpoints

### Core Endpoints
- **Base URL**: `https://your-server-url`
- **SSE**: `wss://your-server-url/mcp/sse`
- **STDIO**: `https://your-server-url/mcp/stdio`
- **Health**: `https://your-server-url/health`
- **Config**: `https://your-server-url/config`

### Session Management
- **Create Session**: `POST /sessions`
- **Get Session**: `GET /sessions/{id}`
- **Delete Session**: `DELETE /sessions/{id}`

## Available Tools

### execute_code
Execute code in isolated container environments:
```json
{
  "name": "execute_code",
  "arguments": {
    "language": "python",
    "code": "print('Hello, World!')",
    "session_id": "optional-session-id"
  }
}
```

### create_vscode_session
Create VS Code development environment:
```json
{
  "name": "create_vscode_session",
  "arguments": {
    "language": "python",
    "template": "web-app"
  }
}
```

### create_playwright_session
Create browser automation environment:
```json
{
  "name": "create_playwright_session",
  "arguments": {
    "browser": "chromium",
    "headless": true
  }
}
```

## Supported Languages

| Language | Version | Features |
|----------|---------|----------|
| Python | 3.11 | NumPy, Pandas, ML libraries |
| JavaScript | Node 18 | Express, React, modern frameworks |
| TypeScript | 5.2 | Full type checking and compilation |
| Java | 17 | Maven, Gradle build tools |
| C | GCC 11 | Standard library, debugging tools |
| C++ | GCC 11 | STL, Boost libraries |
| C# | .NET 7 | Modern .NET ecosystem |
| Rust | 1.70 | Cargo package manager |
| Go | 1.21 | Go modules, latest features |
| PHP | 8.2 | Composer, modern PHP |
| Perl | 5.38 | CPAN modules |
| Ruby | 3.2 | Gems, Rails framework |
| Lua | 5.4 | LuaRocks package manager |
| Swift | 5.8 | Package Manager |
| Objective-C | Clang | Foundation framework |

## Architecture

### Container Strategy
Each session type uses dedicated Docker containers:
- **Language Containers**: Optimized for specific programming languages
- **VS Code Container**: Full IDE with extensions
- **Playwright Container**: Browser automation tools

### Resource Management
- **Memory**: 5GB per session (configurable)
- **CPU**: 2 cores per session
- **Storage**: Isolated file systems
- **Network**: Complete isolation

### Scaling
- Horizontal scaling with Cloud Run
- Auto-scaling based on demand
- Load balancing across instances
- Redis for session state management

## Configuration

### Environment Variables
- `NODE_ENV`: Runtime environment
- `REDIS_URL`: Redis connection string
- `BASE_URL`: Server base URL
- `MAX_SESSIONS_PER_CLIENT`: Session limits

### GCP Resources
- **Cloud Run**: Main application hosting
- **Artifact Registry**: Container images
- **Memorystore Redis**: Session storage
- **VPC**: Network isolation
- **Load Balancer**: Traffic distribution

## Monitoring

### Health Checks
- Application health endpoint
- Container health monitoring
- Resource usage tracking
- Service dependency checks

### Logging
- Structured logging with Winston
- Cloud Logging integration
- Error tracking and alerting
- Performance metrics

## Security

### Container Security
- Non-root user execution
- Read-only root filesystem
- Security profiles
- Resource limits

### Network Security
- VPC isolation
- Firewall rules
- TLS encryption
- API rate limiting

### Code Security
- Input validation
- Code pattern detection
- Sandboxed execution
- Process isolation

## Troubleshooting

### Common Issues
1. **Container startup failures**: Check logs in Cloud Logging
2. **Resource limits**: Monitor memory and CPU usage
3. **Network connectivity**: Verify VPC configuration
4. **Authentication**: Check service account permissions

### Debug Commands
```bash
# Check container status
gcloud run services describe mcp-server --region=us-central1

# View logs
gcloud logging read "resource.type=cloud_run_revision"

# Check Redis connection
gcloud redis instances describe mcp-redis --region=us-central1
```

## Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Building Containers
```bash
# Build all containers
./scripts/setup-containers.sh

# Build specific language
docker build -f containers/languages/Dockerfile.python -t mcp-python .
```

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Cloud Logging for errors
3. Monitor resource usage in Cloud Console
4. Verify container health status

## License

MIT License - see LICENSE file for details.
