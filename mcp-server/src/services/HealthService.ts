import { Logger } from '../utils/Logger';
import Docker from 'dockerode';
import Redis from 'redis';

export class HealthService {
  private logger = Logger.getInstance();
  private docker: Docker;
  private redis: Redis.RedisClientType;

  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
    });
    
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
  }

  async getHealthStatus(): Promise<any> {
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        docker: await this.checkDockerHealth(),
        redis: await this.checkRedisHealth(),
        filesystem: await this.checkFilesystemHealth()
      },
      metrics: {
        active_containers: await this.getActiveContainerCount(),
        memory_usage: this.getMemoryUsage(),
        cpu_usage: await this.getCpuUsage()
      }
    };

    // Determine overall status
    const serviceStatuses = Object.values(status.services);
    if (serviceStatuses.some((s: any) => s.status === 'unhealthy')) {
      status.status = 'unhealthy';
    } else if (serviceStatuses.some((s: any) => s.status === 'degraded')) {
      status.status = 'degraded';
    }

    return status;
  }

  private async checkDockerHealth(): Promise<any> {
    try {
      const info = await this.docker.info();
      return {
        status: 'healthy',
        containers_running: info.ContainersRunning,
        containers_paused: info.ContainersPaused,
        containers_stopped: info.ContainersStopped,
        images: info.Images,
        server_version: info.ServerVersion
      };
    } catch (error) {
      this.logger.error('Docker health check failed:', error);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRedisHealth(): Promise<any> {
    try {
      if (!this.redis.isReady) {
        await this.redis.connect();
      }
      
      const pong = await this.redis.ping();
      const info = await this.redis.info();
      
      return {
        status: 'healthy',
        ping: pong,
        connected_clients: this.extractRedisInfo(info, 'connected_clients'),
        used_memory: this.extractRedisInfo(info, 'used_memory_human'),
        redis_version: this.extractRedisInfo(info, 'redis_version')
      };
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkFilesystemHealth(): Promise<any> {
    try {
      const fs = await import('fs/promises');
      const path = '/app/sessions';
      
      // Check if sessions directory is writable
      await fs.access(path, fs.constants.W_OK);
      
      // Check disk space (simplified check)
      const stats = await fs.stat(path);
      
      return {
        status: 'healthy',
        sessions_directory: path,
        writable: true,
        last_modified: stats.mtime
      };
    } catch (error) {
      this.logger.error('Filesystem health check failed:', error);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getActiveContainerCount(): Promise<number> {
    try {
      const containers = await this.docker.listContainers({
        filters: {
          label: ['mcp.session']
        }
      });
      return containers.length;
    } catch (error) {
      this.logger.error('Failed to get active container count:', error);
      return -1;
    }
  }

  private getMemoryUsage(): any {
    const usage = process.memoryUsage();
    return {
      rss_mb: Math.round(usage.rss / 1024 / 1024),
      heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
      external_mb: Math.round(usage.external / 1024 / 1024)
    };
  }

  private async getCpuUsage(): Promise<any> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        resolve({
          user_microseconds: currentUsage.user,
          system_microseconds: currentUsage.system,
          total_microseconds: currentUsage.user + currentUsage.system
        });
      }, 100);
    });
  }

  private extractRedisInfo(info: string, key: string): string {
    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith(`${key}:`)) {
        return line.split(':')[1];
      }
    }
    return 'unknown';
  }
}
