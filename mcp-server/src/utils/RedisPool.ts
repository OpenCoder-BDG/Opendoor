import Redis from 'ioredis';
import { Logger } from './Logger';
import { CircuitBreaker, CircuitBreakerFactory } from './CircuitBreaker';

export interface RedisPoolOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
}

export class RedisPool {
  private logger = Logger.getInstance();
  private pool: Redis[] = [];
  private available: Redis[] = [];
  private inUse: Set<Redis> = new Set();
  private options: RedisPoolOptions;
  private circuitBreaker: CircuitBreaker;
  private initialized = false;

  constructor(options: Partial<RedisPoolOptions> = {}) {
    this.options = {
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: options.password || process.env.REDIS_PASSWORD,
      db: options.db || parseInt(process.env.REDIS_DB || '0'),
      maxConnections: options.maxConnections || 10,
      minConnections: options.minConnections || 2,
      acquireTimeoutMillis: options.acquireTimeoutMillis || 5000,
      idleTimeoutMillis: options.idleTimeoutMillis || 300000 // 5 minutes
    };

    this.circuitBreaker = CircuitBreakerFactory.createForDatabase();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.info('🔄 Initializing Redis connection pool...');

    // Create minimum connections
    for (let i = 0; i < this.options.minConnections; i++) {
      const connection = await this.createConnection();
      this.pool.push(connection);
      this.available.push(connection);
    }

    // Start cleanup interval
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Every minute

    this.initialized = true;
    this.logger.info(`✅ Redis pool initialized with ${this.options.minConnections} connections`);
  }

  private async createConnection(): Promise<Redis> {
    const connection = new Redis({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password,
      db: this.options.db,
      // Optimized settings for GCP
      enableAutoPipelining: true,
      maxLoadingTimeout: 5000,
      enableReadyCheck: true,
      keyPrefix: 'mcp:',
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 5000,
      commandTimeout: 3000,
      retryDelayOnFailover: 50,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      family: 4
    });

    // Add connection event handlers
    connection.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
      this.removeConnection(connection);
    });

    connection.on('close', () => {
      this.logger.debug('Redis connection closed');
      this.removeConnection(connection);
    });

    await connection.connect();
    return connection;
  }

  async acquire(): Promise<Redis> {
    return this.circuitBreaker.execute(async () => {
      const startTime = Date.now();
      
      while (Date.now() - startTime < this.options.acquireTimeoutMillis) {
        // Try to get an available connection
        if (this.available.length > 0) {
          const connection = this.available.pop()!;
          this.inUse.add(connection);
          return connection;
        }

        // Create new connection if under max limit
        if (this.pool.length < this.options.maxConnections) {
          const connection = await this.createConnection();
          this.pool.push(connection);
          this.inUse.add(connection);
          return connection;
        }

        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      throw new Error('Redis pool: Timeout acquiring connection');
    });
  }

  release(connection: Redis): void {
    if (!this.inUse.has(connection)) {
      this.logger.warn('Attempting to release connection not in use');
      return;
    }

    this.inUse.delete(connection);
    
    // Check if connection is still healthy
    if (connection.status === 'ready') {
      this.available.push(connection);
    } else {
      this.removeConnection(connection);
    }
  }

  private removeConnection(connection: Redis): void {
    // Remove from all tracking
    this.inUse.delete(connection);
    
    const poolIndex = this.pool.indexOf(connection);
    if (poolIndex !== -1) {
      this.pool.splice(poolIndex, 1);
    }

    const availableIndex = this.available.indexOf(connection);
    if (availableIndex !== -1) {
      this.available.splice(availableIndex, 1);
    }

    // Close the connection
    connection.disconnect();
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: Redis[] = [];

    // Only cleanup if we have more than minimum connections
    if (this.available.length > this.options.minConnections) {
      for (const connection of this.available) {
        // Check if connection has been idle too long
        const lastUsed = (connection as any).lastUsed || now;
        if (now - lastUsed > this.options.idleTimeoutMillis) {
          connectionsToRemove.push(connection);
        }
      }

      // Remove excess idle connections
      const excessConnections = this.available.length - this.options.minConnections;
      const toRemove = Math.min(connectionsToRemove.length, excessConnections);
      
      for (let i = 0; i < toRemove; i++) {
        this.removeConnection(connectionsToRemove[i]);
      }

      if (toRemove > 0) {
        this.logger.debug(`Cleaned up ${toRemove} idle Redis connections`);
      }
    }
  }

  async execute<T>(operation: (redis: Redis) => Promise<T>): Promise<T> {
    const connection = await this.acquire();
    try {
      (connection as any).lastUsed = Date.now();
      return await operation(connection);
    } finally {
      this.release(connection);
    }
  }

  getStats() {
    return {
      total: this.pool.length,
      available: this.available.length,
      inUse: this.inUse.size,
      circuitBreakerState: this.circuitBreaker.getState()
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('🔄 Shutting down Redis pool...');
    
    // Close all connections
    const closePromises = this.pool.map(connection => 
      connection.quit().catch(error => 
        this.logger.warn('Error closing Redis connection:', error)
      )
    );

    await Promise.allSettled(closePromises);
    
    this.pool.length = 0;
    this.available.length = 0;
    this.inUse.clear();
    
    this.logger.info('✅ Redis pool shutdown complete');
  }
}

// Singleton instance for global use
export const redisPool = new RedisPool();