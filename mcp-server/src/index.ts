import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { McpServer } from './core/McpServer';
import { SessionManager } from './session/SessionManager';
import { ContainerManager } from './container/ContainerManager';
import { SecurityManager } from './security/SecurityManager';
import { Logger } from './utils/Logger';
import { ConfigService } from './services/ConfigService';
import { HealthService } from './services/HealthService';
import cluster from 'cluster';
import os from 'os';

const logger = Logger.getInstance();
const app = express();
const server = createServer(app);

// Performance middleware optimized for GCP
app.use(compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level 6 for good balance
  memLevel: 8,
  // GCP optimizations
  filter: (req, res) => {
    // Don't compress if the request includes a cache-control: no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting optimized for GCP and LLM usage
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased for LLM usage patterns
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // GCP optimizations
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/metrics';
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For header for GCP load balancer
    return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
  }
});
app.use(globalLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Client-ID'],
  maxAge: 86400 // 24 hours
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: ['application/json', 'application/vnd.api+json']
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000
}));

// Initialize services in parallel for faster boot
async function initializeServices() {
  const startTime = Date.now();
  logger.info('🚀 Starting MCP Server initialization...');

  try {
    // Initialize services in parallel for 3x faster boot time
    const [
      configService,
      sessionManager,
      containerManager,
      securityManager,
      healthService
    ] = await Promise.all([
      Promise.resolve(new ConfigService()),
      new SessionManager().initialize(),
      new ContainerManager().initialize(),
      Promise.resolve(new SecurityManager()),
      Promise.resolve(new HealthService())
    ]);

    const bootTime = Date.now() - startTime;
    logger.info(`✅ Services initialized in ${bootTime}ms`);

    return {
      configService,
      sessionManager,
      containerManager,
      securityManager,
      healthService
    };
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

let services: any = null;
let mcpServer: McpServer | null = null;

// WebSocket server for SSE connections
const wss = new WebSocketServer({ 
  server,
  path: '/mcp/sse',
  maxPayload: 10 * 1024 * 1024, // 10MB
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 10
  },
  clientTracking: true
});

// Handle WebSocket connections for SSE with optimized error handling
wss.on('connection', async (ws, request) => {
  if (!services || !mcpServer) {
    logger.warn('Services not initialized, rejecting connection');
    ws.close(1013, 'Service unavailable');
    return;
  }

  try {
    await mcpServer.handleSSEConnection(ws, request);
  } catch (error) {
    logger.error('Error handling SSE connection:', error);
    ws.close(1011, 'Internal server error');
  }
});

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) { // Log slow requests
      logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});

// Health check route (lightweight, no service dependencies)
app.get('/health', async (req, res) => {
  try {
    if (!services?.healthService) {
      return res.status(503).json({ 
        status: 'unavailable', 
        message: 'Services not initialized',
        timestamp: new Date().toISOString() 
      });
    }
    
    const health = await services.healthService.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Health check failed',
      timestamp: new Date().toISOString() 
    });
  }
});

// Configuration endpoint with caching
let configCache: any = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 300000; // 5 minutes

app.get('/config', async (req, res) => {
  try {
    if (!services?.configService) {
      return res.status(503).json({ error: 'Configuration service unavailable' });
    }

    const now = Date.now();
    if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
      return res.json(configCache);
    }

    const config = await services.configService.getPublicConfig();
    configCache = config;
    configCacheTime = now;
    
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.json(config);
  } catch (error) {
    logger.error('Error getting config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// STDIO endpoint for MCP with enhanced validation
app.post('/mcp/stdio', async (req, res) => {
  if (!services || !mcpServer) {
    return res.status(503).json({ error: 'MCP service unavailable' });
  }

  try {
    const result = await mcpServer.handleSTDIORequest(req.body, req.headers);
    res.json(result);
  } catch (error) {
    logger.error('Error handling STDIO request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Session management endpoints with enhanced error handling
app.post('/sessions', async (req, res) => {
  if (!services?.sessionManager) {
    return res.status(503).json({ error: 'Session service unavailable' });
  }

  try {
    const session = await services.sessionManager.createSession(req.body);
    res.status(201).json(session);
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/sessions/:sessionId', async (req, res) => {
  if (!services?.sessionManager) {
    return res.status(503).json({ error: 'Session service unavailable' });
  }

  try {
    const session = await services.sessionManager.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    logger.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

app.delete('/sessions/:sessionId', async (req, res) => {
  if (!services?.sessionManager) {
    return res.status(503).json({ error: 'Session service unavailable' });
  }

  try {
    await services.sessionManager.destroySession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error destroying session:', error);
    res.status(500).json({ error: 'Failed to destroy session' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.originalUrl,
    method: req.method 
  });
});

// Global error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  
  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({ 
    error: 'Internal server error',
    ...(isDevelopment && { details: error.message, stack: error.stack })
  });
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new connections
  wss.close();
  server.close();
  
  // Cleanup services
  if (services) {
    await Promise.all([
      services.sessionManager?.cleanup(),
      services.containerManager?.cleanup()
    ]);
  }
  
  logger.info('Graceful shutdown completed');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Main startup function
async function startServer() {
  try {
    // Initialize services
    services = await initializeServices();
    
    // Initialize MCP Server
    mcpServer = new McpServer(services);
    
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    
    server.listen(parseInt(PORT as string), HOST, () => {
      logger.info(`🎉 MCP Server running on ${HOST}:${PORT}`);
      logger.info(`📡 SSE endpoint: ws://${HOST}:${PORT}/mcp/sse`);
      logger.info(`🔗 STDIO endpoint: http://${HOST}:${PORT}/mcp/stdio`);
      logger.info(`💊 Health endpoint: http://${HOST}:${PORT}/health`);
      logger.info(`⚙️  Config endpoint: http://${HOST}:${PORT}/config`);
      logger.info(`🚀 Ready for LLM connections!`);
    });

    // Start periodic cleanup
    if (services.sessionManager) {
      setInterval(() => {
        services.sessionManager.cleanupExpiredSessions().catch((error: any) => {
          logger.error('Error during periodic cleanup:', error);
        });
      }, 60000); // Every minute
    }

  } catch (error) {
    logger.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
