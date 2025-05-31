import React from 'react';
import { Copy, Check, Server, Code, Globe, Shield, Cpu, HardDrive, 
  BookOpen, Terminal, MonitorSpeaker, Zap, Lock, Database,
  Play, Settings, FileCode, Layers, ExternalLink, ChevronDown,
  Github, Heart, Star, Users, Activity, CheckCircle, ArrowRight
} from 'lucide-react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface DocSectionProps {
  section: string;
  config: any;
  onCopy: () => void;
  copied: boolean;
}

export const DocSection: React.FC<DocSectionProps> = ({ section, config, onCopy, copied }) => {
  const configJson = JSON.stringify(config, null, 2);

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl mb-6">
          <Server className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
          Opendoor MCP
        </h1>
        <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
          A production-ready Multi-Container Platform designed exclusively for Large Language Models 
          to execute code, manage development environments, and control browsers with complete isolation.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg px-6 py-3">
            <div className="flex items-center space-x-2">
              <Code className="w-5 h-5 text-blue-400" />
              <span className="font-medium">15 Languages</span>
            </div>
          </div>
          <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg px-6 py-3">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-purple-400" />
              <span className="font-medium">5GB Memory</span>
            </div>
          </div>
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg px-6 py-3">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="font-medium">Complete Isolation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
            <Code className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Code Execution</h3>
          <p className="text-gray-400">
            Execute code in 15 programming languages with complete isolation and 5GB memory per container.
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
            <MonitorSpeaker className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">VS Code Environments</h3>
          <p className="text-gray-400">
            Full web-based IDE instances with extensions, debugging, and development tools.
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
            <Globe className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Browser Automation</h3>
          <p className="text-gray-400">
            Playwright-powered browser control with Chromium, Firefox, and WebKit support.
          </p>
        </div>
      </div>

      {/* Architecture Overview */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Layers className="w-6 h-6 mr-3 text-blue-400" />
          Architecture Overview
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-purple-400">Core Components</h3>
            <ul className="space-y-3">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mr-3" />
                <span>MCP Server with SSE/STDIO protocols</span>
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mr-3" />
                <span>Container orchestration system</span>
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mr-3" />
                <span>Session management & isolation</span>
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mr-3" />
                <span>Security & resource management</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-400">LLM Integration</h3>
            <ul className="space-y-3">
              <li className="flex items-center">
                <ArrowRight className="w-4 h-4 text-blue-400 mr-3" />
                <span>Direct protocol communication</span>
              </li>
              <li className="flex items-center">
                <ArrowRight className="w-4 h-4 text-blue-400 mr-3" />
                <span>Tool-based interactions</span>
              </li>
              <li className="flex items-center">
                <ArrowRight className="w-4 h-4 text-blue-400 mr-3" />
                <span>Automated resource allocation</span>
              </li>
              <li className="flex items-center">
                <ArrowRight className="w-4 h-4 text-blue-400 mr-3" />
                <span>Real-time session monitoring</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGettingStarted = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Getting Started
        </h1>
        <p className="text-xl text-gray-300">
          Quick setup guide for connecting your LLM to Opendoor MCP
        </p>
      </div>

      {/* Prerequisites */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <CheckCircle className="w-6 h-6 mr-3 text-green-400" />
          Prerequisites
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-blue-400">For Deployment</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Google Cloud Platform account</li>
              <li>• Docker installed locally</li>
              <li>• Terraform v1.0+</li>
              <li>• Node.js v18+</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3 text-purple-400">For LLM Integration</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• MCP-compatible LLM client</li>
              <li>• Network access to server endpoints</li>
              <li>• JSON configuration capability</li>
              <li>• SSE or STDIO protocol support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Start Steps */}
      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-4">1</div>
            <h3 className="text-xl font-semibold">Deploy to GCP</h3>
          </div>
          <SyntaxHighlighter language="bash" style={atomOneDark} customStyle={{ borderRadius: '8px' }}>
{`# Clone repository
git clone https://github.com/ct1tz-bdgz/Opendoor.git
cd Opendoor

# Make scripts executable
chmod +x scripts/*.sh

# Deploy to GCP
./scripts/quick-deploy.sh`}
          </SyntaxHighlighter>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-4">2</div>
            <h3 className="text-xl font-semibold">Get Configuration</h3>
          </div>
          <p className="text-gray-300 mb-4">
            After deployment, visit your frontend URL to copy the JSON configuration for your LLM.
          </p>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              💡 The configuration will be automatically generated with your server's endpoints
            </p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-4">3</div>
            <h3 className="text-xl font-semibold">Connect Your LLM</h3>
          </div>
          <p className="text-gray-300 mb-4">
            Add the configuration to your LLM client and start using the available tools.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <Code className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="font-medium">Execute Code</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <MonitorSpeaker className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="font-medium">Use VS Code</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <Globe className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="font-medium">Control Browsers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfiguration = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          LLM Configuration
        </h1>
        <p className="text-xl text-gray-300">
          Copy this configuration to connect your LLM to Opendoor MCP
        </p>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
        <div className="flex items-center mb-4">
          <Zap className="w-6 h-6 text-yellow-400 mr-3" />
          <h3 className="text-lg font-semibold text-yellow-300">For LLMs Only</h3>
        </div>
        <p className="text-yellow-200">
          This configuration is designed for Large Language Models to connect programmatically. 
          LLMs use SSE/STDIO protocols to execute code, manage development environments, and control browsers.
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">JSON Configuration</h2>
              <p className="text-gray-400 mt-1">Add this to your LLM client configuration</p>
            </div>
            <CopyToClipboard text={configJson} onCopy={onCopy}>
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

      {/* Connection Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 text-blue-400 mr-2" />
            SSE Protocol
          </h3>
          <p className="text-gray-300 mb-4">
            Server-Sent Events for real-time LLM communication with persistent connections.
          </p>
          <div className="bg-gray-800/50 rounded-lg p-3 font-mono text-sm">
            wss://your-server.com/mcp/sse
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Terminal className="w-5 h-5 text-purple-400 mr-2" />
            STDIO Protocol
          </h3>
          <p className="text-gray-300 mb-4">
            Standard I/O for batch LLM operations and command-line integration.
          </p>
          <div className="bg-gray-800/50 rounded-lg p-3 font-mono text-sm">
            https://your-server.com/mcp/stdio
          </div>
        </div>
      </div>
    </div>
  );

  const renderTools = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Available Tools
        </h1>
        <p className="text-xl text-gray-300">
          Comprehensive tools for LLMs to execute code, manage environments, and control browsers
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mr-4">
              <Code className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">execute_code</h3>
              <p className="text-sm text-gray-400">Run code in isolated containers</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-blue-300 mb-2">Parameters</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li><code className="bg-gray-800 px-2 py-1 rounded">language</code> - Programming language (required)</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">code</code> - Code to execute (required)</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">session_id</code> - Optional session ID</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">timeout</code> - Execution timeout (default: 30s)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-300 mb-2">Features</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• 5GB memory isolation per execution</li>
                <li>• 15 programming languages supported</li>
                <li>• Complete container sandboxing</li>
                <li>• Real-time output streaming</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mr-4">
              <MonitorSpeaker className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">create_vscode_session</h3>
              <p className="text-sm text-gray-400">Launch development environments</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-purple-300 mb-2">Parameters</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li><code className="bg-gray-800 px-2 py-1 rounded">language</code> - Primary language</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">template</code> - Project template</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">extensions</code> - VS Code extensions</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-300 mb-2">Features</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• Full VS Code web interface</li>
                <li>• 5GB memory per instance</li>
                <li>• Git integration & terminal</li>
                <li>• Extension marketplace access</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mr-4">
              <Globe className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">create_playwright_session</h3>
              <p className="text-sm text-gray-400">Control browsers programmatically</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-green-300 mb-2">Parameters</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li><code className="bg-gray-800 px-2 py-1 rounded">browser</code> - chromium/firefox/webkit</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">headless</code> - Headless mode (default: true)</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">viewport</code> - Browser viewport size</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-300 mb-2">Features</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• Multiple browser engines</li>
                <li>• Screenshot & PDF generation</li>
                <li>• Network interception</li>
                <li>• Mobile device emulation</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mr-4">
              <Settings className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Session Management</h3>
              <p className="text-sm text-gray-400">Control session lifecycle</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-orange-300 mb-2">Available Actions</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li><code className="bg-gray-800 px-2 py-1 rounded">list_sessions</code> - Get active sessions</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">get_session_info</code> - Session details</li>
                <li><code className="bg-gray-800 px-2 py-1 rounded">destroy_session</code> - Clean up resources</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-300 mb-2">Features</h4>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• Automatic resource cleanup</li>
                <li>• Session persistence</li>
                <li>• Resource monitoring</li>
                <li>• Health status tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLanguages = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Supported Languages
        </h1>
        <p className="text-xl text-gray-300">
          15 programming languages with complete isolation and 5GB memory allocation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { name: 'Python', version: '3.11', icon: '🐍', packages: ['requests', 'numpy', 'pandas', 'matplotlib', 'scikit-learn'] },
          { name: 'JavaScript', version: '18', icon: '🟨', packages: ['lodash', 'axios', 'moment', 'uuid'] },
          { name: 'TypeScript', version: '5.2', icon: '🔷', packages: ['typescript', 'ts-node', '@types/node'] },
          { name: 'Java', version: '17', icon: '☕', packages: ['Maven', 'Gradle'] },
          { name: 'C', version: '11', icon: '⚡', packages: ['GCC', 'Standard Library'] },
          { name: 'C++', version: '17', icon: '🔧', packages: ['STL', 'Boost'] },
          { name: 'C#', version: '7.0', icon: '🟦', packages: ['.NET Core', 'NuGet'] },
          { name: 'Rust', version: '1.70', icon: '🦀', packages: ['Cargo', 'Crates.io'] },
          { name: 'Go', version: '1.21', icon: '🐹', packages: ['Go Modules', 'Standard Library'] },
          { name: 'PHP', version: '8.2', icon: '🐘', packages: ['Composer', 'Modern PHP'] },
          { name: 'Perl', version: '5.38', icon: '🐪', packages: ['CPAN', 'Core Modules'] },
          { name: 'Ruby', version: '3.2', icon: '💎', packages: ['Gems', 'Rails'] },
          { name: 'Lua', version: '5.4', icon: '🌙', packages: ['LuaRocks'] },
          { name: 'Swift', version: '5.8', icon: '🦉', packages: ['Package Manager'] },
          { name: 'Objective-C', version: '2.0', icon: '🍎', packages: ['Foundation'] }
        ].map((lang) => (
          <div key={lang.name} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">{lang.icon}</span>
              <div>
                <h3 className="text-lg font-semibold">{lang.name}</h3>
                <p className="text-sm text-gray-400">Version {lang.version}</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-blue-300 mb-2">Included Packages</h4>
              <div className="flex flex-wrap gap-1">
                {lang.packages.map((pkg) => (
                  <span key={pkg} className="text-xs bg-gray-800 px-2 py-1 rounded">
                    {pkg}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-300 mb-4">Memory & Isolation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">5GB</div>
            <div className="text-sm text-gray-300">Memory per container</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">100%</div>
            <div className="text-sm text-gray-300">Container isolation</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">2 CPUs</div>
            <div className="text-sm text-gray-300">Per execution environment</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExamples = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Usage Examples
        </h1>
        <p className="text-xl text-gray-300">
          Practical examples of how LLMs can use Opendoor MCP tools
        </p>
      </div>

      <div className="space-y-8">
        {/* Code Execution Example */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Code className="w-5 h-5 text-blue-400 mr-2" />
            Code Execution Example
          </h3>
          <p className="text-gray-300 mb-4">
            Execute Python code to analyze data and generate visualizations:
          </p>
          <SyntaxHighlighter language="python" style={atomOneDark} customStyle={{ borderRadius: '8px' }}>
{`# LLM calls execute_code tool
{
  "tool": "execute_code",
  "arguments": {
    "language": "python",
    "code": """
import pandas as pd
import matplotlib.pyplot as plt

# Create sample data
data = {'sales': [100, 150, 120, 200, 180], 
        'month': ['Jan', 'Feb', 'Mar', 'Apr', 'May']}
df = pd.DataFrame(data)

# Generate plot
plt.figure(figsize=(10, 6))
plt.bar(df['month'], df['sales'])
plt.title('Monthly Sales')
plt.savefig('/workspace/sales_chart.png')
print('Chart saved successfully!')
"""
  }
}`}
          </SyntaxHighlighter>
        </div>

        {/* VS Code Session Example */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <MonitorSpeaker className="w-5 h-5 text-purple-400 mr-2" />
            VS Code Development Example
          </h3>
          <p className="text-gray-300 mb-4">
            Create a development environment for a React project:
          </p>
          <SyntaxHighlighter language="javascript" style={atomOneDark} customStyle={{ borderRadius: '8px' }}>
{`// LLM creates VS Code session
{
  "tool": "create_vscode_session",
  "arguments": {
    "language": "typescript",
    "template": "react-app",
    "extensions": [
      "ms-vscode.vscode-typescript-next",
      "esbenp.prettier-vscode",
      "bradlc.vscode-tailwindcss"
    ]
  }
}

// Response includes web IDE URL
{
  "session_id": "vscode-abc123",
  "url": "https://your-server.com/vscode/abc123",
  "status": "running"
}`}
          </SyntaxHighlighter>
        </div>

        {/* Playwright Example */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Globe className="w-5 h-5 text-green-400 mr-2" />
            Browser Automation Example
          </h3>
          <p className="text-gray-300 mb-4">
            Automate web scraping and testing workflows:
          </p>
          <SyntaxHighlighter language="javascript" style={atomOneDark} customStyle={{ borderRadius: '8px' }}>
{`// LLM creates Playwright session
{
  "tool": "create_playwright_session",
  "arguments": {
    "browser": "chromium",
    "headless": true,
    "viewport": {"width": 1920, "height": 1080}
  }
}

// Then executes automation script
{
  "tool": "execute_code",
  "arguments": {
    "language": "python",
    "session_id": "playwright-xyz789",
    "code": """
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('https://example.com')
    
    # Take screenshot
    page.screenshot(path='screenshot.png')
    
    # Extract data
    title = page.title()
    print(f'Page title: {title}')
    
    browser.close()
"""
  }
}`}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );

  switch (section) {
    case 'overview':
      return renderOverview();
    case 'getting-started':
      return renderGettingStarted();
    case 'tools':
      return renderTools();
    case 'languages':
      return renderLanguages();
    case 'configuration':
      return renderConfiguration();
    case 'examples':
      return renderExamples();
    default:
      return renderOverview();
  }
};
