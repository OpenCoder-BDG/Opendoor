import React, { useState, useEffect } from 'react';
import { 
  Copy, Check, Server, Code, Globe, Shield, Cpu, HardDrive, 
  BookOpen, Terminal, MonitorSpeaker, Zap, Lock, Database,
  Play, Settings, FileCode, Layers, ExternalLink, ChevronDown,
  Github, Heart, Star, Users, Activity, CheckCircle, ArrowRight
} from 'lucide-react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import './App.css';
import { DocSection } from './components/DocSection';

SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('python', python);

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
  const [activeSection, setActiveSection] = useState('overview');

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

  const navigationSections = [
    { id: 'overview', title: 'Overview', icon: BookOpen },
    { id: 'getting-started', title: 'Getting Started', icon: Play },
    { id: 'tools', title: 'Available Tools', icon: Settings },
    { id: 'languages', title: 'Languages', icon: Code },
    { id: 'sessions', title: 'Session Types', icon: Layers },
    { id: 'configuration', title: 'Configuration', icon: FileCode },
    { id: 'examples', title: 'Examples', icon: Terminal },
    { id: 'api', title: 'API Reference', icon: Globe }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Navigation Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Server className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Opendoor MCP
                  </h1>
                  <p className="text-xs text-gray-400">LLM Multi-Container Platform</p>
                </div>
              </div>
            </div>
            
            <nav className="hidden md:flex space-x-1">
              {navigationSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeSection === section.id
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <section.icon className="w-4 h-4 inline mr-2" />
                  {section.title}
                </button>
              ))}
            </nav>

            {healthStatus && (
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                healthStatus.status === 'healthy' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                healthStatus.status === 'degraded' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                'bg-red-500/20 text-red-300 border border-red-500/30'
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DocSection 
          section={activeSection} 
          config={config} 
          onCopy={handleCopy}
          copied={copied}
        />
      </main>
    </div>
  );
}

export default App;
