import { IncomingMessage } from 'http';
import { McpRequest } from '../types/McpTypes';
import { Logger } from '../utils/Logger';
import crypto from 'crypto';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export class SecurityManager {
  private logger = Logger.getInstance();
  private allowedOrigins: Set<string>;
  private apiKeys: Set<string>;
  private rateLimiter: RateLimiterMemory;

  constructor() {
    this.allowedOrigins = new Set(
      process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080']
    );
    
    this.apiKeys = new Set(
      process.env.API_KEYS?.split(',') || []
    );

    this.rateLimiter = new RateLimiterMemory({
      keyspace: 'security',
      points: 50, // Number of requests
      duration: 60, // Per 60 seconds
    });
  }

  async validateConnection(request: IncomingMessage): Promise<boolean> {
    try {
      // Rate limiting
      const clientId = this.getClientIdentifier(request);
      await this.rateLimiter.consume(clientId);

      // Origin validation
      const origin = request.headers.origin;
      if (origin && !this.allowedOrigins.has(origin)) {
        this.logger.warn(`Blocked connection from unauthorized origin: ${origin}`);
        return false;
      }

      // API key validation (if required)
      if (this.apiKeys.size > 0) {
        const apiKey = request.headers['x-api-key'] as string;
        if (!apiKey || !this.apiKeys.has(apiKey)) {
          this.logger.warn(`Blocked connection with invalid API key`);
          return false;
        }
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rate limit')) {
        this.logger.warn(`Rate limit exceeded for client`);
        return false;
      }
      
      this.logger.error('Error validating connection:', error);
      return false;
    }
  }

  async validateRequest(request: McpRequest, headers: any): Promise<boolean> {
    try {
      // Rate limiting
      const clientId = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
      await this.rateLimiter.consume(clientId);

      // API key validation (if required)
      if (this.apiKeys.size > 0) {
        const apiKey = headers['x-api-key'];
        if (!apiKey || !this.apiKeys.has(apiKey)) {
          this.logger.warn(`Blocked request with invalid API key`);
          return false;
        }
      }

      // Request validation
      if (!this.isValidMcpRequest(request)) {
        this.logger.warn(`Blocked invalid MCP request`);
        return false;
      }

      // Input sanitization
      this.sanitizeRequest(request);

      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rate limit')) {
        this.logger.warn(`Rate limit exceeded for request`);
        return false;
      }
      
      this.logger.error('Error validating request:', error);
      return false;
    }
  }

  validateCodeExecution(code: string, language: string): { valid: boolean; reason?: string } {
    // Basic code validation rules
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /import\s+.*child_process/,
      /exec\s*\(/,
      /eval\s*\(/,
      /system\s*\(/,
      /shell_exec\s*\(/,
      /passthru\s*\(/,
      /proc_open\s*\(/,
      /popen\s*\(/,
      /file_get_contents\s*\(\s*['"]\/proc\//,
      /file_get_contents\s*\(\s*['"]\/sys\//,
      /file_get_contents\s*\(\s*['"]\/etc\//,
      /__import__\s*\(\s*['"]os['"]\s*\)/,
      /__import__\s*\(\s*['"]subprocess['"]\s*\)/,
      /subprocess\./,
      /os\.system/,
      /os\.popen/,
      /Runtime\.getRuntime\(\)\.exec/,
      /ProcessBuilder/,
      /\$\(/,  // Shell command substitution
      /`[^`]*`/, // Backtick execution
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          valid: false,
          reason: `Potentially dangerous code pattern detected: ${pattern.source}`
        };
      }
    }

    // Language-specific validation
    switch (language) {
      case 'python':
        return this.validatePythonCode(code);
      case 'javascript':
      case 'typescript':
        return this.validateJavaScriptCode(code);
      case 'bash':
      case 'shell':
        return { valid: false, reason: 'Shell execution not allowed' };
      default:
        return { valid: true };
    }
  }

  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  private getClientIdentifier(request: IncomingMessage): string {
    return request.socket.remoteAddress || 
           request.headers['x-forwarded-for'] as string ||
           request.headers['x-real-ip'] as string ||
           'unknown';
  }

  private isValidMcpRequest(request: McpRequest): boolean {
    // Basic MCP request structure validation
    if (typeof request !== 'object' || request === null) {
      return false;
    }

    if (typeof request.method !== 'string' || !request.method) {
      return false;
    }

    if (request.id !== null && 
        typeof request.id !== 'string' && 
        typeof request.id !== 'number') {
      return false;
    }

    return true;
  }

  private sanitizeRequest(request: McpRequest): void {
    // Recursively sanitize request parameters
    if (request.params && typeof request.params === 'object') {
      this.sanitizeObject(request.params);
    }
  }

  private sanitizeObject(obj: any): void {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential script tags and other dangerous content
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]);
      }
    }
  }

  private validatePythonCode(code: string): { valid: boolean; reason?: string } {
    const pythonDangerousPatterns = [
      /import\s+os/,
      /from\s+os\s+import/,
      /import\s+subprocess/,
      /from\s+subprocess\s+import/,
      /import\s+sys/,
      /from\s+sys\s+import/,
      /__builtins__/,
      /compile\s*\(/,
      /globals\s*\(\s*\)/,
      /locals\s*\(\s*\)/,
      /vars\s*\(\s*\)/,
      /dir\s*\(\s*\)/,
      /getattr\s*\(/,
      /setattr\s*\(/,
      /hasattr\s*\(/,
      /delattr\s*\(/,
      /open\s*\(/,
      /file\s*\(/,
      /input\s*\(/,
      /raw_input\s*\(/,
    ];

    for (const pattern of pythonDangerousPatterns) {
      if (pattern.test(code)) {
        return {
          valid: false,
          reason: `Dangerous Python pattern detected: ${pattern.source}`
        };
      }
    }

    return { valid: true };
  }

  private validateJavaScriptCode(code: string): { valid: boolean; reason?: string } {
    const jsDangerousPatterns = [
      /require\s*\(/,
      /import\s*\(/,
      /new\s+Function\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /XMLHttpRequest/,
      /fetch\s*\(/,
      /window\./,
      /document\./,
      /global\./,
      /process\./,
      /Buffer\./,
      /__dirname/,
      /__filename/,
    ];

    for (const pattern of jsDangerousPatterns) {
      if (pattern.test(code)) {
        return {
          valid: false,
          reason: `Dangerous JavaScript pattern detected: ${pattern.source}`
        };
      }
    }

    return { valid: true };
  }
}
