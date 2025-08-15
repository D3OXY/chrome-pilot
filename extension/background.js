// Chrome MCP Controller - Background Service Worker

// Native messaging port
let nativePort = null;
let messageQueue = [];
let isConnected = false;

// Message handlers registry
const handlers = new Map();

// Helper script injection tracking
const injectedScripts = new Map();

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

// Handle disconnect
function handleDisconnect() {
  console.log('Native host disconnected');
  isConnected = false;
  nativePort = null;
  
  // Retry connection after delay
  setTimeout(connectNativeHost, 2000);
}

// Process queued messages
function processMessageQueue() {
  while (messageQueue.length > 0 && isConnected) {
    const message = messageQueue.shift();
    nativePort.postMessage(message);
  }
}

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

// Send message to native host
function sendToNativeHost(action, params = {}) {
  return new Promise((resolve, reject) => {
    const messageId = generateId();
    const message = {
      id: messageId,
      action,
      params
    };
    
    // Store handler for response
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

// Generate unique message ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Tab management functions
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
    // For enhanced actions, use helper scripts
    const enhancedActions = {
      'click_enhanced': { script: 'click-helper.js', message: MESSAGE_TYPES.CLICK_ELEMENT },
      'fill_enhanced': { script: 'fill-helper.js', message: MESSAGE_TYPES.FILL_ELEMENT },
      'clear_enhanced': { script: 'fill-helper.js', message: MESSAGE_TYPES.CLEAR_ELEMENT },
      'get_interactive_elements': { script: 'interactive-elements-helper.js', message: MESSAGE_TYPES.GET_INTERACTIVE_ELEMENTS },
      'get_web_content': { script: 'web-fetcher-helper.js', message: MESSAGE_TYPES.GET_TEXT_CONTENT },
      'get_html_content': { script: 'web-fetcher-helper.js', message: MESSAGE_TYPES.GET_HTML_CONTENT },
      'screenshot_prepare': { script: 'screenshot-helper.js', message: MESSAGE_TYPES.PREPARE_PAGE_FOR_CAPTURE },
      'screenshot_details': { script: 'screenshot-helper.js', message: MESSAGE_TYPES.GET_PAGE_DETAILS },
      'screenshot_element': { script: 'screenshot-helper.js', message: MESSAGE_TYPES.GET_ELEMENT_DETAILS },
    };
    
    if (enhancedActions[action]) {
      const config = enhancedActions[action];
      const message = {
        action: config.message,
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

// Function that runs in the page context - includes all necessary functions
function pageAction(action, params) {
  
  // Helper function to click an element
  function clickElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.click();
    
    return { success: true, selector };
  }

  // Helper function to get page content
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

  // Helper function to fill input
  function fillInput(selector, value) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Input element not found: ${selector}`);
    }
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus();
    
    if (element.type === 'checkbox' || element.type === 'radio') {
      element.checked = Boolean(value);
    } else if (element.tagName === 'SELECT') {
      const option = element.querySelector(`option[value="${value}"]`) ||
                     element.querySelector(`option[text="${value}"]`) ||
                     [...element.options].find(opt => opt.textContent.trim() === value);
      if (option) {
        option.selected = true;
        element.value = option.value;
      } else {
        element.value = value;
      }
    } else {
      element.value = '';
      element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      
      for (let i = 0; i < value.length; i++) {
        const char = value[i];
        element.value = value.substring(0, i + 1);
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: char,
          inputType: 'insertText'
        }));
      }
      element.value = value;
    }
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    
    return { success: true, selector, value };
  }

  // Helper function to clear input
  function clearInput(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Input element not found: ${selector}`);
    }
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus();
    element.select();
    element.value = '';
    
    if (element.isContentEditable) {
      element.textContent = '';
      element.innerHTML = '';
    }
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { success: true, selector };
  }

  // Helper function to scroll page
  function scrollPage(direction, amount = 500) {
    const scrollOptions = { behavior: 'smooth' };
    
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

  // Helper function to fill form
  function fillForm(fields) {
    const results = [];
    
    fields.forEach(field => {
      try {
        const result = fillInput(field.selector, field.value);
        results.push({ ...result, field: field.selector });
      } catch (error) {
        results.push({ 
          success: false, 
          selector: field.selector, 
          value: field.value,
          error: error.message 
        });
      }
    });
    
    return { success: true, results, fieldCount: fields.length };
  }

  // Helper function for takeScreenshot (placeholder)
  function takeScreenshot() {
    return { success: false, error: "Screenshot not available in page context" };
  }

  // Helper function for coordinate clicking
  function clickCoordinates(x, y) {
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });

    const element = document.elementFromPoint(x, y);
    if (element) {
      element.dispatchEvent(clickEvent);
      return { success: true, x, y, element: element.tagName };
    } else {
      document.dispatchEvent(clickEvent);
      return { success: true, x, y, element: 'document' };
    }
  }

  // Helper function to find elements by text
  function findElementByText(text, elementTypes = ['button', 'a', 'input']) {
    const results = [];
    const selectors = {
      button: 'button, [role="button"], input[type="button"], input[type="submit"]',
      a: 'a[href]',
      input: 'input, textarea, select',
      all: '*'
    };
    
    elementTypes.forEach(type => {
      const selector = selectors[type] || selectors.all;
      const elements = document.querySelectorAll(selector);
      
      elements.forEach(el => {
        const elementText = el.textContent || el.value || el.placeholder || el.alt || '';
        if (elementText.toLowerCase().includes(text.toLowerCase())) {
          const rect = el.getBoundingClientRect();
          results.push({
            selector: generateSimpleSelector(el),
            text: elementText.trim(),
            tagName: el.tagName.toLowerCase(),
            type: el.type || null,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            isVisible: rect.width > 0 && rect.height > 0
          });
        }
      });
    });
    
    return { success: true, results, count: results.length, searchText: text };
  }

  // Helper function to generate simple selector
  function generateSimpleSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c);
      if (classes.length > 0) {
        return `${element.tagName.toLowerCase()}.${classes[0]}`;
      }
    }
    return element.tagName.toLowerCase();
  }

  switch (action) {
    case 'click':
      return clickElement(params.selector);
    case 'click_coordinates':
      return clickCoordinates(params.x, params.y);
    case 'scroll':
      return scrollPage(params.direction, params.amount);
    case 'get_content':
      return getPageContent(params.selector);
    case 'fill_input':
      return fillInput(params.selector, params.value);
    case 'clear_input':
      return clearInput(params.selector);
    case 'fill_form':
      return fillForm(params.fields);
    case 'find_element_by_text':
      return findElementByText(params.text, params.elementTypes);
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
  
  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Focus the element
  element.focus();
  
  // Clear existing value using multiple strategies
  if (element.value && element.value.length > 0) {
    // Strategy 1: Select all and delete
    element.select();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true }));
    
    // Strategy 2: Set value to empty first
    element.value = '';
    
    // Strategy 3: Manual clear for contenteditable
    if (element.isContentEditable) {
      element.textContent = '';
      element.innerHTML = '';
    }
  }
  
  // Handle different input types
  if (element.type === 'checkbox' || element.type === 'radio') {
    element.checked = Boolean(value);
  } else if (element.tagName === 'SELECT') {
    // Handle select elements
    const option = element.querySelector(`option[value="${value}"]`) ||
                   element.querySelector(`option[text="${value}"]`) ||
                   [...element.options].find(opt => opt.textContent.trim() === value);
    if (option) {
      option.selected = true;
      element.value = option.value;
    } else {
      element.value = value;
    }
  } else {
    // For text inputs, simulate typing character by character for better compatibility
    element.value = '';
    
    // Trigger focus events
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    
    // Type value character by character for React/Vue compatibility
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      element.value = value.substring(0, i + 1);
      
      // Trigger input event for each character
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: char,
        inputType: 'insertText'
      }));
    }
    
    // Final value set
    element.value = value;
  }
  
  // Trigger all necessary events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  
  return { success: true, selector, value };
}

function clearInput(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Input element not found: ${selector}`);
  }
  
  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Focus the element
  element.focus();
  
  // Clear using multiple strategies
  element.select();
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true }));
  element.value = '';
  
  if (element.isContentEditable) {
    element.textContent = '';
    element.innerHTML = '';
  }
  
  // Trigger events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  return { success: true, selector };
}

function fillForm(fields) {
  const results = [];
  
  fields.forEach(field => {
    try {
      const result = fillInput(field.selector, field.value);
      results.push({ ...result, field: field.selector });
    } catch (error) {
      results.push({ 
        success: false, 
        selector: field.selector, 
        value: field.value,
        error: error.message 
      });
    }
  });
  
  return { success: true, results, fieldCount: fields.length };
}

// Enhanced click with coordinates support
function clickCoordinates(x, y) {
  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });

  const element = document.elementFromPoint(x, y);
  if (element) {
    element.dispatchEvent(clickEvent);
    return { success: true, x, y, element: element.tagName };
  } else {
    document.dispatchEvent(clickEvent);
    return { success: true, x, y, element: 'document' };
  }
}

// Find element by text content
function findElementByText(text, elementTypes = ['button', 'a', 'input']) {
  const results = [];
  const selectors = {
    button: 'button, [role="button"], input[type="button"], input[type="submit"]',
    a: 'a[href]',
    input: 'input, textarea, select',
    all: '*'
  };
  
  elementTypes.forEach(type => {
    const selector = selectors[type] || selectors.all;
    const elements = document.querySelectorAll(selector);
    
    elements.forEach(el => {
      const elementText = el.textContent || el.value || el.placeholder || el.alt || '';
      if (elementText.toLowerCase().includes(text.toLowerCase())) {
        const rect = el.getBoundingClientRect();
        results.push({
          selector: generateSimpleSelector(el),
          text: elementText.trim(),
          tagName: el.tagName.toLowerCase(),
          type: el.type || null,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          isVisible: rect.width > 0 && rect.height > 0
        });
      }
    });
  });
  
  return { success: true, results, count: results.length, searchText: text };
}

// Generate a simple selector for an element
function generateSimpleSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c);
    if (classes.length > 0) {
      return `${element.tagName.toLowerCase()}.${classes[0]}`;
    }
  }
  return element.tagName.toLowerCase();
}

// Action router - handles actions from native host
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
      case 'clear_input':
      case 'fill_form':
      case 'click_enhanced':
      case 'fill_enhanced':
      case 'clear_enhanced':
      case 'get_interactive_elements':
      case 'get_web_content':
      case 'get_html_content':
      case 'screenshot_prepare':
      case 'screenshot_details':
      case 'screenshot_element':
      case 'click_coordinates':
      case 'find_element_by_text':
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

// Message listener for native host requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.from === 'native') {
    handleAction(message.action, message.params)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
  connectNativeHost();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  connectNativeHost();
});

// Connect immediately when service worker starts
connectNativeHost();