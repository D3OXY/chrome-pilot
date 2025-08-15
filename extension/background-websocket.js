// Chrome MCP Controller - Background Service Worker (WebSocket Version)

// WebSocket connection
let ws = null;
let isConnected = false;
let messageQueue = [];
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Message handlers registry
const handlers = new Map();

// WebSocket server configuration
let WS_SERVER_URL = 'ws://localhost:9222/ws'; // Default to localhost for WSL/Windows

// Initialize WebSocket connection
function connectWebSocket() {
  try {
    console.log('Attempting to connect to WebSocket server:', WS_SERVER_URL);
    ws = new WebSocket(WS_SERVER_URL);
    
    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      isConnected = true;
      reconnectAttempts = 0;
      
      // Process queued messages
      processMessageQueue();
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received from WebSocket server:', message);
        
        if (message.type === 'connection') {
          console.log('Connection confirmed by server');
          return;
        }
        
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      isConnected = false;
      ws = null;
      
      // Attempt to reconnect
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
        setTimeout(connectWebSocket, 2000 * reconnectAttempts);
      } else {
        console.error('Max reconnection attempts reached');
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
    isConnected = false;
  }
}

// Handle messages from WebSocket server
function handleWebSocketMessage(message) {
  if (message.id && handlers.has(message.id)) {
    const handler = handlers.get(message.id);
    handlers.delete(message.id);
    
    if (message.error) {
      handler.reject(new Error(message.error));
    } else {
      handler.resolve(message.data);
    }
  } else if (message.id) {
    // This is a command from the server
    handleServerCommand(message);
  }
}

// Handle commands from the server (MCP requests)
async function handleServerCommand(message) {
  try {
    const result = await handleAction(message.action, message.params);
    
    // Send response back to server
    sendToWebSocketServer(message.id, true, result);
  } catch (error) {
    console.error('Error handling server command:', error);
    sendToWebSocketServer(message.id, false, null, error.message);
  }
}

// Process queued messages
function processMessageQueue() {
  while (messageQueue.length > 0 && isConnected && ws && ws.readyState === WebSocket.OPEN) {
    const message = messageQueue.shift();
    ws.send(JSON.stringify(message));
  }
}

// Send message to WebSocket server
function sendToWebSocketServer(id, success, data = null, error = null) {
  const message = {
    id,
    success,
    data,
    error
  };
  
  if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    messageQueue.push(message);
    if (!isConnected) {
      connectWebSocket();
    }
  }
}

// Send command to server and wait for response
function sendCommandToServer(action, params = {}) {
  return new Promise((resolve, reject) => {
    const messageId = generateId();
    const message = {
      id: messageId,
      action,
      params
    };
    
    // Store handler for response
    handlers.set(messageId, { resolve, reject });
    
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      messageQueue.push(message);
      if (!isConnected) {
        connectWebSocket();
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

// Generate unique message ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Tab management functions (same as before)
async function getAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    return tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      windowId: tab.windowId
    }));
  } catch (error) {
    throw new Error(`Failed to get tabs: ${error.message}`);
  }
}

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      windowId: tab.windowId
    };
  } catch (error) {
    throw new Error(`Failed to get active tab: ${error.message}`);
  }
}

async function navigateTab(tabId, url) {
  try {
    await chrome.tabs.update(tabId, { url });
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to navigate tab: ${error.message}`);
  }
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to close tab: ${error.message}`);
  }
}

async function createTab(url) {
  try {
    const tab = await chrome.tabs.create({ url });
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      windowId: tab.windowId
    };
  } catch (error) {
    throw new Error(`Failed to create tab: ${error.message}`);
  }
}

// Page interaction functions
async function executeInTab(tabId, action, params = {}) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageAction,
      args: [action, params]
    });
    
    if (results && results[0]) {
      return results[0].result;
    }
    
    throw new Error('No result from script execution');
  } catch (error) {
    throw new Error(`Script execution failed: ${error.message}`);
  }
}

// Function that runs in the page context (same as before)
function pageAction(action, params) {
  switch (action) {
    case 'click':
      return clickElement(params.selector);
    case 'scroll':
      return scrollPage(params.direction, params.amount);
    case 'get_content':
      return getPageContent(params.selector);
    case 'fill_input':
      return fillInput(params.selector, params.value);
    case 'screenshot':
      return takeScreenshot();
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function clickElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.click();
  
  return { success: true, selector };
}

function scrollPage(direction, amount = 500) {
  const scrollOptions = {
    behavior: 'smooth'
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
    default:
      throw new Error(`Invalid scroll direction: ${direction}`);
  }
  
  return { success: true, direction, amount };
}

function getPageContent(selector) {
  if (selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return {
      content: element.textContent || element.innerText,
      html: element.innerHTML
    };
  }
  
  return {
    title: document.title,
    url: window.location.href,
    content: document.body.textContent || document.body.innerText,
    html: document.documentElement.outerHTML
  };
}

function fillInput(selector, value) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Input element not found: ${selector}`);
  }
  
  element.focus();
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  return { success: true, selector, value };
}

// Action router - handles actions from WebSocket server
async function handleAction(action, params) {
  try {
    switch (action) {
      case 'get_tabs':
        return await getAllTabs();
      
      case 'get_active_tab':
        return await getActiveTab();
      
      case 'navigate':
        return await navigateTab(params.tabId, params.url);
      
      case 'close_tab':
        return await closeTab(params.tabId);
      
      case 'create_tab':
        return await createTab(params.url);
      
      case 'click':
      case 'scroll':
      case 'get_content':
      case 'fill_input':
        const tabId = params.tabId || (await getActiveTab()).id;
        return await executeInTab(tabId, action, params);
      
      case 'screenshot':
        return await takeScreenshot(params.tabId);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    throw new Error(`Action failed: ${error.message}`);
  }
}

// Screenshot function
async function takeScreenshot(tabId) {
  try {
    if (tabId) {
      await chrome.tabs.update(tabId, { active: true });
    }
    
    const dataUrl = await chrome.tabs.captureVisibleTab();
    return {
      success: true,
      screenshot: dataUrl,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Screenshot failed: ${error.message}`);
  }
}

// Configuration management
function updateWebSocketURL(newUrl) {
  WS_SERVER_URL = newUrl;
  console.log('WebSocket URL updated to:', WS_SERVER_URL);
  
  // Reconnect with new URL
  if (ws) {
    ws.close();
  }
  connectWebSocket();
}

// Storage for WebSocket URL configuration
chrome.storage.local.get(['wsServerUrl'], (result) => {
  if (result.wsServerUrl) {
    WS_SERVER_URL = result.wsServerUrl;
    console.log('Loaded WebSocket URL from storage:', WS_SERVER_URL);
  }
});

// Listen for configuration updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.wsServerUrl) {
    updateWebSocketURL(changes.wsServerUrl.newValue);
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup - connecting to WebSocket');
  connectWebSocket();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed - connecting to WebSocket');
  connectWebSocket();
});

// Message listener for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getConnectionStatus') {
    sendResponse({ connected: isConnected });
    return;
  }
  
  if (message.action === 'reconnect') {
    connectWebSocket();
    sendResponse({ success: true });
    return;
  }
  
  if (message.action === 'testConnection') {
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'WebSocket not connected' });
    }
    return;
  }
  
  if (message.action === 'getTabs') {
    getAllTabs()
      .then(tabs => sendResponse({ success: true, data: tabs }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Connect immediately when service worker starts
connectWebSocket();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    connectWebSocket,
    sendCommandToServer,
    handleAction
  };
}