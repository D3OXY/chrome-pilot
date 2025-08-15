# Code Templates

Ready-to-use TypeScript code templates for building your Chrome MCP server.

## Complete Tool Implementation Template

```typescript
// tools/complete-tool-template.ts

import { z } from 'zod';
import { BaseTool } from './base-tool';

// Define input schema
const InputSchema = z.object({
  requiredParam: z.string().describe('Description of required parameter'),
  optionalParam: z.number().optional().describe('Optional parameter'),
  enumParam: z.enum(['option1', 'option2', 'option3']).optional(),
});

type Input = z.infer<typeof InputSchema>;

export class MyTool extends BaseTool<Input> {
  name = 'my_tool';
  description = 'Description of what this tool does';
  
  inputSchema = {
    type: 'object',
    properties: {
      requiredParam: {
        type: 'string',
        description: 'Description of required parameter',
      },
      optionalParam: {
        type: 'number',
        description: 'Optional parameter',
      },
      enumParam: {
        type: 'string',
        enum: ['option1', 'option2', 'option3'],
        description: 'Parameter with specific options',
      },
    },
    required: ['requiredParam'],
  };
  
  async execute(input: Input): Promise<any> {
    try {
      // Validate input
      const validated = InputSchema.parse(input);
      
      // Send command to extension
      const result = await this.sendToExtension('my_action', {
        param1: validated.requiredParam,
        param2: validated.optionalParam || 'default',
      });
      
      // Process result
      if (!result.success) {
        throw new Error(result.error || 'Tool execution failed');
      }
      
      return {
        success: true,
        data: result.data,
        message: `Successfully executed with ${validated.requiredParam}`,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
```

## Base Tool Class

```typescript
// tools/base-tool.ts

export abstract class BaseTool<TInput = any> {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: any;
  
  protected nativeMessenger: NativeMessenger;
  
  constructor(nativeMessenger: NativeMessenger) {
    this.nativeMessenger = nativeMessenger;
  }
  
  abstract execute(input: TInput): Promise<any>;
  
  protected async sendToExtension(action: string, params: any): Promise<any> {
    return await this.nativeMessenger.sendCommand(action, params);
  }
  
  protected handleError(error: unknown): { success: false; error: string } {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    
    return {
      success: false,
      error: 'Unknown error occurred',
    };
  }
  
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    );
    
    return Promise.race([promise, timeout]);
  }
  
  protected async retry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }
}
```

## Browser Automation Tools

### Navigate Tool

```typescript
// tools/navigate.ts

import { z } from 'zod';
import { BaseTool } from './base-tool';

const NavigateInput = z.object({
  url: z.string().url().describe('The URL to navigate to'),
  tabId: z.number().optional().describe('Tab ID to navigate (optional)'),
  waitForLoad: z.boolean().default(true).describe('Wait for page to load'),
});

export class NavigateTool extends BaseTool<z.infer<typeof NavigateInput>> {
  name = 'navigate';
  description = 'Navigate to a URL in the browser';
  
  inputSchema = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to navigate to' },
      tabId: { type: 'number', description: 'Tab ID to navigate (optional)' },
      waitForLoad: { type: 'boolean', description: 'Wait for page to load' },
    },
    required: ['url'],
  };
  
  async execute(input: z.infer<typeof NavigateInput>) {
    const validated = NavigateInput.parse(input);
    
    const result = await this.sendToExtension('navigate', {
      url: validated.url,
      tabId: validated.tabId,
      waitForLoad: validated.waitForLoad,
    });
    
    if (result.success) {
      return {
        success: true,
        tabId: result.tabId,
        url: result.url,
        title: result.title,
      };
    }
    
    return this.handleError(new Error(result.error));
  }
}
```

### Click Tool

```typescript
// tools/click.ts

import { z } from 'zod';
import { BaseTool } from './base-tool';

const ClickInput = z.object({
  selector: z.string().describe('CSS selector for element to click'),
  tabId: z.number().optional().describe('Tab ID (uses active tab if not specified)'),
  waitForElement: z.boolean().default(true).describe('Wait for element to appear'),
  scrollIntoView: z.boolean().default(true).describe('Scroll element into view'),
});

export class ClickTool extends BaseTool<z.infer<typeof ClickInput>> {
  name = 'click';
  description = 'Click an element on the page';
  
  inputSchema = {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector for element' },
      tabId: { type: 'number', description: 'Tab ID (optional)' },
      waitForElement: { type: 'boolean', description: 'Wait for element' },
      scrollIntoView: { type: 'boolean', description: 'Scroll into view' },
    },
    required: ['selector'],
  };
  
  async execute(input: z.infer<typeof ClickInput>) {
    const validated = ClickInput.parse(input);
    
    // Ensure content script is injected
    if (!validated.tabId) {
      const tabs = await this.sendToExtension('get_active_tab', {});
      validated.tabId = tabs.data?.id;
    }
    
    await this.sendToExtension('inject_content_script', {
      tabId: validated.tabId,
    });
    
    // Execute click
    const result = await this.sendToExtension('click_element', {
      selector: validated.selector,
      tabId: validated.tabId,
      scrollIntoView: validated.scrollIntoView,
    });
    
    return result;
  }
}
```

### Screenshot Tool

```typescript
// tools/screenshot.ts

import { z } from 'zod';
import { BaseTool } from './base-tool';

const ScreenshotInput = z.object({
  fullPage: z.boolean().default(false).describe('Capture full page'),
  selector: z.string().optional().describe('Element selector for partial screenshot'),
  format: z.enum(['png', 'jpeg']).default('png').describe('Image format'),
  quality: z.number().min(0).max(100).default(90).describe('JPEG quality'),
});

export class ScreenshotTool extends BaseTool<z.infer<typeof ScreenshotInput>> {
  name = 'screenshot';
  description = 'Take a screenshot of the page or element';
  
  inputSchema = {
    type: 'object',
    properties: {
      fullPage: { type: 'boolean', description: 'Capture full page' },
      selector: { type: 'string', description: 'Element selector' },
      format: { type: 'string', enum: ['png', 'jpeg'] },
      quality: { type: 'number', minimum: 0, maximum: 100 },
    },
  };
  
  async execute(input: z.infer<typeof ScreenshotInput>) {
    const validated = ScreenshotInput.parse(input);
    
    const result = await this.sendToExtension('screenshot', {
      fullPage: validated.fullPage,
      selector: validated.selector,
      format: validated.format,
      quality: validated.quality,
    });
    
    if (result.success) {
      return {
        success: true,
        dataUrl: result.dataUrl,
        width: result.width,
        height: result.height,
        format: validated.format,
      };
    }
    
    return this.handleError(new Error(result.error));
  }
}
```

## Extension Message Handlers

### Content Script Message Handler

```typescript
// extension/content-script-handler.ts

interface MessageHandler {
  action: string;
  handler: (params: any) => Promise<any>;
}

class ContentScriptHandler {
  private handlers: Map<string, MessageHandler['handler']> = new Map();
  
  constructor() {
    this.registerHandlers();
    this.listen();
  }
  
  private registerHandlers() {
    // Click handler
    this.handlers.set('click', async (params) => {
      const { selector, scrollIntoView } = params;
      const element = document.querySelector(selector) as HTMLElement;
      
      if (!element) {
        return { success: false, error: 'Element not found' };
      }
      
      if (scrollIntoView) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.wait(500);
      }
      
      element.click();
      return { success: true, message: `Clicked ${selector}` };
    });
    
    // Fill input handler
    this.handlers.set('fill', async (params) => {
      const { selector, value } = params;
      const element = document.querySelector(selector) as HTMLInputElement;
      
      if (!element) {
        return { success: false, error: 'Element not found' };
      }
      
      element.focus();
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true, message: `Filled ${selector}` };
    });
    
    // Get content handler
    this.handlers.set('get_content', async (params) => {
      const { type = 'text', selector } = params;
      const element = selector 
        ? document.querySelector(selector) 
        : document.body;
      
      if (!element) {
        return { success: false, error: 'Element not found' };
      }
      
      let content;
      switch (type) {
        case 'html':
          content = element.innerHTML;
          break;
        case 'outerHTML':
          content = (element as HTMLElement).outerHTML;
          break;
        default:
          content = element.textContent;
      }
      
      return { 
        success: true, 
        content,
        url: window.location.href,
        title: document.title,
      };
    });
  }
  
  private listen() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
    });
  }
  
  private async handleMessage(request: any) {
    const { action, params } = request;
    const handler = this.handlers.get(action);
    
    if (!handler) {
      throw new Error(`Unknown action: ${action}`);
    }
    
    return await handler(params);
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize handler
new ContentScriptHandler();
```

## Utility Functions

### Message Queue Manager

```typescript
// utils/message-queue.ts

export class MessageQueue<T> {
  private queue: T[] = [];
  private processing = false;
  private processor?: (item: T) => Promise<void>;
  
  constructor(processor?: (item: T) => Promise<void>) {
    this.processor = processor;
  }
  
  async enqueue(item: T): Promise<void> {
    this.queue.push(item);
    if (!this.processing && this.processor) {
      await this.process();
    }
  }
  
  async process(): Promise<void> {
    if (this.processing || !this.processor) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await this.processor(item);
      } catch (error) {
        console.error('Error processing item:', error);
      }
    }
    
    this.processing = false;
  }
  
  clear(): void {
    this.queue = [];
  }
  
  get length(): number {
    return this.queue.length;
  }
}
```

### Connection Manager

```typescript
// utils/connection-manager.ts

export class ConnectionManager {
  private port: chrome.runtime.Port | null = null;
  private reconnectTimer?: NodeJS.Timeout;
  private messageHandlers = new Map<string, (data: any) => void>();
  
  constructor(private hostName: string) {}
  
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.port = chrome.runtime.connectNative(this.hostName);
        
        this.port.onMessage.addListener(this.handleMessage.bind(this));
        this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
  
  private handleMessage(message: any) {
    const { id, data, error } = message;
    
    if (id && this.messageHandlers.has(id)) {
      const handler = this.messageHandlers.get(id)!;
      this.messageHandlers.delete(id);
      handler(error ? { error } : data);
    }
  }
  
  private handleDisconnect() {
    this.port = null;
    this.scheduleReconnect();
  }
  
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(console.error);
    }, 5000);
  }
  
  sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.port) {
        reject(new Error('Not connected'));
        return;
      }
      
      const id = this.generateId();
      this.messageHandlers.set(id, resolve);
      
      this.port.postMessage({ ...message, id });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(id)) {
          this.messageHandlers.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
  }
}
```

### Error Handler

```typescript
// utils/error-handler.ts

export class ErrorHandler {
  static format(error: unknown): { success: false; error: string; details?: any } {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
        details: {
          name: error.name,
          stack: error.stack,
        },
      };
    }
    
    if (typeof error === 'string') {
      return {
        success: false,
        error,
      };
    }
    
    return {
      success: false,
      error: 'Unknown error occurred',
      details: error,
    };
  }
  
  static async wrap<T>(
    fn: () => Promise<T>
  ): Promise<T | { success: false; error: string }> {
    try {
      return await fn();
    } catch (error) {
      return this.format(error);
    }
  }
  
  static isError(result: any): result is { success: false; error: string } {
    return result && result.success === false && 'error' in result;
  }
}
```

## Testing Utilities

### Mock Chrome API

```typescript
// test/mock-chrome.ts

export const mockChrome = {
  runtime: {
    connectNative: jest.fn(() => ({
      postMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
      },
      onDisconnect: {
        addListener: jest.fn(),
      },
      disconnect: jest.fn(),
    })),
    lastError: null,
  },
  
  tabs: {
    query: jest.fn(() => Promise.resolve([
      { id: 1, url: 'https://example.com', title: 'Example' },
    ])),
    create: jest.fn((options) => Promise.resolve({
      id: 2,
      ...options,
    })),
    update: jest.fn((tabId, options) => Promise.resolve({
      id: tabId,
      ...options,
    })),
    captureVisibleTab: jest.fn(() => Promise.resolve('data:image/png;base64,...')),
  },
  
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{ result: true }])),
  },
};

// Setup global chrome object for testing
(global as any).chrome = mockChrome;
```