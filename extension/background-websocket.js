// Chrome MCP Controller - Background Service Worker (WebSocket Version)

// WebSocket connection
let ws = null;
let isConnected = false;
let messageQueue = [];
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let persistentReconnectTimer = null;
const persistentReconnectInterval = 10000; // Try every 10 seconds when server is offline
let keepAliveTimer = null;
const keepAliveInterval = 25000; // Send keep-alive every 25 seconds

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
      
      // Stop persistent reconnection if it was running
      stopPersistentReconnection();
      
      // Start keep-alive mechanism
      startKeepAlive();
      
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
        
        if (message.type === 'ping') {
          // Respond to server ping with pong
          const pongMessage = {
            type: 'pong',
            timestamp: Date.now()
          };
          ws.send(JSON.stringify(pongMessage));
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
      stopKeepAlive();
      
      // Attempt to reconnect with exponential backoff (limited attempts)
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
        setTimeout(connectWebSocket, 2000 * reconnectAttempts);
      } else {
        console.log('Max immediate reconnection attempts reached, switching to persistent monitoring');
        startPersistentReconnection();
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

// Start persistent reconnection attempts
function startPersistentReconnection() {
  // Clear any existing timer
  if (persistentReconnectTimer) {
    clearInterval(persistentReconnectTimer);
  }
  
  console.log(`Starting persistent reconnection attempts every ${persistentReconnectInterval/1000} seconds`);
  
  persistentReconnectTimer = setInterval(() => {
    if (!isConnected) {
      console.log('Attempting persistent reconnection...');
      // Reset reconnect attempts for fresh exponential backoff
      reconnectAttempts = 0;
      connectWebSocket();
    } else {
      console.log('Connection restored, stopping persistent reconnection');
      clearInterval(persistentReconnectTimer);
      persistentReconnectTimer = null;
    }
  }, persistentReconnectInterval);
}

// Stop persistent reconnection
function stopPersistentReconnection() {
  if (persistentReconnectTimer) {
    clearInterval(persistentReconnectTimer);
    persistentReconnectTimer = null;
    console.log('Stopped persistent reconnection attempts');
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
// Message type constants
const MESSAGE_TYPES = {
  CLICK_ELEMENT: 'clickElement',
  FILL_ELEMENT: 'fillElement',
  CLEAR_ELEMENT: 'clearElement',
  GET_INTERACTIVE_ELEMENTS: 'getInteractiveElements',
  GET_HTML_CONTENT: 'getHTMLContent',
  GET_TEXT_CONTENT: 'getTextContent',
  PREPARE_PAGE_FOR_CAPTURE: 'preparePageForCapture',
  GET_PAGE_DETAILS: 'getPageDetails',
  GET_ELEMENT_DETAILS: 'getElementDetails',
  SCROLL_PAGE: 'scrollPage',
  RESET_PAGE_AFTER_CAPTURE: 'resetPageAfterCapture',
  HIGHLIGHT_ELEMENT: 'highlightElement',
  UNHIGHLIGHT_ELEMENT: 'unhighlightElement',
  REMOVE_ALL_HIGHLIGHTS: 'removeAllHighlights'
};

// Helper script injection tracking
const injectedScripts = new Map();

// Helper script injection function
async function injectHelperScript(tabId, scriptName) {
  const scriptKey = `${tabId}-${scriptName}`;
  
  if (injectedScripts.has(scriptKey)) {
    return; // Already injected
  }
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [`inject-scripts/${scriptName}`]
    });
    injectedScripts.set(scriptKey, Date.now());
    console.log(`Injected ${scriptName} into tab ${tabId}`);
  } catch (error) {
    console.error(`Failed to inject ${scriptName}:`, error);
    throw error;
  }
}

// Clean up injection tracking when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [key, _] of injectedScripts) {
    if (key.startsWith(`${tabId}-`)) {
      injectedScripts.delete(key);
    }
  }
});

// Send message to content script with helper injection
async function sendToContentScript(tabId, message, requiredScript = null) {
  if (requiredScript) {
    await injectHelperScript(tabId, requiredScript);
  }
  
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function executeInTab(tabId, action, params = {}) {
  try {
    // For enhanced actions, use helper scripts
    const enhancedActions = {
      'click_enhanced': { script: 'click-helper.js', message: 'clickElement' },
      'fill_enhanced': { script: 'fill-helper.js', message: 'fillElement' },
      'clear_enhanced': { script: 'fill-helper.js', message: 'clearElement' },
      'get_interactive_elements': { script: 'interactive-elements-helper.js', message: 'getInteractiveElements' },
      'get_web_content': { script: 'web-fetcher-helper.js', message: 'getTextContent' },
      'get_html_content': { script: 'web-fetcher-helper.js', message: 'getHTMLContent' },
    };
    
    if (enhancedActions[action]) {
      const config = enhancedActions[action];
      const message = {
        action: config.message,
        selector: params.selector,
        value: params.value,
        ...params
      };
      
      return await sendToContentScript(tabId, message, config.script);
    }
    
    // Fallback to direct script execution for basic actions
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
    case 'wait_for_element':
      return waitForElement(params.selector, params.timeout);
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

function getInteractiveElements() {
  const interactiveSelectors = [
    'button',
    'input',
    'select',
    'textarea',
    'a[href]',
    '[onclick]',
    '[role="button"]',
    '[tabindex]:not([tabindex="-1"])',
    'label[for]',
    '[contenteditable="true"]'
  ];
  
  const elements = [];
  
  interactiveSelectors.forEach(selector => {
    const found = document.querySelectorAll(selector);
    found.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && 
                       window.getComputedStyle(element).display !== 'none' &&
                       window.getComputedStyle(element).visibility !== 'hidden';
      
      if (isVisible) {
        elements.push({
          tagName: element.tagName.toLowerCase(),
          type: element.type || null,
          id: element.id || null,
          className: element.className || null,
          text: element.textContent?.trim()?.substring(0, 100) || null,
          value: element.value || null,
          href: element.href || null,
          selector: generateSelector(element),
          position: {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        });
      }
    });
  });
  
  return {
    success: true,
    elements: elements,
    count: elements.length
  };
}

function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
  }
  
  let selector = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      child => child.tagName === element.tagName
    );
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      selector += `:nth-of-type(${index})`;
    }
  }
  
  return selector;
}

function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve({ success: true, selector, found: true });
      return;
    }
    
    const startTime = Date.now();
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve({ success: true, selector, found: true, waitTime: Date.now() - startTime });
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        observer.disconnect();
        reject(new Error(`Element not found within ${timeout}ms: ${selector}`));
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Also set a hard timeout
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found within ${timeout}ms: ${selector}`));
    }, timeout);
  });
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
      case 'get_interactive_elements':
      case 'wait_for_element':
      case 'click_enhanced':
      case 'fill_enhanced':
      case 'clear_enhanced':
      case 'get_web_content':
      case 'get_html_content':
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
  
  // Stop persistent reconnection and restart with new URL
  stopPersistentReconnection();
  reconnectAttempts = 0;
  
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
    sendResponse({ 
      connected: isConnected,
      persistentReconnecting: persistentReconnectTimer !== null
    });
    return;
  }
  
  if (message.action === 'reconnect') {
    // Stop persistent reconnection and start fresh
    stopPersistentReconnection();
    reconnectAttempts = 0;
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

// Keep-alive mechanism to prevent service worker suspension
function startKeepAlive() {
  stopKeepAlive();
  
  keepAliveTimer = setInterval(() => {
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
      // Send keep-alive message
      const keepAliveMessage = {
        type: 'keep_alive',
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(keepAliveMessage));
    }
  }, keepAliveInterval);
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

// Service worker lifecycle management
chrome.runtime.onSuspend?.addListener(() => {
  console.log('Service worker is being suspended');
  stopKeepAlive();
  stopPersistentReconnection();
});

chrome.runtime.onSuspendCanceled?.addListener(() => {
  console.log('Service worker suspension was canceled');
  if (isConnected) {
    startKeepAlive();
  }
});

// Set up alarm to keep service worker alive
chrome.alarms.create('keep-alive', { 
  delayInMinutes: 0.5, // 30 seconds
  periodInMinutes: 0.5 
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') {
    // This just wakes up the service worker
    console.log('Keep-alive alarm triggered');
    
    // Check connection status and reconnect if needed
    if (!isConnected) {
      console.log('Alarm detected disconnection, attempting to reconnect');
      connectWebSocket();
    }
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