import { Logger } from '../utils/Logger';
import { SUPPORTED_LANGUAGES } from '../types/McpTypes';

export class ConfigService {
  private logger = Logger.getInstance();
  private baseUrl: string;
  private sseUrl: string;
  private stdioUrl: string;

  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.sseUrl = process.env.SSE_URL || 'ws://localhost:3000/mcp/sse';
    this.stdioUrl = process.env.STDIO_URL || 'http://localhost:3000/mcp/stdio';
  }

  async getPublicConfig(): Promise<any> {
    return {
      name: "Enhanced MCP Server",
      description: "LLM-Exclusive Multi-Container Platform for Code Execution, VS Code, and Browser Automation",
      target_audience: "Large Language Models (LLMs) - NOT for human interaction",
      sse_servers: [this.sseUrl],
      stdio_servers: [
        {
          name: "enhanced-mcp-server",
          command: "curl",
          args: [
            "-X", "POST",
            "-H", "Content-Type: application/json",
            "-d", "@-",
            this.stdioUrl
          ]
        }
      ],
      llm_capabilities: {
        code_execution: {
          languages: Object.keys(SUPPORTED_LANGUAGES),
          memory_per_session: "5GB",
          isolation: "complete_container_isolation"
        },
        development_environments: {
          vscode_sessions: "Full web IDE with extensions",
          memory_per_session: "5GB",
          features: ["git", "terminal", "debugger", "extensions"]
        },
        browser_automation: {
          playwright_sessions: "Programmatic browser control",
          browsers: ["chromium", "firefox", "webkit"],
          memory_per_session: "5GB",
          features: ["screenshots", "pdf_generation", "network_interception"]
        },
        security: {
          network_isolation: true,
          filesystem_isolation: true,
          resource_limits: true,
          code_validation: true
        }
      },
      tools: await this.getAvailableTools(),
      endpoints: {
        base: this.baseUrl,
        sse: this.sseUrl,
        stdio: this.stdioUrl,
        health: `${this.baseUrl}/health`,
        sessions: `${this.baseUrl}/sessions`,
        config: `${this.baseUrl}/config`
      },
      usage_note: "This server is designed exclusively for LLM programmatic access via SSE/STDIO protocols. No human interaction interface is provided."
    };
  }

  async getClientConfig(): Promise<any> {
    return {
      server_info: {
        name: "Enhanced MCP Server",
        version: "1.0.0",
        description: "LLM-Exclusive multi-container platform for programmatic code execution, VS Code environments, and browser automation",
        target: "Large Language Models (LLMs) - Programmatic access only"
      },
      llm_tools: {
        code_execution: {
          enabled: true,
          languages: Object.keys(SUPPORTED_LANGUAGES).length,
          isolation: "complete_container"
        },
        vscode_environments: {
          enabled: true,
          features: ["web_ide", "extensions", "git", "terminal", "debugger"]
        },
        browser_automation: {
          enabled: true,
          engines: ["chromium", "firefox", "webkit"],
          capabilities: ["screenshots", "pdf_generation", "automation"]
        }
      },
      resources: {
        memory_per_session: "5GB",
        cpu_per_session: "2 cores",
        network_isolation: true,
        filesystem_isolation: true,
        concurrent_sessions: "unlimited"
      },
      supported_languages: SUPPORTED_LANGUAGES,
      access_methods: {
        sse: "Server-Sent Events for real-time LLM communication",
        stdio: "Standard I/O for batch LLM operations"
      },
      usage_model: "LLMs connect programmatically to execute code, manage development environments, and control browsers"
    };
  }

  private async getAvailableTools(): Promise<any[]> {
    return [
      {
        name: "execute_code",
        description: "Execute code in isolated container environment with 5GB memory",
        input_schema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: Object.keys(SUPPORTED_LANGUAGES),
              description: "Programming language to execute"
            },
            code: {
              type: "string",
              description: "Code to execute"
            },
            session_id: {
              type: "string",
              description: "Optional session ID to reuse existing container",
              optional: true
            },
            timeout: {
              type: "number",
              description: "Execution timeout in milliseconds (default: 30000)",
              optional: true,
              default: 30000
            }
          },
          required: ["language", "code"]
        }
      },
      {
        name: "create_execution_session",
        description: "Create dedicated execution environment with persistent container",
        input_schema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: Object.keys(SUPPORTED_LANGUAGES),
              description: "Primary programming language for the session"
            },
            memory: {
              type: "string",
              description: "Memory allocation (default: 5g)",
              optional: true,
              default: "5g"
            }
          },
          required: ["language"]
        }
      },
      {
        name: "create_vscode_session",
        description: "Create isolated VS Code development environment with 5GB memory",
        input_schema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: Object.keys(SUPPORTED_LANGUAGES),
              description: "Primary programming language for development",
              optional: true
            },
            template: {
              type: "string",
              description: "Project template to initialize",
              optional: true
            },
            extensions: {
              type: "array",
              items: { type: "string" },
              description: "VS Code extensions to install",
              optional: true
            }
          }
        }
      },
      {
        name: "create_playwright_session",
        description: "Create browser automation environment with Chromium/Firefox/WebKit",
        input_schema: {
          type: "object",
          properties: {
            browser: {
              type: "string",
              enum: ["chromium", "firefox", "webkit"],
              description: "Browser engine to use",
              default: "chromium"
            },
            headless: {
              type: "boolean",
              description: "Run browser in headless mode",
              default: true
            },
            viewport: {
              type: "object",
              properties: {
                width: { type: "number", default: 1920 },
                height: { type: "number", default: 1080 }
              },
              description: "Browser viewport size",
              optional: true
            },
            language: {
              type: "string",
              enum: ["python", "javascript"],
              description: "API language for automation scripts",
              default: "python"
            }
          }
        }
      },
      {
        name: "list_sessions",
        description: "List all active sessions for the current client",
        input_schema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "destroy_session",
        description: "Destroy a session and cleanup resources",
        input_schema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session ID to destroy"
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "get_session_info",
        description: "Get detailed information about a session",
        input_schema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session ID to query"
            }
          },
          required: ["session_id"]
        }
      }
    ];
  }

  private getSessionTypes(): any {
    return {
      execution: {
        description: "Isolated code execution environment",
        memory: "5GB",
        features: ["code_execution", "file_system", "package_installation"],
        supported_languages: Object.keys(SUPPORTED_LANGUAGES)
      },
      vscode: {
        description: "Full-featured web-based IDE",
        memory: "5GB",
        features: ["web_ide", "extensions", "git", "terminal", "debugger"],
        url_access: true,
        port_range: "8080-8180"
      },
      playwright: {
        description: "Browser automation environment",
        memory: "5GB",
        features: ["browser_automation", "screenshot", "pdf_generation", "network_interception"],
        supported_browsers: ["chromium", "firefox", "webkit"],
        api_languages: ["python", "javascript"],
        url_access: true,
        port_range: "9220-9320"
      }
    };
  }

  getEnvironmentConfig(): any {
    return {
      node_env: process.env.NODE_ENV || 'development',
      log_level: process.env.LOG_LEVEL || 'info',
      docker_socket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
      redis_url: process.env.REDIS_URL || 'redis://localhost:6379',
      max_sessions_per_client: parseInt(process.env.MAX_SESSIONS_PER_CLIENT || '10'),
      session_timeout_hours: parseInt(process.env.SESSION_TIMEOUT_HOURS || '24'),
      cleanup_interval_minutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '60')
    };
  }
}
