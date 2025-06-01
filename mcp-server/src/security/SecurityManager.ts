import { IncomingMessage } from 'http';
import { McpRequest } from '../types/McpTypes';
import { Logger } from '../utils/Logger';
import crypto from 'crypto';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import Joi from 'joi';
import NodeCache from 'node-cache';

export class SecurityManager {
  private logger = Logger.getInstance();
  private allowedOrigins: Set<string>;
  private apiKeys: Set<string>;
  private rateLimiter: RateLimiterMemory;
  private validationCache: NodeCache;
  private requestSchema: Joi.ObjectSchema;
  private codePatternCache = new Map<string, RegExp>();

  constructor() {
    this.allowedOrigins = new Set(
      process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080']
    );
    
    this.apiKeys = new Set(
      process.env.API_KEYS?.split(',') || []
    );

    // Enhanced rate limiting with different tiers
    this.rateLimiter = new RateLimiterMemory({
      keyspace: 'security',
      points: parseInt(process.env.RATE_LIMIT_POINTS || '100'), 
      duration: 60, // Per 60 seconds
      blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION || '300'), // 5 minutes block
    });

    // Cache for validation results
    this.validationCache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 60
    });

    // Joi schema for request validation
    this.requestSchema = Joi.object({
      id: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.allow(null)).required(),
      method: Joi.string().required().pattern(/^[a-zA-Z_\/]+$/),
      params: Joi.object().unknown(true).optional()
    });

    // Pre-compile dangerous patterns for performance
    this.initializeDangerousPatterns();
  }

  private initializeDangerousPatterns(): void {
    const patterns = [
      'child_process',
      'subprocess',
      'os\\.system',
      'eval\\s*\\(',
      'exec\\s*\\(',
      'shell_exec',
      '__import__.*os',
      'Runtime\\.getRuntime',
      'ProcessBuilder'
    ];

    patterns.forEach(pattern => {
      this.codePatternCache.set(pattern, new RegExp(pattern, 'i'));
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
    // Check validation cache first
    const cacheKey = crypto.createHash('md5').update(code + language).digest('hex');
    const cached = this.validationCache.get<{ valid: boolean; reason?: string }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Enhanced code validation with performance optimization
    const result = this.performCodeValidation(code, language);
    
    // Cache the result
    this.validationCache.set(cacheKey, result);
    
    return result;
  }

  private performCodeValidation(code: string, language: string): { valid: boolean; reason?: string } {
    // Use pre-compiled patterns for better performance
    for (const [patternName, regex] of this.codePatternCache) {
      if (regex.test(code)) {
        return {
          valid: false,
          reason: `Dangerous pattern detected: ${patternName}`
        };
      }
    }

    // Additional pattern checks
    const additionalPatterns = [
      { pattern: /\$\(/, reason: 'Shell command substitution not allowed' },
      { pattern: /`[^`]*`/, reason: 'Backtick execution not allowed' },
      { pattern: /file_get_contents\s*\(\s*['"]\/(?:proc|sys|etc)\//, reason: 'System file access not allowed' },
      { pattern: /open\s*\(\s*['"]\/(?:dev|proc|sys)\//, reason: 'System device access not allowed' }
    ];

    for (const { pattern, reason } of additionalPatterns) {
      if (pattern.test(code)) {
        return { valid: false, reason };
      }
    }

    // Language-specific validation with enhanced checks
    switch (language.toLowerCase()) {
      case 'python':
        return this.validatePythonCode(code);
      case 'javascript':
      case 'typescript':
        return this.validateJavaScriptCode(code);
      case 'bash':
      case 'shell':
      case 'sh':
        return { valid: false, reason: 'Shell execution not allowed' };
      case 'java':
        return this.validateJavaCode(code);
      case 'c':
      case 'cpp':
      case 'c++':
        return this.validateCCode(code);
      default:
        return { valid: true };
    }
  }

  private validateJavaCode(code: string): { valid: boolean; reason?: string } {
    const javaPatterns = [
      { pattern: /Runtime\.getRuntime\(\)/, reason: 'Runtime access not allowed' },
      { pattern: /ProcessBuilder/, reason: 'Process creation not allowed' },
      { pattern: /System\.exit/, reason: 'System exit not allowed' },
      { pattern: /new\s+File\s*\(\s*['"]\//, reason: 'Absolute file paths not allowed' },
      { pattern: /FileInputStream.*\//, reason: 'System file access not allowed' }
    ];

    for (const { pattern, reason } of javaPatterns) {
      if (pattern.test(code)) {
        return { valid: false, reason };
      }
    }

    return { valid: true };
  }

  private validateCCode(code: string): { valid: boolean; reason?: string } {
    const cPatterns = [
      { pattern: /system\s*\(/, reason: 'System calls not allowed' },
      { pattern: /popen\s*\(/, reason: 'Process creation not allowed' },
      { pattern: /execv?e?\s*\(/, reason: 'Exec functions not allowed' },
      { pattern: /#include\s*<unistd\.h>/, reason: 'Unix system headers not allowed' },
      { pattern: /fork\s*\(/, reason: 'Process forking not allowed' }
    ];

    for (const { pattern, reason } of cPatterns) {
      if (pattern.test(code)) {
        return { valid: false, reason };
      }
    }

    return { valid: true };
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
    try {
      const { error } = this.requestSchema.validate(request);
      return !error;
    } catch (validationError) {
      this.logger.warn('Request validation error:', validationError);
      return false;
    }
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
