import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { SessionManager } from '../session/SessionManager';
import { ContainerManager } from '../container/ContainerManager';
import { SecurityManager } from '../security/SecurityManager';
import { ConfigService } from '../services/ConfigService';
import { Logger } from '../utils/Logger';
import { McpRequest, McpResponse, McpError } from '../types/McpTypes';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export class McpServer {
  private logger = Logger.getInstance();
  private rateLimiter: RateLimiterMemory;

  constructor(
    private services: {
      sessionManager: SessionManager;
      containerManager: ContainerManager;
      securityManager: SecurityManager;
      configService: ConfigService;
    }
  ) {
    this.rateLimiter = new RateLimiterMemory({
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
    });
  }

  async handleSSEConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const clientId = this.generateClientId();
    this.logger.info(`New SSE connection: ${clientId}`);

    // Rate limiting
    try {
      await this.rateLimiter.consume(request.socket.remoteAddress || 'unknown');
    } catch (rejRes) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    // Security validation
    const isAuthorized = await this.services.securityManager.validateConnection(request);
    if (!isAuthorized) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    ws.on('message', async (data: Buffer) => {
      try {
        const request: McpRequest = JSON.parse(data.toString());
        const response = await this.processRequest(request, clientId);
        ws.send(JSON.stringify(response));
      } catch (error) {
        this.logger.error(`Error processing SSE message for ${clientId}:`, error);
        const errorResponse: McpError = {
          id: null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        };
        ws.send(JSON.stringify(errorResponse));
      }
    });

    ws.on('close', () => {
      this.logger.info(`SSE connection closed: ${clientId}`);
      this.cleanup(clientId);
    });

    ws.on('error', (error) => {
      this.logger.error(`SSE connection error for ${clientId}:`, error);
      this.cleanup(clientId);
    });

    // Send initial configuration
    const config = await this.services.configService.getClientConfig();
    ws.send(JSON.stringify({
      id: null,
      method: 'initialize',
      params: config
    }));
  }

  async handleSTDIORequest(request: McpRequest, headers: any): Promise<McpResponse> {
    const clientId = this.generateClientId();
    
    // Rate limiting
    try {
      await this.rateLimiter.consume(headers['x-forwarded-for'] || 'unknown');
    } catch (rejRes) {
      throw new Error('Rate limit exceeded');
    }

    // Security validation
    const isAuthorized = await this.services.securityManager.validateRequest(request, headers);
    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }

    return this.processRequest(request, clientId);
  }

  private async processRequest(request: McpRequest, clientId: string): Promise<McpResponse> {
    this.logger.debug(`Processing request for ${clientId}:`, request.method);

    try {
      switch (request.method) {
        case 'session/create':
          return await this.handleCreateSession(request, clientId);
        
        case 'session/execute':
          return await this.handleExecuteCode(request, clientId);
        
        case 'session/vscode':
          return await this.handleVSCodeSession(request, clientId);
        
        case 'session/playwright':
          return await this.handlePlaywrightSession(request, clientId);
        
        case 'session/destroy':
          return await this.handleDestroySession(request, clientId);
        
        case 'session/list':
          return await this.handleListSessions(request, clientId);
        
        case 'tools/list':
          return await this.handleListTools(request, clientId);
        
        case 'tools/call':
          return await this.handleToolCall(request, clientId);
        
        default:
          throw new Error(`Unknown method: ${request.method}`);
      }
    } catch (error) {
      this.logger.error(`Error processing request ${request.method} for ${clientId}:`, error);
      return {
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async handleCreateSession(request: McpRequest, clientId: string): Promise<McpResponse> {
    const { type, language, memory = '5g' } = request.params;
    
    const session = await this.services.sessionManager.createSession({
      type,
      language,
      memory,
      clientId
    });

    return {
      id: request.id,
      result: {
        sessionId: session.id,
        type: session.type,
        language: session.language,
        status: session.status,
        endpoints: session.endpoints
      }
    };
  }

  private async handleExecuteCode(request: McpRequest, clientId: string): Promise<McpResponse> {
    const { sessionId, code, language } = request.params;
    
    const result = await this.services.containerManager.executeCode(sessionId, {
      code,
      language,
      timeout: 30000 // 30 seconds
    });

    return {
      id: request.id,
      result
    };
  }

  private async handleVSCodeSession(request: McpRequest, clientId: string): Promise<McpResponse> {
    const { sessionId } = request.params;
    
    const vscodeUrl = await this.services.containerManager.getVSCodeUrl(sessionId);

    return {
      id: request.id,
      result: {
        url: vscodeUrl,
        sessionId
      }
    };
  }

  private async handlePlaywrightSession(request: McpRequest, clientId: string): Promise<McpResponse> {
    const { sessionId, browser = 'chromium' } = request.params;
    
    const playwrightSession = await this.services.containerManager.createPlaywrightSession(sessionId, {
      browser,
      headless: true
    });

    return {
      id: request.id,
      result: playwrightSession
    };
  }

  private async handleDestroySession(request: McpRequest, clientId: string): Promise<McpResponse> {
    const { sessionId } = request.params;
    
    await this.services.sessionManager.destroySession(sessionId);

    return {
      id: request.id,
      result: { success: true }
    };
  }

  private async handleListSessions(request: McpRequest, clientId: string): Promise<McpResponse> {
    const sessions = await this.services.sessionManager.listSessions(clientId);

    return {
      id: request.id,
      result: { sessions }
    };
  }

  private async handleListTools(request: McpRequest, clientId: string): Promise<McpResponse> {
    const tools = [
      {
        name: 'execute_code',
        description: 'Execute code in isolated container environment',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string', enum: ['python', 'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'rust', 'go', 'php', 'perl', 'ruby', 'lua', 'swift', 'objc'] },
            code: { type: 'string' },
            sessionId: { type: 'string', optional: true }
          },
          required: ['language', 'code']
        }
      },
      {
        name: 'create_vscode_session',
        description: 'Create isolated VS Code development environment',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string' },
            template: { type: 'string', optional: true }
          }
        }
      },
      {
        name: 'create_playwright_session',
        description: 'Create browser automation environment',
        inputSchema: {
          type: 'object',
          properties: {
            browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'], default: 'chromium' },
            headless: { type: 'boolean', default: true }
          }
        }
      }
    ];

    return {
      id: request.id,
      result: { tools }
    };
  }

  private async handleToolCall(request: McpRequest, clientId: string): Promise<McpResponse> {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'execute_code':
        return await this.handleExecuteCode({ ...request, params: args }, clientId);
      
      case 'create_vscode_session':
        return await this.handleCreateSession({ 
          ...request, 
          params: { ...args, type: 'vscode' } 
        }, clientId);
      
      case 'create_playwright_session':
        return await this.handleCreateSession({ 
          ...request, 
          params: { ...args, type: 'playwright' } 
        }, clientId);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async cleanup(clientId: string): Promise<void> {
    try {
      const sessions = await this.services.sessionManager.listSessions(clientId);
      for (const session of sessions) {
        await this.services.sessionManager.destroySession(session.id);
      }
    } catch (error) {
      this.logger.error(`Error cleaning up client ${clientId}:`, error);
    }
  }
}
