// Chrome MCP Controller - Content Script

// Content script for enhanced page interaction
(function() {
  'use strict';

  // Enhanced page interaction functions
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
    
    // Enhanced click with multiple strategies
    click(selector) {
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
    
    // Enhanced form filling
    fillForm(fields) {
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
      
      default:
        throw new Error(`Unknown content action: ${action}`);
    }
  }
  
  // Notify background script that content script is ready
  chrome.runtime.sendMessage({
    from: 'content',
    action: 'ready',
    url: window.location.href
  });
  
})();