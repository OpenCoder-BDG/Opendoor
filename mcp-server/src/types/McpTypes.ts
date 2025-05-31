export interface McpRequest {
  id: string | number | null;
  method: string;
  params: any;
}

export interface McpResponse {
  id: string | number | null;
  result?: any;
  error?: McpErrorData;
}

export interface McpError {
  id: string | number | null;
  error: McpErrorData;
}

export interface McpErrorData {
  code: number;
  message: string;
  data?: any;
}

export interface Session {
  id: string;
  type: SessionType;
  language?: string;
  status: SessionStatus;
  containerId?: string;
  endpoints: SessionEndpoints;
  memory: string;
  createdAt: Date;
  lastAccessedAt: Date;
  clientId: string;
}

export type SessionType = 'execution' | 'vscode' | 'playwright';

export type SessionStatus = 'creating' | 'running' | 'stopped' | 'error';

export interface SessionEndpoints {
  main?: string;
  websocket?: string;
  vnc?: string;
}

export interface CreateSessionParams {
  type: SessionType;
  language?: string;
  memory?: string;
  clientId: string;
  template?: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  memoryUsage?: number;
}

export interface CodeExecutionParams {
  code: string;
  language: string;
  timeout?: number;
  stdin?: string;
}

export interface PlaywrightSessionConfig {
  browser: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface ContainerConfig {
  image: string;
  memory: string;
  cpus: string;
  ports: Record<string, number>;
  environment: Record<string, string>;
  volumes: string[];
  networkMode?: string;
}

export interface LanguageConfig {
  name: string;
  version: string;
  dockerfile: string;
  executeCommand: string;
  fileExtension: string;
  packages?: string[];
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  python: {
    name: 'Python',
    version: '3.11',
    dockerfile: 'python',
    executeCommand: 'python',
    fileExtension: '.py',
    packages: ['requests', 'numpy', 'pandas', 'matplotlib', 'seaborn', 'scikit-learn']
  },
  javascript: {
    name: 'JavaScript',
    version: '18',
    dockerfile: 'node',
    executeCommand: 'node',
    fileExtension: '.js',
    packages: ['lodash', 'axios', 'moment', 'uuid']
  },
  typescript: {
    name: 'TypeScript',
    version: '5.2',
    dockerfile: 'node',
    executeCommand: 'npx ts-node',
    fileExtension: '.ts',
    packages: ['typescript', 'ts-node', '@types/node']
  },
  java: {
    name: 'Java',
    version: '17',
    dockerfile: 'openjdk',
    executeCommand: 'java',
    fileExtension: '.java'
  },
  c: {
    name: 'C',
    version: '11',
    dockerfile: 'gcc',
    executeCommand: 'gcc -o /tmp/program {file} && /tmp/program',
    fileExtension: '.c'
  },
  cpp: {
    name: 'C++',
    version: '17',
    dockerfile: 'gcc',
    executeCommand: 'g++ -std=c++17 -o /tmp/program {file} && /tmp/program',
    fileExtension: '.cpp'
  },
  csharp: {
    name: 'C#',
    version: '7.0',
    dockerfile: 'mcr.microsoft.com/dotnet/sdk',
    executeCommand: 'dotnet run',
    fileExtension: '.cs'
  },
  rust: {
    name: 'Rust',
    version: '1.70',
    dockerfile: 'rust',
    executeCommand: 'rustc {file} -o /tmp/program && /tmp/program',
    fileExtension: '.rs'
  },
  go: {
    name: 'Go',
    version: '1.21',
    dockerfile: 'golang',
    executeCommand: 'go run',
    fileExtension: '.go'
  },
  php: {
    name: 'PHP',
    version: '8.2',
    dockerfile: 'php',
    executeCommand: 'php',
    fileExtension: '.php'
  },
  perl: {
    name: 'Perl',
    version: '5.38',
    dockerfile: 'perl',
    executeCommand: 'perl',
    fileExtension: '.pl'
  },
  ruby: {
    name: 'Ruby',
    version: '3.2',
    dockerfile: 'ruby',
    executeCommand: 'ruby',
    fileExtension: '.rb'
  },
  lua: {
    name: 'Lua',
    version: '5.4',
    dockerfile: 'lua',
    executeCommand: 'lua',
    fileExtension: '.lua'
  },
  swift: {
    name: 'Swift',
    version: '5.8',
    dockerfile: 'swift',
    executeCommand: 'swift',
    fileExtension: '.swift'
  },
  objc: {
    name: 'Objective-C',
    version: '2.0',
    dockerfile: 'gcc',
    executeCommand: 'clang -framework Foundation -o /tmp/program {file} && /tmp/program',
    fileExtension: '.m'
  }
};
