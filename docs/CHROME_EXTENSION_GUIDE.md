# Chrome Extension Development Guide

## Overview

This guide covers building the Chrome extension component that enables browser automation through native messaging.

## Extension Structure

```
extension/
├── manifest.json           # Extension configuration
├── background.js          # Service worker (main logic)
├── content.js            # Injected into web pages
├── native-messaging.js   # Communication handler
└── utils.js             # Helper functions
```

## Step 1: Create Manifest.json

```json
{
  "manifest_version": 3,
  "name": "Chrome MCP Controller",
  "version": "1.0.0",
  "description": "Enables AI control of Chrome through MCP protocol",
  
  "permissions": [
    "tabs",
    "activeTab",
    "scripting",
    "nativeMessaging",
    "storage"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "action": {
    "default_title": "Chrome MCP Controller"
  },
  
  "content_scripts": [],
  
  "web_accessible_resources": []
}
```

## Step 2: Background Service Worker

### Core Implementation

```javascript
// background.js

// Native messaging port
let nativePort = null;
let messageQueue = [];
let isConnected = false;

// Message handlers registry
const handlers = new Map();

// Initialize native messaging connection
function connectNativeHost() {
  try {
    nativePort = chrome.runtime.connectNative('com.chrome_mcp.host');
    isConnected = true;
    
    nativePort.onMessage.addListener(handleNativeMessage);
    nativePort.onDisconnect.addListener(handleDisconnect);
    
    // Process queued messages
    processMessageQueue();
    
    console.log('Native host connected');
  } catch (error) {
    console.error('Failed to connect to native host:', error);
    isConnected = false;
  }
}

// Handle messages from native host
function handleNativeMessage(message) {
  console.log('Received from native host:', message);
  
  if (message.id && handlers.has(message.id)) {
    const handler = handlers.get(message.id);
    handlers.delete(message.id);
    
    if (message.error) {
      handler.reject(new Error(message.error));
    } else {
      handler.resolve(message.data);
    }
  }
}

// Handle disconnection
function handleDisconnect() {
  console.log('Native host disconnected');
  isConnected = false;
  nativePort = null;
  
  // Reject all pending handlers
  handlers.forEach(handler => {
    handler.reject(new Error('Native host disconnected'));
  });
  handlers.clear();
  
  // Try to reconnect after delay
  setTimeout(connectNativeHost, 5000);
}

// Send message to native host
function sendToNativeHost(action, params) {
  return new Promise((resolve, reject) => {
    const messageId = generateId();
    const message = {
      id: messageId,
      action,
      params,
      timestamp: Date.now()
    };
    
    handlers.set(messageId, { resolve, reject });
    
    if (isConnected && nativePort) {
      nativePort.postMessage(message);
    } else {
      messageQueue.push(message);
      if (!isConnected) {
        connectNativeHost();
      }
    }
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (handlers.has(messageId)) {
        handlers.delete(messageId);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// Process queued messages
function processMessageQueue() {
  while (messageQueue.length > 0 && isConnected && nativePort) {
    const message = messageQueue.shift();
    nativePort.postMessage(message);
  }
}

// Generate unique ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize on extension load
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  connectNativeHost();
});

// Connect on startup
chrome.runtime.onStartup.addListener(() => {
  connectNativeHost();
});

// Initialize connection
connectNativeHost();
```

## Step 3: Tool Implementations

### Navigate Tool

```javascript
// tools/navigate.js

async function navigate(params) {
  const { url, tabId } = params;
  
  try {
    let tab;
    
    if (tabId) {
      // Navigate specific tab
      tab = await chrome.tabs.update(tabId, { url });
    } else {
      // Navigate active tab
      const [activeTab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });
      
      if (!activeTab) {
        throw new Error('No active tab found');
      }
      
      tab = await chrome.tabs.update(activeTab.id, { url });
    }
    
    // Wait for page to load
    await waitForTabLoad(tab.id);
    
    return {
      success: true,
      tabId: tab.id,
      url: tab.url,
      title: tab.title
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper: Wait for tab to finish loading
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 10000);
  });
}
```

### Click Tool

```javascript
// tools/click.js

async function click(params) {
  const { selector, tabId } = params;
  
  try {
    const targetTabId = tabId || await getActiveTabId();
    
    // Inject content script if needed
    await ensureContentScript(targetTabId);
    
    // Execute click in content script
    const results = await chrome.tabs.sendMessage(targetTabId, {
      action: 'click',
      selector
    });
    
    return results;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Ensure content script is injected
async function ensureContentScript(tabId) {
  try {
    // Check if content script is already injected
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch {
    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    
    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Screenshot Tool

```javascript
// tools/screenshot.js

async function screenshot(params) {
  const { fullPage = false, selector, tabId } = params;
  
  try {
    const targetTabId = tabId || await getActiveTabId();
    
    if (selector) {
      // Element screenshot via content script
      await ensureContentScript(targetTabId);
      
      const result = await chrome.tabs.sendMessage(targetTabId, {
        action: 'getElementBounds',
        selector
      });
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Capture visible area containing element
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png'
      });
      
      // Would need additional processing to crop to element
      return {
        success: true,
        dataUrl,
        bounds: result.bounds
      };
    } else if (fullPage) {
      // Full page screenshot (requires scrolling)
      return await captureFullPage(targetTabId);
    } else {
      // Visible viewport screenshot
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png'
      });
      
      return {
        success: true,
        dataUrl
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Capture full page by scrolling
async function captureFullPage(tabId) {
  // This is simplified - real implementation would:
  // 1. Get page dimensions
  // 2. Scroll and capture multiple screenshots
  // 3. Stitch them together
  
  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format: 'png'
  });
  
  return {
    success: true,
    dataUrl,
    fullPage: true
  };
}
```

## Step 4: Content Script

```javascript
// content.js

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(request) {
  console.log('Content script received:', request);
  
  switch (request.action) {
    case 'ping':
      return { success: true, message: 'pong' };
      
    case 'click':
      return clickElement(request.selector);
      
    case 'fill':
      return fillInput(request.selector, request.value);
      
    case 'scroll':
      return scrollPage(request);
      
    case 'getContent':
      return getPageContent(request);
      
    case 'getElementBounds':
      return getElementBounds(request.selector);
      
    case 'getInteractiveElements':
      return getInteractiveElements();
      
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// Click element by selector
function clickElement(selector) {
  try {
    const element = document.querySelector(selector);
    
    if (!element) {
      return { success: false, error: 'Element not found' };
    }
    
    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Simulate click
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    element.dispatchEvent(event);
    
    return { 
      success: true, 
      message: `Clicked element: ${selector}` 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Fill input field
function fillInput(selector, value) {
  try {
    const element = document.querySelector(selector);
    
    if (!element) {
      return { success: false, error: 'Element not found' };
    }
    
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
      return { success: false, error: 'Element is not an input' };
    }
    
    // Focus element
    element.focus();
    
    // Set value
    element.value = value;
    
    // Trigger events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { 
      success: true, 
      message: `Filled ${selector} with value` 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Scroll page
function scrollPage(params) {
  try {
    const { direction = 'down', amount = 500, smooth = true } = params;
    
    const scrollOptions = {
      behavior: smooth ? 'smooth' : 'auto'
    };
    
    switch (direction) {
      case 'up':
        window.scrollBy({ ...scrollOptions, top: -amount });
        break;
      case 'down':
        window.scrollBy({ ...scrollOptions, top: amount });
        break;
      case 'left':
        window.scrollBy({ ...scrollOptions, left: -amount });
        break;
      case 'right':
        window.scrollBy({ ...scrollOptions, left: amount });
        break;
      case 'top':
        window.scrollTo({ ...scrollOptions, top: 0 });
        break;
      case 'bottom':
        window.scrollTo({ ...scrollOptions, top: document.body.scrollHeight });
        break;
      default:
        if (params.selector) {
          const element = document.querySelector(params.selector);
          if (element) {
            element.scrollIntoView(scrollOptions);
          }
        }
    }
    
    return { success: true, message: 'Scrolled page' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get page content
function getPageContent(params) {
  try {
    const { type = 'text', selector } = params;
    
    let element = document.body;
    if (selector) {
      element = document.querySelector(selector);
      if (!element) {
        return { success: false, error: 'Element not found' };
      }
    }
    
    let content;
    switch (type) {
      case 'html':
        content = element.innerHTML;
        break;
      case 'outerHTML':
        content = element.outerHTML;
        break;
      case 'text':
      default:
        content = element.innerText || element.textContent;
    }
    
    return { 
      success: true, 
      content,
      url: window.location.href,
      title: document.title
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get element bounds for screenshot
function getElementBounds(selector) {
  try {
    const element = document.querySelector(selector);
    
    if (!element) {
      return { success: false, error: 'Element not found' };
    }
    
    const rect = element.getBoundingClientRect();
    
    return {
      success: true,
      bounds: {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        viewport: {
          x: rect.left,
          y: rect.top
        }
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get all interactive elements
function getInteractiveElements() {
  try {
    const interactiveSelectors = [
      'a[href]',
      'button',
      'input',
      'textarea',
      'select',
      '[onclick]',
      '[role="button"]',
      '[role="link"]'
    ];
    
    const elements = document.querySelectorAll(interactiveSelectors.join(','));
    
    const elementData = Array.from(elements).map(el => ({
      tagName: el.tagName.toLowerCase(),
      text: el.innerText || el.value || el.placeholder || '',
      type: el.type || null,
      href: el.href || null,
      id: el.id || null,
      className: el.className || null,
      name: el.name || null,
      visible: isElementVisible(el)
    })).filter(el => el.visible);
    
    return {
      success: true,
      elements: elementData,
      count: elementData.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check if element is visible
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

console.log('Content script loaded');
```

## Step 5: Tool Registration

```javascript
// Register all tools in background.js

const tools = {
  navigate,
  click,
  scroll,
  screenshot,
  fill_input: fillInput,
  get_content: getContent,
  get_tabs: getTabs,
  close_tab: closeTab,
  go_back: goBack,
  go_forward: goForward
};

// Handle tool execution requests
async function executeTool(toolName, params) {
  if (!tools[toolName]) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  
  return await tools[toolName](params);
}

// Listen for tool requests from native host
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.source === 'native-host' && request.tool) {
    executeTool(request.tool, request.params)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open
  }
});
```

## Testing the Extension

### 1. Load Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select your extension directory

### 2. Check for Errors
- Open extension service worker DevTools
- Check console for initialization logs
- Verify no permission errors

### 3. Test Basic Functions
```javascript
// In service worker console
await chrome.tabs.query({ active: true });
await chrome.tabs.create({ url: 'https://example.com' });
```

### 4. Test Content Script
```javascript
// Navigate to any page, then in console:
chrome.runtime.sendMessage({ action: 'ping' }, response => {
  console.log('Response:', response);
});
```

## Best Practices

### 1. Error Handling
- Always wrap async operations in try-catch
- Provide meaningful error messages
- Handle edge cases (no tabs, permissions)

### 2. Performance
- Minimize content script size
- Use lazy loading for tools
- Cache frequently used data

### 3. Security
- Validate all inputs
- Sanitize selectors
- Use content security policy

### 4. Debugging
- Use console.log liberally during development
- Implement debug mode flag
- Add performance timing

## Common Issues

### Content Script Not Injecting
- Check page CSP headers
- Verify host_permissions
- Try programmatic injection

### Native Messaging Fails
- Check native host registration
- Verify manifest paths
- Check message size limits

### Permission Errors
- Ensure all required permissions in manifest
- Request permissions at runtime if needed
- Check host_permissions for URLs