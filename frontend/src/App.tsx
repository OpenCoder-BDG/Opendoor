import React, { useState, useEffect } from 'react';
import { Copy, Check, Server, Code, Globe, Shield, Cpu, HardDrive } from 'lucide-react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import './App.css';

SyntaxHighlighter.registerLanguage('json', json);

interface McpConfig {
  sse_servers: string[];
  stdio_servers: Array<{
    name: string;
    command: string;
    args: string[];
  }>;
  capabilities: {
    tools: any[];
    sessions: any;
    languages: string[];
    memory_per_session: string;
    isolation: string;
    security: any;
  };
  endpoints: {
    base: string;
    sse: string;
    stdio: string;
    health: string;
    sessions: string;
    config: string;
  };
}

function App() {
  const [config, setConfig] = useState<McpConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    fetchConfig();
    fetchHealthStatus();
    
    // Refresh health status every 30 seconds
    const interval = setInterval(fetchHealthStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/config');
      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('/health');
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch health status:', err);
    }
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading MCP Configuration...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  const configJson = JSON.stringify(config, null, 2);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Server className="h-8 w-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold">Enhanced MCP Server</h1>
                <p className="text-gray-400">🤖 LLM-Only Multi-Container Platform</p>
                <p className="text-sm text-yellow-400 font-medium">⚡ Designed for Large Language Models - Not Human Interaction</p>
              </div>
            </div>
            {healthStatus && (
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                healthStatus.status === 'healthy' ? 'bg-green-900 text-green-300' :
                healthStatus.status === 'degraded' ? 'bg-yellow-900 text-yellow-300' :
                'bg-red-900 text-red-300'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  healthStatus.status === 'healthy' ? 'bg-green-400' :
                  healthStatus.status === 'degraded' ? 'bg-yellow-400' :
                  'bg-red-400'
                }`}></div>
                <span className="capitalize">{healthStatus.status}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center space-x-3">
              <Code className="h-8 w-8 text-blue-400" />
              <div>
                <h3 className="text-lg font-semibold">Languages</h3>
                <p className="text-2xl font-bold text-blue-400">{config?.capabilities.languages.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center space-x-3">
              <HardDrive className="h-8 w-8 text-green-400" />
              <div>
                <h3 className="text-lg font-semibold">Memory</h3>
                <p className="text-2xl font-bold text-green-400">{config?.capabilities.memory_per_session}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-purple-400" />
              <div>
                <h3 className="text-lg font-semibold">Isolation</h3>
                <p className="text-lg font-bold text-purple-400">Complete</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center space-x-3">
              <Globe className="h-8 w-8 text-orange-400" />
              <div>
                <h3 className="text-lg font-semibold">Endpoints</h3>
                <p className="text-2xl font-bold text-orange-400">6</p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Section */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">🤖 LLM Connection Configuration</h2>
                <p className="text-gray-400 mt-1">Copy this JSON configuration for LLM programmatic access</p>
                <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                  <p className="text-yellow-300 text-sm font-medium">⚠️ FOR LLMs ONLY - Not for human interaction</p>
                  <p className="text-yellow-200 text-xs mt-1">LLMs connect via SSE/STDIO protocols to execute code, use VS Code, and control browsers</p>
                </div>
              </div>
              <CopyToClipboard text={configJson} onCopy={handleCopy}>
                <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Config</span>
                    </>
                  )}
                </button>
              </CopyToClipboard>
            </div>
          </div>

          <div className="relative">
            <SyntaxHighlighter
              language="json"
              style={atomOneDark}
              customStyle={{
                margin: 0,
                padding: '1.5rem',
                background: 'transparent',
                fontSize: '0.875rem'
              }}
            >
              {configJson}
            </SyntaxHighlighter>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Supported Languages */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Supported Languages</h3>
            <div className="grid grid-cols-3 gap-3">
              {config?.capabilities.languages.map((lang) => (
                <div key={lang} className="bg-gray-700 rounded px-3 py-2 text-sm text-center">
                  {lang}
                </div>
              ))}
            </div>
          </div>

          {/* Session Types */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Session Types</h3>
            <div className="space-y-3">
              {Object.entries(config?.capabilities.sessions || {}).map(([type, info]: [string, any]) => (
                <div key={type} className="bg-gray-700 rounded p-3">
                  <div className="font-medium capitalize">{type}</div>
                  <div className="text-sm text-gray-400 mt-1">{info.description}</div>
                  <div className="text-xs text-blue-400 mt-1">Memory: {info.memory}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">API Endpoints</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(config?.endpoints || {}).map(([name, url]) => (
              <div key={name} className="bg-gray-700 rounded p-3">
                <div className="font-medium capitalize">{name.replace('_', ' ')}</div>
                <div className="text-sm text-blue-400 break-all">{url}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-400">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">🤖 LLM-Exclusive MCP Server</h3>
            <p className="text-gray-300">This server is designed exclusively for Large Language Models to:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
              <div className="bg-gray-700 rounded p-3">
                <strong className="text-green-400">Execute Code</strong><br/>
                15 programming languages with 5GB isolation
              </div>
              <div className="bg-gray-700 rounded p-3">
                <strong className="text-blue-400">Use VS Code</strong><br/>
                Full development environments & tools
              </div>
              <div className="bg-gray-700 rounded p-3">
                <strong className="text-purple-400">Browser Automation</strong><br/>
                Playwright control for web tasks
              </div>
            </div>
            <p className="mt-4 text-yellow-300 font-medium">⚡ LLMs connect programmatically - No human UI needed</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
