import Docker from 'dockerode';
import { Logger } from '../utils/Logger';
import { SessionManager } from '../session/SessionManager';
import { 
  ExecutionResult, 
  CodeExecutionParams, 
  PlaywrightSessionConfig, 
  ContainerConfig,
  SUPPORTED_LANGUAGES 
} from '../types/McpTypes';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import PQueue from 'p-queue';
import NodeCache from 'node-cache';

export class ContainerManager {
  private logger = Logger.getInstance();
  private docker: Docker;
  private containers = new Map<string, Docker.Container>();
  private imageCache = new Set<string>();
  private portCache = new Map<number, boolean>();
  private executionQueue: PQueue;
  private containerCache: NodeCache;
  private initialized = false;

  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
      timeout: 30000, // 30 second timeout
      version: 'v1.41' // Specify API version for better performance
    });

    // Initialize execution queue with concurrency limits
    this.executionQueue = new PQueue({
      concurrency: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '10'),
      intervalCap: 50,
      interval: 1000,
      timeout: 60000
    });

    // Cache for container metadata
    this.containerCache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 60
    });

    // Initialize port range cache
    this.initializePortCache();
  }

  async initialize(): Promise<ContainerManager> {
    if (this.initialized) {
      return this;
    }

    const startTime = Date.now();
    this.logger.info('🐳 Initializing Container Manager...');

    try {
      // Test Docker connection
      await this.docker.ping();
      this.logger.info('✅ Docker connection established');

      // Pre-pull critical images in parallel for faster container startup
      await this.prePullImages();

      // Initialize workspace directories
      await this.initializeWorkspaces();

      // Clean up orphaned containers from previous runs
      await this.cleanupOrphanedContainers();

      const initTime = Date.now() - startTime;
      this.logger.info(`✅ Container Manager initialized in ${initTime}ms`);
      
      this.initialized = true;
      return this;

    } catch (error) {
      this.logger.error('❌ Failed to initialize Container Manager:', error);
      throw error;
    }
  }

  private async prePullImages(): Promise<void> {
    const criticalImages = [
      'mcp-python:latest',
      'mcp-javascript:latest', 
      'mcp-vscode:latest',
      'mcp-playwright:latest'
    ];

    this.logger.info('📦 Pre-pulling critical container images...');
    
    const pullPromises = criticalImages.map(async (image) => {
      try {
        // Check if image exists locally first
        const images = await this.docker.listImages({
          filters: { reference: [image] }
        });

        if (images.length === 0) {
          this.logger.info(`Pulling image: ${image}`);
          await this.docker.pull(image);
        }
        
        this.imageCache.add(image);
        this.logger.debug(`✅ Image ready: ${image}`);
      } catch (error) {
        this.logger.warn(`Failed to pull image ${image}:`, error);
      }
    });

    await Promise.allSettled(pullPromises);
  }

  private async initializeWorkspaces(): Promise<void> {
    const workspaceRoot = '/app/sessions';
    
    try {
      await fs.mkdir(workspaceRoot, { recursive: true });
      await fs.chmod(workspaceRoot, 0o755);
      this.logger.debug('✅ Workspace directories initialized');
    } catch (error) {
      this.logger.error('Failed to initialize workspace directories:', error);
      throw error;
    }
  }

  private async cleanupOrphanedContainers(): Promise<void> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ['mcp.session']
        }
      });

      const cleanupPromises = containers.map(async (containerInfo) => {
        try {
          const container = this.docker.getContainer(containerInfo.Id);
          await container.remove({ force: true });
          this.logger.debug(`Cleaned up orphaned container: ${containerInfo.Id}`);
        } catch (error) {
          this.logger.warn(`Failed to cleanup container ${containerInfo.Id}:`, error);
        }
      });

      await Promise.allSettled(cleanupPromises);
      
      if (containers.length > 0) {
        this.logger.info(`🧹 Cleaned up ${containers.length} orphaned containers`);
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup orphaned containers:', error);
    }
  }

  private initializePortCache(): void {
    // Initialize port cache for common port ranges
    const startPort = 8080;
    const endPort = 9999;
    
    for (let port = startPort; port <= endPort; port++) {
      this.portCache.set(port, false); // false = available
    }
  }

  async createExecutionContainer(sessionId: string, language: string): Promise<string> {
    const langConfig = SUPPORTED_LANGUAGES[language];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const containerName = `mcp-exec-${sessionId}`;
    const workspaceDir = `/app/sessions/${sessionId}`;

    // Ensure workspace directory exists
    await fs.mkdir(workspaceDir, { recursive: true });

    const containerConfig: Docker.ContainerCreateOptions = {
      Image: `mcp-${language}:latest`,
      name: containerName,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: true,
      WorkingDir: '/workspace',
      Env: [
        'DEBIAN_FRONTEND=noninteractive',
        'LANG=C.UTF-8',
        'LC_ALL=C.UTF-8'
      ],
      HostConfig: {
        Memory: this.parseMemorySize('5g'),
        CpuQuota: 100000, // 1 CPU
        CpuPeriod: 100000,
        NetworkMode: 'none', // No network access by default
        AutoRemove: false,
        Binds: [
          `${workspaceDir}:/workspace:rw`
        ],
        SecurityOpt: [
          'no-new-privileges:true'
        ],
        ReadonlyRootfs: false,
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=100m'
        }
      },
      Labels: {
        'mcp.session': sessionId,
        'mcp.type': 'execution',
        'mcp.language': language
      }
    };

    try {
      const container = await this.docker.createContainer(containerConfig);
      await container.start();
      
      this.containers.set(sessionId, container);
      this.logger.info(`Created execution container for session ${sessionId}`);
      
      return container.id;
    } catch (error) {
      this.logger.error(`Failed to create execution container for session ${sessionId}:`, error);
      throw error;
    }
  }

  async createVSCodeContainer(sessionId: string, language?: string): Promise<string> {
    const containerName = `mcp-vscode-${sessionId}`;
    const workspaceDir = `/app/sessions/${sessionId}`;
    const port = await this.findAvailablePort(8080);

    await fs.mkdir(workspaceDir, { recursive: true });

    const containerConfig: Docker.ContainerCreateOptions = {
      Image: 'mcp-vscode:latest',
      name: containerName,
      Env: [
        `PASSWORD=${uuidv4()}`,
        'SUDO_PASSWORD=disabled',
        `DEFAULT_WORKSPACE=/workspace`
      ],
      ExposedPorts: {
        '8080/tcp': {}
      },
      HostConfig: {
        Memory: this.parseMemorySize('5g'),
        CpuQuota: 200000, // 2 CPUs for VS Code
        CpuPeriod: 100000,
        PortBindings: {
          '8080/tcp': [{ HostPort: port.toString() }]
        },
        Binds: [
          `${workspaceDir}:/workspace:rw`
        ],
        SecurityOpt: [
          'no-new-privileges:true'
        ]
      },
      Labels: {
        'mcp.session': sessionId,
        'mcp.type': 'vscode',
        'mcp.port': port.toString()
      }
    };

    try {
      const container = await this.docker.createContainer(containerConfig);
      await container.start();
      
      this.containers.set(sessionId, container);
      this.logger.info(`Created VS Code container for session ${sessionId} on port ${port}`);
      
      return container.id;
    } catch (error) {
      this.logger.error(`Failed to create VS Code container for session ${sessionId}:`, error);
      throw error;
    }
  }

  async createPlaywrightContainer(sessionId: string, config: PlaywrightSessionConfig): Promise<string> {
    const containerName = `mcp-playwright-${sessionId}`;
    const workspaceDir = `/app/sessions/${sessionId}`;
    const port = await this.findAvailablePort(9222);

    await fs.mkdir(workspaceDir, { recursive: true });

    const containerConfig: Docker.ContainerCreateOptions = {
      Image: 'mcp-playwright:latest',
      name: containerName,
      Env: [
        `BROWSER=${config.browser}`,
        `HEADLESS=${config.headless}`,
        `VIEWPORT_WIDTH=${config.viewport?.width || 1920}`,
        `VIEWPORT_HEIGHT=${config.viewport?.height || 1080}`
      ],
      ExposedPorts: {
        '9222/tcp': {}
      },
      HostConfig: {
        Memory: this.parseMemorySize('5g'),
        CpuQuota: 200000, // 2 CPUs for browser
        CpuPeriod: 100000,
        PortBindings: {
          '9222/tcp': [{ HostPort: port.toString() }]
        },
        Binds: [
          `${workspaceDir}:/workspace:rw`
        ],
        SecurityOpt: [
          'no-new-privileges:true'
        ],
        ShmSize: 2147483648 // 2GB shared memory for browser
      },
      Labels: {
        'mcp.session': sessionId,
        'mcp.type': 'playwright',
        'mcp.browser': config.browser,
        'mcp.port': port.toString()
      }
    };

    try {
      const container = await this.docker.createContainer(containerConfig);
      await container.start();
      
      this.containers.set(sessionId, container);
      this.logger.info(`Created Playwright container for session ${sessionId} on port ${port}`);
      
      return container.id;
    } catch (error) {
      this.logger.error(`Failed to create Playwright container for session ${sessionId}:`, error);
      throw error;
    }
  }

  async executeCode(sessionId: string, params: CodeExecutionParams): Promise<ExecutionResult> {
    // Use execution queue for better resource management
    return this.executionQueue.add(async () => {
      const container = this.containers.get(sessionId);
      if (!container) {
        throw new Error(`Container not found for session ${sessionId}`);
      }

      const langConfig = SUPPORTED_LANGUAGES[params.language];
      if (!langConfig) {
        throw new Error(`Unsupported language: ${params.language}`);
      }

      const fileName = `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${langConfig.fileExtension}`;
      const filePath = `/workspace/${fileName}`;

      try {
        // Optimize file writing with direct container operations
        const writeCommand = `echo '${params.code.replace(/'/g, "'\\''")}' > ${filePath}`;
        
        const writeExec = await container.exec({
          Cmd: ['sh', '-c', writeCommand],
          AttachStdout: true,
          AttachStderr: true
        });

        await writeExec.start({});

        // Execute the code with enhanced error handling
        const executeCommand = langConfig.executeCommand.replace('{file}', filePath);
        const execRun = await container.exec({
          Cmd: ['sh', '-c', executeCommand],
          AttachStdout: true,
          AttachStderr: true,
          WorkingDir: '/workspace'
        });

        const startTime = Date.now();
        const execStream = await execRun.start({});
        
        let stdout = '';
        let stderr = '';
        const maxOutputSize = 10 * 1024 * 1024; // 10MB max output

        return new Promise<ExecutionResult>((resolve, reject) => {
          const timeout = setTimeout(() => {
            execStream.destroy();
            reject(new Error('Execution timeout exceeded'));
          }, params.timeout || 30000);

          execStream.on('data', (chunk: Buffer) => {
            const header = chunk.readUInt8(0);
            const data = chunk.slice(8).toString();
            
            if (header === 1) { // stdout
              stdout += data;
              if (stdout.length > maxOutputSize) {
                stdout = stdout.slice(0, maxOutputSize) + '\n... (output truncated)';
                execStream.destroy();
                clearTimeout(timeout);
                reject(new Error('Output size limit exceeded'));
                return;
              }
            } else if (header === 2) { // stderr
              stderr += data;
              if (stderr.length > maxOutputSize) {
                stderr = stderr.slice(0, maxOutputSize) + '\n... (error output truncated)';
              }
            }
          });

          execStream.on('end', async () => {
            clearTimeout(timeout);
            const executionTime = Date.now() - startTime;
            
            try {
              const inspectResult = await execRun.inspect();
              
              // Cleanup temporary file asynchronously
              setImmediate(async () => {
                try {
                  const cleanupExec = await container.exec({
                    Cmd: ['rm', '-f', filePath]
                  });
                  await cleanupExec.start({});
                } catch (error) {
                  this.logger.debug(`Failed to cleanup temp file ${filePath}:`, error);
                }
              });

              resolve({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: inspectResult.ExitCode || 0,
                executionTime,
                memoryUsage: await this.getContainerMemoryUsage(container)
              });
            } catch (error) {
              reject(error);
            }
          });

          execStream.on('error', (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
      } catch (error) {
        this.logger.error(`Error executing code in session ${sessionId}:`, error);
        throw error;
      }
    });
  }

  async getVSCodeUrl(sessionId: string): Promise<string> {
    const container = this.containers.get(sessionId);
    if (!container) {
      throw new Error(`VS Code container not found for session ${sessionId}`);
    }

    const info = await container.inspect();
    const port = info.NetworkSettings.Ports['8080/tcp']?.[0]?.HostPort;
    
    if (!port) {
      throw new Error(`VS Code port not found for session ${sessionId}`);
    }

    const host = process.env.HOST_URL || 'localhost';
    return `http://${host}:${port}`;
  }

  async createPlaywrightSession(sessionId: string, config: PlaywrightSessionConfig): Promise<any> {
    const containerId = await this.createPlaywrightContainer(sessionId, config);
    const container = this.containers.get(sessionId);
    
    if (!container) {
      throw new Error(`Playwright container not found for session ${sessionId}`);
    }

    const info = await container.inspect();
    const port = info.NetworkSettings.Ports['9222/tcp']?.[0]?.HostPort;
    
    if (!port) {
      throw new Error(`Playwright port not found for session ${sessionId}`);
    }

    const host = process.env.HOST_URL || 'localhost';
    
    return {
      sessionId,
      browser: config.browser,
      wsEndpoint: `ws://${host}:${port}`,
      httpEndpoint: `http://${host}:${port}`,
      containerId
    };
  }

  async destroyContainer(sessionId: string): Promise<void> {
    const container = this.containers.get(sessionId);
    if (!container) {
      this.logger.warn(`Container not found for session ${sessionId}`);
      return;
    }

    try {
      await container.kill();
      await container.remove();
      this.containers.delete(sessionId);
      
      this.logger.info(`Destroyed container for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error destroying container for session ${sessionId}:`, error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('Starting container cleanup...');
    
    const promises = Array.from(this.containers.keys()).map(sessionId =>
      this.destroyContainer(sessionId).catch(error =>
        this.logger.error(`Error cleaning up container ${sessionId}:`, error)
      )
    );

    await Promise.all(promises);
    this.containers.clear();
    
    this.logger.info('Container cleanup completed');
  }

  private parseMemorySize(size: string): number {
    const unit = size.slice(-1).toLowerCase();
    const value = parseInt(size.slice(0, -1));
    
    switch (unit) {
      case 'g':
        return value * 1024 * 1024 * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'k':
        return value * 1024;
      default:
        return parseInt(size);
    }
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    // Use cached port availability for faster lookups
    for (let port = startPort; port < startPort + 1000; port++) {
      const isUsed = this.portCache.get(port);
      if (isUsed === false) { // Port is available
        this.portCache.set(port, true); // Mark as used
        
        // Verify port is actually available
        try {
          const net = await import('net');
          const server = net.createServer();
          
          await new Promise<void>((resolve, reject) => {
            server.listen(port, (error?: Error) => {
              if (error) {
                reject(error);
              } else {
                server.close();
                resolve();
              }
            });
          });
          
          // Schedule port to be marked available again after 30 seconds
          setTimeout(() => {
            this.portCache.set(port, false);
          }, 30000);
          
          return port;
        } catch (error) {
          // Port is not actually available, continue searching
          this.portCache.set(port, true);
          continue;
        }
      }
    }
    
    // Fallback to random port if cache search fails
    const randomOffset = Math.floor(Math.random() * 1000);
    return startPort + randomOffset;
  }

  private async getContainerMemoryUsage(container: Docker.Container): Promise<number | undefined> {
    try {
      const stats = await container.stats({ stream: false });
      if (stats.memory_stats?.usage) {
        return Math.round(stats.memory_stats.usage / 1024 / 1024); // MB
      }
    } catch (error) {
      this.logger.debug('Failed to get memory usage:', error);
    }
    return undefined;
  }
}
