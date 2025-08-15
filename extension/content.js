// Chrome MCP Controller - Content Script
// Enhanced content script that works with helper scripts for specialized functionality
(function() {
  'use strict';

  // Track which helper scripts have been loaded
  window.__CHROME_PILOT_HELPERS__ = window.__CHROME_PILOT_HELPERS__ || {};

  // Core page interaction functions (delegating to helper scripts when available)
  const PageInteractor = {
    
    // Find interactive elements on the page
    getInteractiveElements() {
      const selectors = [
        'button',
        'input',
        'select',
        'textarea',
        'a[href]',
        '[onclick]',
        '[role="button"]',
        '[role="link"]',
        '[tabindex]'
      ];
      
      const elements = [];
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (this.isVisible(el)) {
            elements.push({
              tag: el.tagName.toLowerCase(),
              type: el.type || null,
              text: this.getElementText(el),
              selector: this.generateSelector(el),
              rect: el.getBoundingClientRect()
            });
          }
        });
      });
      
      return elements;
    },
    
    // Check if element is visible
    isVisible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0' &&
             rect.width > 0 &&
             rect.height > 0;
    },
    
    // Get meaningful text from element
    getElementText(element) {
      return element.innerText ||
             element.textContent ||
             element.value ||
             element.placeholder ||
             element.alt ||
             element.title ||
             '';
    },
    
    // Generate CSS selector for element
    generateSelector(element) {
      if (element.id) {
        return `#${element.id}`;
      }
      
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c);
        if (classes.length > 0) {
          return `${element.tagName.toLowerCase()}.${classes[0]}`;
        }
      }
      
      // Find by text content if unique
      const text = this.getElementText(element).slice(0, 30);
      if (text) {
        const xpath = `.//${element.tagName.toLowerCase()}[contains(text(),"${text}")]`;
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue === element) {
          return `xpath:${xpath}`;
        }
      }
      
      // Fallback to nth-child
      const parent = element.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(element) + 1;
        return `${parent.tagName.toLowerCase()} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
      }
      
      return element.tagName.toLowerCase();
    },
    
    // Enhanced click that delegates to helper script if available
    click(selector, coordinates = null) {
      // If click helper is loaded, delegate to it
      if (window.__CLICK_HELPER_INITIALIZED__) {
        return this.delegateToHelper('clickElement', {
          selector,
          coordinates,
          waitForNavigation: false,
          timeout: 5000
        });
      }
      
      // Fallback to basic click
      const element = this.findElement(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      // Scroll element into view
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
      
      // Wait a bit for scroll to complete
      return new Promise((resolve) => {
        setTimeout(() => {
          try {
            // Try multiple click strategies
            this.tryClick(element);
            resolve({ success: true, selector });
          } catch (error) {
            throw new Error(`Click failed: ${error.message}`);
          }
        }, 300);
      });
    },
    
    // Try different click strategies
    tryClick(element) {
      // Strategy 1: Regular click
      try {
        element.click();
        return;
      } catch (e) {
        console.log('Regular click failed, trying alternatives');
      }
      
      // Strategy 2: Dispatch click event
      try {
        element.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        return;
      } catch (e) {
        console.log('Event dispatch failed, trying focus + enter');
      }
      
      // Strategy 3: Focus and Enter (for buttons/links)
      try {
        element.focus();
        element.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true
        }));
        return;
      } catch (e) {
        console.log('Focus + Enter failed');
      }
      
      throw new Error('All click strategies failed');
    },
    
    // Enhanced element finding
    findElement(selector) {
      // Handle xpath selectors
      if (selector.startsWith('xpath:')) {
        const xpath = selector.replace('xpath:', '');
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
      }
      
      // Regular CSS selector
      return document.querySelector(selector);
    },
    
    // Enhanced form filling that delegates to helper script if available
    fillForm(fields) {
      // If fill helper is loaded, use it for individual fields
      if (window.__FILL_HELPER_INITIALIZED__) {
        const results = [];
        
        fields.forEach(async (field) => {
          try {
            const result = await this.delegateToHelper('fillElement', {
              selector: field.selector,
              value: field.value
            });
            results.push({ selector: field.selector, success: result.success, result });
          } catch (error) {
            results.push({ selector: field.selector, success: false, error: error.message });
          }
        });
        
        return results;
      }
      
      // Fallback to basic form filling
      const results = [];
      
      fields.forEach(field => {
        try {
          const element = this.findElement(field.selector);
          if (!element) {
            results.push({ selector: field.selector, success: false, error: 'Element not found' });
            return;
          }
          
          // Handle different input types
          if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = field.value;
          } else if (element.tagName === 'SELECT') {
            const option = element.querySelector(`option[value="${field.value}"]`) ||
                          element.querySelector(`option[text="${field.value}"]`);
            if (option) {
              option.selected = true;
            } else {
              element.value = field.value;
            }
          } else {
            element.value = field.value;
          }
          
          // Trigger events
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          
          results.push({ selector: field.selector, success: true });
        } catch (error) {
          results.push({ selector: field.selector, success: false, error: error.message });
        }
      });
      
      return results;
    },
    
    // Wait for element to appear
    waitForElement(selector, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const check = () => {
          const element = this.findElement(selector);
          if (element) {
            resolve(element);
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Element not found within ${timeout}ms: ${selector}`));
            return;
          }
          
          setTimeout(check, 100);
        };
        
        check();
      });
    },
    
    // Get page metadata
    getPageInfo() {
      return {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname,
        readyState: document.readyState,
        characterSet: document.characterSet,
        lastModified: document.lastModified,
        referrer: document.referrer,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        },
        forms: Array.from(document.forms).map(form => ({
          id: form.id,
          name: form.name,
          action: form.action,
          method: form.method,
          fields: Array.from(form.elements).map(el => ({
            name: el.name,
            type: el.type,
            tag: el.tagName.toLowerCase()
          }))
        }))
      };
    },
    
    // Delegate to helper script if available
    delegateToHelper(action, params) {
      return new Promise((resolve, reject) => {
        // Create a unique message ID for response tracking
        const messageId = Date.now() + Math.random();
        const message = {
          action: action,
          messageId: messageId,
          ...params
        };
        
        // Set up one-time message listener for response
        const responseListener = (event) => {
          if (event.data && event.data.messageId === messageId) {
            window.removeEventListener('message', responseListener);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data);
            }
          }
        };
        
        window.addEventListener('message', responseListener);
        
        // Dispatch the message to helper scripts
        window.dispatchEvent(new CustomEvent('chrome-pilot-helper-request', {
          detail: message
        }));
        
        // Timeout after 10 seconds
        setTimeout(() => {
          window.removeEventListener('message', responseListener);
          reject(new Error('Helper script timeout'));
        }, 10000);
      });
    },
    
    // Get web content using helper script if available
    getWebContent(options = {}) {
      if (window.__WEB_FETCHER_HELPER_INITIALIZED__) {
        return this.delegateToHelper('getTextContent', options);
      }
      
      // Fallback to basic content extraction
      return {
        success: true,
        textContent: document.body.textContent || '',
        title: document.title,
        url: window.location.href
      };
    },
    
    // Find elements by text using helper script if available
    findElementsByText(text, options = {}) {
      if (window.__INTERACTIVE_ELEMENTS_HELPER_INITIALIZED__) {
        return this.delegateToHelper('getInteractiveElements', {
          textQuery: text,
          ...options
        });
      }
      
      // Fallback to basic text search
      const elements = [];
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(el => {
        const elementText = el.textContent || el.value || el.placeholder || '';
        if (elementText.toLowerCase().includes(text.toLowerCase())) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            elements.push({
              selector: this.generateSelector(el),
              text: elementText.trim().substring(0, 100),
              tagName: el.tagName.toLowerCase(),
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            });
          }
        }
      });
      
      return { success: true, elements };
    }
  };
  
  // Message listener for commands from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.from === 'background') {
      handleContentAction(message.action, message.params)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      
      return true; // Keep message channel open for async response
    }
  });
  
  // Handle content script actions
  async function handleContentAction(action, params) {
    switch (action) {
      case 'get_interactive_elements':
        return PageInteractor.getInteractiveElements();
      
      case 'click_enhanced':
        return await PageInteractor.click(params.selector);
      
      case 'fill_form':
        return PageInteractor.fillForm(params.fields);
      
      case 'wait_for_element':
        await PageInteractor.waitForElement(params.selector, params.timeout);
        return { success: true, selector: params.selector };
      
      case 'get_page_info':
        return PageInteractor.getPageInfo();
      
      case 'get_web_content':
        return PageInteractor.getWebContent(params);
      
      case 'find_elements_by_text':
        return PageInteractor.findElementsByText(params.text, params.options || {});
      
      case 'scroll_to_element':
        const element = PageInteractor.findElement(params.selector);
        if (!element) {
          throw new Error(`Element not found: ${params.selector}`);
        }
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: params.block || 'center',
          inline: params.inline || 'center'
        });
        return { success: true, selector: params.selector };
      
      case 'click_coordinates':
        return PageInteractor.click(null, { x: params.x, y: params.y });
      
      default:
        throw new Error(`Unknown content action: ${action}`);
    }
  }
  
  // Set up helper script communication
  window.addEventListener('chrome-pilot-helper-response', (event) => {
    // Forward helper responses back to requesting code
    window.postMessage(event.detail, '*');
  });
  
  // Notify background script that content script is ready
  chrome.runtime.sendMessage({
    from: 'content',
    action: 'ready',
    url: window.location.href,
    helpers: {
      click: !!window.__CLICK_HELPER_INITIALIZED__,
      fill: !!window.__FILL_HELPER_INITIALIZED__,
      interactive: !!window.__INTERACTIVE_ELEMENTS_HELPER_INITIALIZED__,
      screenshot: !!window.__SCREENSHOT_HELPER_INITIALIZED__,
      webFetcher: !!window.__WEB_FETCHER_HELPER_INITIALIZED__
    }
  });
  
  console.log('Chrome Pilot content script loaded');
})();