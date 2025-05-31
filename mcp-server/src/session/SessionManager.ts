import { Session, CreateSessionParams, SessionStatus } from '../types/McpTypes';
import { Logger } from '../utils/Logger';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'redis';

export class SessionManager {
  private logger = Logger.getInstance();
  private redis: Redis.RedisClientType;
  private sessions = new Map<string, Session>();

  constructor() {
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.info('Connected to Redis');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      // Fallback to in-memory storage
    }
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
      // Try Redis first
      if (this.redis.isReady) {
        const sessionData = await this.redis.get(`session:${sessionId}`);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          session.createdAt = new Date(session.createdAt);
          session.lastAccessedAt = new Date(session.lastAccessedAt);
          return session;
        }
      }
      
      // Fallback to memory
      return this.sessions.get(sessionId) || null;
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
      // Remove from Redis
      if (this.redis.isReady) {
        await this.redis.del(`session:${sessionId}`);
      }
      
      // Remove from memory
      this.sessions.delete(sessionId);
      
      this.logger.info(`Session ${sessionId} destroyed`);
    } catch (error) {
      this.logger.error(`Error destroying session ${sessionId}:`, error);
      throw error;
    }
  }

  async listSessions(clientId?: string): Promise<Session[]> {
    try {
      const sessions: Session[] = [];
      
      if (this.redis.isReady) {
        const keys = await this.redis.keys('session:*');
        for (const key of keys) {
          const sessionData = await this.redis.get(key);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            if (!clientId || session.clientId === clientId) {
              session.createdAt = new Date(session.createdAt);
              session.lastAccessedAt = new Date(session.lastAccessedAt);
              sessions.push(session);
            }
          }
        }
      } else {
        // Use in-memory sessions
        for (const session of this.sessions.values()) {
          if (!clientId || session.clientId === clientId) {
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
      if (this.redis.isReady) {
        await this.redis.disconnect();
      }
      this.sessions.clear();
      this.logger.info('Session manager cleanup completed');
    } catch (error) {
      this.logger.error('Error during session manager cleanup:', error);
    }
  }

  private async storeSession(session: Session): Promise<void> {
    try {
      // Store in Redis
      if (this.redis.isReady) {
        await this.redis.setEx(
          `session:${session.id}`,
          24 * 60 * 60, // 24 hours TTL
          JSON.stringify(session)
        );
      }
      
      // Store in memory as fallback
      this.sessions.set(session.id, session);
    } catch (error) {
      this.logger.error(`Error storing session ${session.id}:`, error);
      throw error;
    }
  }
}
