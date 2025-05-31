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

export class ContainerManager {
  private logger = Logger.getInstance();
  private docker: Docker;
  private containers = new Map<string, Docker.Container>();

  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
    });
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
    const container = this.containers.get(sessionId);
    if (!container) {
      throw new Error(`Container not found for session ${sessionId}`);
    }

    const langConfig = SUPPORTED_LANGUAGES[params.language];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${params.language}`);
    }

    const fileName = `code_${Date.now()}${langConfig.fileExtension}`;
    const filePath = `/workspace/${fileName}`;

    try {
      // Write code to file in container
      const exec = await container.exec({
        Cmd: ['sh', '-c', `cat > ${filePath}`],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ 
        hijack: true, 
        stdin: true 
      });

      stream.write(params.code);
      stream.end();

      // Execute the code
      const executeCommand = langConfig.executeCommand.replace('{file}', filePath);
      const execRun = await container.exec({
        Cmd: ['sh', '-c', executeCommand],
        AttachStdout: true,
        AttachStderr: true
      });

      const startTime = Date.now();
      const execStream = await execRun.start({});
      
      let stdout = '';
      let stderr = '';

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Execution timeout'));
        }, params.timeout || 30000);

        execStream.on('data', (chunk: Buffer) => {
          const data = chunk.toString();
          if (chunk[0] === 1) { // stdout
            stdout += data.slice(8);
          } else if (chunk[0] === 2) { // stderr
            stderr += data.slice(8);
          }
        });

        execStream.on('end', async () => {
          clearTimeout(timeout);
          const executionTime = Date.now() - startTime;
          
          try {
            const inspectResult = await execRun.inspect();
            resolve({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: inspectResult.ExitCode || 0,
              executionTime
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
    // Simple port finder - in production, use a proper port finder library
    return startPort + Math.floor(Math.random() * 1000);
  }
}
