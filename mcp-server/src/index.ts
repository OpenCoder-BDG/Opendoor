import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { McpServer } from './core/McpServer';
import { SessionManager } from './session/SessionManager';
import { ContainerManager } from './container/ContainerManager';
import { SecurityManager } from './security/SecurityManager';
import { Logger } from './utils/Logger';
import { ConfigService } from './services/ConfigService';
import { HealthService } from './services/HealthService';

const logger = Logger.getInstance();
const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize core services
const configService = new ConfigService();
const sessionManager = new SessionManager();
const containerManager = new ContainerManager();
const securityManager = new SecurityManager();
const healthService = new HealthService();

// Initialize MCP Server
const mcpServer = new McpServer({
  sessionManager,
  containerManager,
  securityManager,
  configService
});

// WebSocket server for SSE connections
const wss = new WebSocketServer({ 
  server,
  path: '/mcp/sse',
  maxPayload: 10 * 1024 * 1024 // 10MB
});

// Handle WebSocket connections for SSE
wss.on('connection', async (ws, request) => {
  try {
    await mcpServer.handleSSEConnection(ws, request);
  } catch (error) {
    logger.error('Error handling SSE connection:', error);
    ws.close(1011, 'Internal server error');
  }
});

// REST API routes
app.get('/health', healthService.getHealthStatus.bind(healthService));
app.get('/config', async (req, res) => {
  try {
    const config = await configService.getPublicConfig();
    res.json(config);
  } catch (error) {
    logger.error('Error getting config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// STDIO endpoint for MCP
app.post('/mcp/stdio', async (req, res) => {
  try {
    const result = await mcpServer.handleSTDIORequest(req.body, req.headers);
    res.json(result);
  } catch (error) {
    logger.error('Error handling STDIO request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Session management endpoints
app.post('/sessions', async (req, res) => {
  try {
    const session = await sessionManager.createSession(req.body);
    res.json(session);
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await sessionManager.getSession(req.params.sessionId);
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
  try {
    await sessionManager.destroySession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error destroying session:', error);
    res.status(500).json({ error: 'Failed to destroy session' });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  wss.close();
  server.close();
  
  await sessionManager.cleanup();
  await containerManager.cleanup();
  
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`MCP Server running on port ${PORT}`);
  logger.info(`SSE endpoint: ws://localhost:${PORT}/mcp/sse`);
  logger.info(`STDIO endpoint: http://localhost:${PORT}/mcp/stdio`);
});
