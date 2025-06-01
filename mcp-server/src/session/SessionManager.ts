import { Session, CreateSessionParams, SessionStatus } from '../types/McpTypes';
import { Logger } from '../utils/Logger';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import NodeCache from 'node-cache';

export class SessionManager {
  private logger = Logger.getInstance();
  private redis: Redis | null = null;
  private sessions = new Map<string, Session>();
  private cache: NodeCache;
  private initialized = false;

  constructor() {
    // Initialize local cache with 10 minute TTL
    this.cache = new NodeCache({
      stdTTL: 600, // 10 minutes
      checkperiod: 120, // Check for expired keys every 2 minutes
      maxKeys: 10000 // Maximum 10k sessions in cache
    });
  }

  async initialize(): Promise<SessionManager> {
    if (this.initialized) {
      return this;
    }

    try {
      // Initialize Redis with connection pooling and retry logic
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        family: 4,
        connectTimeout: 5000,
        commandTimeout: 3000,
        keepAlive: 30000
      });

      // Test connection
      await this.redis.ping();
      this.logger.info('✅ Redis connected successfully');
      
      // Setup Redis event handlers
      this.redis.on('error', (error) => {
        this.logger.error('Redis connection error:', error);
      });

      this.redis.on('reconnecting', () => {
        this.logger.info('Reconnecting to Redis...');
      });

    } catch (error) {
      this.logger.warn('Redis connection failed, falling back to memory storage:', error);
      this.redis = null;
    }

    this.initialized = true;
    return this;
  }

  async createSession(params: CreateSessionParams): Promise<Session> {
    const sessionId = uuidv4();
    
    const session: Session = {
      id: sessionId,
      type: params.type,
      language: params.language,
      status: 'creating',
      memory: params.memory || '5g',
      endpoints: {},
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      clientId: params.clientId
    };

    // Store session
    await this.storeSession(session);
    
    this.logger.info(`Created session ${sessionId} for client ${params.clientId}`);
    
    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    try {
      // Try cache first (fastest)
      const cachedSession = this.cache.get<Session>(sessionId);
      if (cachedSession) {
        // Update last accessed time
        cachedSession.lastAccessedAt = new Date();
        this.cache.set(sessionId, cachedSession);
        return cachedSession;
      }

      // Try Redis second
      if (this.redis) {
        const sessionData = await this.redis.get(`session:${sessionId}`);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          session.createdAt = new Date(session.createdAt);
          session.lastAccessedAt = new Date(session.lastAccessedAt);
          
          // Cache for future requests
          this.cache.set(sessionId, session);
          return session;
        }
      }
      
      // Fallback to memory
      const memorySession = this.sessions.get(sessionId);
      if (memorySession) {
        memorySession.lastAccessedAt = new Date();
        this.cache.set(sessionId, memorySession);
      }
      
      return memorySession || null;
    } catch (error) {
      this.logger.error(`Error getting session ${sessionId}:`, error);
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession = { 
      ...session, 
      ...updates, 
      lastAccessedAt: new Date() 
    };

    await this.storeSession(updatedSession);
    return updatedSession;
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    await this.updateSession(sessionId, { status });
    this.logger.info(`Session ${sessionId} status updated to ${status}`);
  }

  async setSessionEndpoints(sessionId: string, endpoints: any): Promise<void> {
    await this.updateSession(sessionId, { endpoints });
    this.logger.info(`Session ${sessionId} endpoints updated:`, endpoints);
  }

  async setContainerId(sessionId: string, containerId: string): Promise<void> {
    await this.updateSession(sessionId, { containerId });
    this.logger.info(`Session ${sessionId} container ID set to ${containerId}`);
  }

  async destroySession(sessionId: string): Promise<void> {
    try {
      // Remove from all storage layers
      await Promise.all([
        // Remove from cache
        Promise.resolve(this.cache.del(sessionId)),
        // Remove from Redis
        this.redis ? this.redis.del(`session:${sessionId}`) : Promise.resolve(),
        // Remove from memory
        Promise.resolve(this.sessions.delete(sessionId))
      ]);
      
      this.logger.info(`Session ${sessionId} destroyed`);
    } catch (error) {
      this.logger.error(`Error destroying session ${sessionId}:`, error);
      throw error;
    }
  }

  async listSessions(clientId?: string): Promise<Session[]> {
    try {
      const sessions: Session[] = [];
      const processedSessions = new Set<string>();
      
      // Get from cache first
      const cacheKeys = this.cache.keys();
      for (const sessionId of cacheKeys) {
        const session = this.cache.get<Session>(sessionId);
        if (session && (!clientId || session.clientId === clientId)) {
          sessions.push(session);
          processedSessions.add(sessionId);
        }
      }

      // Get from Redis for sessions not in cache
      if (this.redis) {
        const keys = await this.redis.keys('session:*');
        const pipeline = this.redis.pipeline();
        
        for (const key of keys) {
          const sessionId = key.replace('session:', '');
          if (!processedSessions.has(sessionId)) {
            pipeline.get(key);
          }
        }
        
        const results = await pipeline.exec();
        if (results) {
          for (let i = 0; i < results.length; i++) {
            const [error, sessionData] = results[i];
            if (!error && sessionData) {
              const session = JSON.parse(sessionData as string);
              if (!clientId || session.clientId === clientId) {
                session.createdAt = new Date(session.createdAt);
                session.lastAccessedAt = new Date(session.lastAccessedAt);
                sessions.push(session);
                
                // Cache for future requests
                this.cache.set(session.id, session);
              }
            }
          }
        }
      } else {
        // Use in-memory sessions for those not already processed
        for (const [sessionId, session] of this.sessions.entries()) {
          if (!processedSessions.has(sessionId) && (!clientId || session.clientId === clientId)) {
            sessions.push(session);
          }
        }
      }
      
      return sessions;
    } catch (error) {
      this.logger.error('Error listing sessions:', error);
      return [];
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    const sessions = await this.listSessions();
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const session of sessions) {
      const age = now.getTime() - session.lastAccessedAt.getTime();
      if (age > maxAge) {
        this.logger.info(`Cleaning up expired session ${session.id}`);
        await this.destroySession(session.id);
      }
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.cleanupExpiredSessions();
      
      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }
      
      // Clear all storage
      this.cache.flushAll();
      this.sessions.clear();
      
      this.logger.info('✅ Session manager cleanup completed');
    } catch (error) {
      this.logger.error('Error during session manager cleanup:', error);
    }
  }

  private async storeSession(session: Session): Promise<void> {
    try {
      const sessionTTL = 24 * 60 * 60; // 24 hours
      
      // Store in all layers simultaneously for redundancy and performance
      await Promise.all([
        // Store in cache (fastest access)
        Promise.resolve(this.cache.set(session.id, session, 600)), // 10 minute cache TTL
        // Store in Redis (persistence)
        this.redis ? 
          this.redis.setex(`session:${session.id}`, sessionTTL, JSON.stringify(session)) : 
          Promise.resolve(),
        // Store in memory (fallback)
        Promise.resolve(this.sessions.set(session.id, session))
      ]);
      
    } catch (error) {
      this.logger.error(`Error storing session ${session.id}:`, error);
      throw error;
    }
  }
}
