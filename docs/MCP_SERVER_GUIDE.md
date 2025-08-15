# MCP Server Implementation Guide

## Overview

This guide covers building the MCP (Model Context Protocol) server that bridges AI assistants with your Chrome extension.

## Server Structure

```
server/
├── src/
│   ├── index.ts           # Entry point
│   ├── mcp-server.ts      # MCP protocol implementation
│   ├── native-host.ts     # Native messaging handler
│   ├── tool-registry.ts   # Tool management
│   └── tools/             # Tool implementations
│       ├── index.ts
│       ├── navigate.ts
│       ├── click.ts
│       └── ...
├── package.json
├── tsconfig.json
└── native-host-manifest.json
```

## Step 1: Initialize Project

```bash
mkdir server
cd server
npm init -y
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node tsx nodemon
```

## Step 2: MCP Server Implementation

### Main Server Entry (index.ts)

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from './mcp-server.js';
import { NativeHost } from './native-host.js';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args[0] || 'stdio';
  
  if (mode === 'stdio') {
    // MCP over stdio mode
    await startStdioServer();
  } else if (mode === 'native') {
    // Native messaging mode
    await startNativeHost();
  } else if (mode === 'http') {
    // HTTP server mode (for debugging)
    await startHttpServer();
  }
}

async function startStdioServer() {
  const server = new McpServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  console.error('MCP server started in stdio mode');
}

async function startNativeHost() {
  const host = new NativeHost();
  await host.start();
  console.error('Native host started');
}

async function startHttpServer() {
  // HTTP implementation for debugging
  const { createServer } = await import('http');
  const server = new McpServer();
  
  const httpServer = createServer((req, res) => {
    // Handle HTTP requests
  });
  
  httpServer.listen(3000, () => {
    console.error('HTTP server listening on port 3000');
  });
}

main().catch(console.error);
```

### MCP Server Core (mcp-server.ts)

```typescript
// src/mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from './tool-registry.js';
import { NativeMessenger } from './native-messenger.js';

export class McpServer {
  private server: Server;
  private toolRegistry: ToolRegistry;
  private nativeMessenger: NativeMessenger;
  
  constructor() {
    this.server = new Server(
      {
        name: 'chrome-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.toolRegistry = new ToolRegistry();
    this.nativeMessenger = new NativeMessenger();
    
    this.setupHandlers();
    this.registerTools();
  }
  
  private setupHandlers() {
    // Handle tool list requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolRegistry.getToolDefinitions(),
      };
    });
    
    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // Validate tool exists
        const tool = this.toolRegistry.getTool(name);
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`);
        }
        
        // Validate parameters
        const validatedParams = tool.validateParams(args);
        
        // Execute tool via native messaging
        const result = await this.nativeMessenger.sendCommand(name, validatedParams);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }
  
  private registerTools() {
    // Navigation tools
    this.toolRegistry.register({
      name: 'navigate',
      description: 'Navigate to a URL in the browser',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID to navigate',
          },
        },
        required: ['url'],
      },
    });
    
    // Click tool
    this.toolRegistry.register({
      name: 'click',
      description: 'Click an element on the page',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to click',
          },
        },
        required: ['selector'],
      },
    });
    
    // Screenshot tool
    this.toolRegistry.register({
      name: 'screenshot',
      description: 'Take a screenshot of the page',
      inputSchema: {
        type: 'object',
        properties: {
          fullPage: {
            type: 'boolean',
            description: 'Capture full page (default: false)',
          },
          selector: {
            type: 'string',
            description: 'CSS selector for element screenshot',
          },
        },
      },
    });
    
    // Form filling tool
    this.toolRegistry.register({
      name: 'fill_input',
      description: 'Fill an input field with text',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the input field',
          },
          value: {
            type: 'string',
            description: 'Value to fill in the input',
          },
        },
        required: ['selector', 'value'],
      },
    });
    
    // Scroll tool
    this.toolRegistry.register({
      name: 'scroll',
      description: 'Scroll the page',
      inputSchema: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down', 'left', 'right', 'top', 'bottom'],
            description: 'Scroll direction',
          },
          amount: {
            type: 'number',
            description: 'Pixels to scroll (default: 500)',
          },
          selector: {
            type: 'string',
            description: 'Scroll to element with this selector',
          },
        },
      },
    });
    
    // Content extraction tool
    this.toolRegistry.register({
      name: 'get_content',
      description: 'Get page content as text or HTML',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['text', 'html', 'outerHTML'],
            description: 'Type of content to extract',
          },
          selector: {
            type: 'string',
            description: 'CSS selector for specific element',
          },
        },
      },
    });
    
    // Tab management tools
    this.toolRegistry.register({
      name: 'get_tabs',
      description: 'Get list of open browser tabs',
      inputSchema: {
        type: 'object',
        properties: {
          currentWindow: {
            type: 'boolean',
            description: 'Only tabs in current window',
          },
        },
      },
    });
    
    this.toolRegistry.register({
      name: 'close_tab',
      description: 'Close a browser tab',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'ID of tab to close',
          },
        },
        required: ['tabId'],
      },
    });
    
    // Browser navigation tools
    this.toolRegistry.register({
      name: 'go_back',
      description: 'Navigate back in browser history',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    });
    
    this.toolRegistry.register({
      name: 'go_forward',
      description: 'Navigate forward in browser history',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    });
  }
  
  async connect(transport: any) {
    await this.server.connect(transport);
    await this.nativeMessenger.connect();
  }
  
  async close() {
    await this.nativeMessenger.disconnect();
    await this.server.close();
  }
}
```

### Native Messenger (native-messenger.ts)

```typescript
// src/native-messenger.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class NativeMessenger extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private connected: boolean = false;
  private messageBuffer: Buffer = Buffer.alloc(0);
  
  async connect() {
    if (this.connected) return;
    
    try {
      // Spawn Chrome with native messaging
      this.process = spawn('chrome', [
        '--enable-native-messaging',
        'com.chrome_mcp.host'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.setupListeners();
      this.connected = true;
      
      console.error('Native messenger connected');
    } catch (error) {
      console.error('Failed to connect native messenger:', error);
      throw error;
    }
  }
  
  private setupListeners() {
    if (!this.process) return;
    
    // Handle incoming messages
    this.process.stdout?.on('data', (data: Buffer) => {
      this.messageBuffer = Buffer.concat([this.messageBuffer, data]);
      this.processMessages();
    });
    
    // Handle errors
    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('Native messenger error:', data.toString());
    });
    
    // Handle process exit
    this.process.on('exit', (code) => {
      console.error(`Native messenger exited with code ${code}`);
      this.connected = false;
      this.emit('disconnect');
    });
  }
  
  private processMessages() {
    while (this.messageBuffer.length >= 4) {
      // Native messaging format: 4-byte length + JSON message
      const messageLength = this.messageBuffer.readUInt32LE(0);
      
      if (this.messageBuffer.length < 4 + messageLength) {
        // Not enough data yet
        break;
      }
      
      // Extract message
      const messageData = this.messageBuffer.slice(4, 4 + messageLength);
      this.messageBuffer = this.messageBuffer.slice(4 + messageLength);
      
      try {
        const message = JSON.parse(messageData.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    }
  }
  
  private handleMessage(message: any) {
    const { id, data, error } = message;
    
    if (id && this.messageHandlers.has(id)) {
      const handler = this.messageHandlers.get(id)!;
      this.messageHandlers.delete(id);
      
      if (error) {
        handler({ success: false, error });
      } else {
        handler(data);
      }
    }
    
    this.emit('message', message);
  }
  
  async sendCommand(action: string, params: any): Promise<any> {
    if (!this.connected || !this.process) {
      throw new Error('Native messenger not connected');
    }
    
    return new Promise((resolve, reject) => {
      const messageId = this.generateId();
      
      const message = {
        id: messageId,
        action,
        params,
        timestamp: Date.now()
      };
      
      // Register handler for response
      this.messageHandlers.set(messageId, (response) => {
        if (response.success === false) {
          reject(new Error(response.error || 'Command failed'));
        } else {
          resolve(response);
        }
      });
      
      // Send message
      this.sendMessage(message);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          reject(new Error('Command timeout'));
        }
      }, 30000);
    });
  }
  
  private sendMessage(message: any) {
    if (!this.process?.stdin) {
      throw new Error('No stdin available');
    }
    
    const json = JSON.stringify(message);
    const buffer = Buffer.from(json);
    
    // Write length header (4 bytes)
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32LE(buffer.length, 0);
    
    // Write message
    this.process.stdin.write(lengthBuffer);
    this.process.stdin.write(buffer);
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    
    this.connected = false;
    this.messageHandlers.clear();
  }
}
```

### Tool Registry (tool-registry.ts)

```typescript
// src/tool-registry.ts
import { z } from 'zod';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

interface Tool {
  definition: ToolDefinition;
  validateParams: (params: any) => any;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  
  register(definition: ToolDefinition) {
    // Create Zod schema from JSON schema
    const schema = this.createZodSchema(definition.inputSchema);
    
    const tool: Tool = {
      definition,
      validateParams: (params: any) => {
        try {
          return schema.parse(params);
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(`Invalid parameters: ${error.message}`);
          }
          throw error;
        }
      }
    };
    
    this.tools.set(definition.name, tool);
  }
  
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }
  
  private createZodSchema(jsonSchema: any): z.ZodSchema {
    // Simplified JSON Schema to Zod conversion
    // In production, use a proper converter library
    
    if (jsonSchema.type === 'object') {
      const shape: any = {};
      
      for (const [key, value] of Object.entries(jsonSchema.properties || {})) {
        const propSchema: any = value;
        
        if (propSchema.type === 'string') {
          shape[key] = propSchema.enum 
            ? z.enum(propSchema.enum as any)
            : z.string();
        } else if (propSchema.type === 'number') {
          shape[key] = z.number();
        } else if (propSchema.type === 'boolean') {
          shape[key] = z.boolean();
        } else {
          shape[key] = z.any();
        }
        
        // Handle optional fields
        if (!jsonSchema.required?.includes(key)) {
          shape[key] = shape[key].optional();
        }
      }
      
      return z.object(shape);
    }
    
    return z.any();
  }
}
```

## Step 3: HTTP Server Mode (Optional)

For easier debugging, implement an HTTP server mode:

```typescript
// src/http-server.ts
import { createServer } from 'http';
import { McpServer } from './mcp-server.js';

export class HttpMcpServer {
  private server: McpServer;
  private httpServer: any;
  
  constructor() {
    this.server = new McpServer();
  }
  
  async start(port: number = 3000) {
    this.httpServer = createServer(async (req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            const request = JSON.parse(body);
            const response = await this.handleRequest(request);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: error.message
            }));
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    return new Promise<void>((resolve) => {
      this.httpServer.listen(port, () => {
        console.log(`HTTP MCP server listening on port ${port}`);
        resolve();
      });
    });
  }
  
  private async handleRequest(request: any) {
    // Route to appropriate handler based on request method
    const { method, params } = request;
    
    switch (method) {
      case 'tools/list':
        return await this.server.listTools();
        
      case 'tools/call':
        return await this.server.callTool(params.name, params.arguments);
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }
  
  async stop() {
    if (this.httpServer) {
      this.httpServer.close();
    }
    await this.server.close();
  }
}
```

## Step 4: Development Scripts

Add to package.json:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "start:stdio": "node dist/index.js stdio",
    "start:http": "node dist/index.js http",
    "start:native": "node dist/index.js native"
  }
}
```

## Testing the Server

### 1. Test with HTTP Mode

```bash
npm run dev http
# Server starts on port 3000

# Test with curl:
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","params":{}}'
```

### 2. Test with stdio Mode

```bash
npm run dev stdio
# Then send JSON-RPC messages via stdin
```

### 3. Test with MCP Client

Configure your MCP client (Claude, etc.) with:

```json
{
  "mcpServers": {
    "chrome": {
      "command": "node",
      "args": ["/path/to/dist/index.js", "stdio"]
    }
  }
}
```

## Error Handling

Implement comprehensive error handling:

```typescript
class ErrorHandler {
  static handle(error: unknown): { success: false; error: string } {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: false,
      error: 'Unknown error occurred'
    };
  }
  
  static async wrapAsync<T>(
    fn: () => Promise<T>
  ): Promise<T | { success: false; error: string }> {
    try {
      return await fn();
    } catch (error) {
      return this.handle(error);
    }
  }
}
```

## Best Practices

1. **Type Safety**: Use TypeScript strictly
2. **Validation**: Validate all inputs with Zod
3. **Logging**: Log all operations for debugging
4. **Timeouts**: Set timeouts for all async operations
5. **Cleanup**: Properly close connections on shutdown
6. **Testing**: Write unit tests for each tool