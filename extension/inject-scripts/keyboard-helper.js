// Keyboard simulation helper - Chrome Pilot
// This script provides keyboard simulation capabilities

if (window.__KEYBOARD_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__KEYBOARD_HELPER_INITIALIZED__ = true;

  /**
   * Simulate keyboard input
   * @param {Object} params - Keyboard simulation parameters
   * @param {string} params.text - Text to type
   * @param {Array} params.keys - Array of keys to press (e.g., ['Enter', 'Tab'])
   * @param {string} params.selector - Optional selector to focus before typing
   * @param {number} params.delay - Delay between keystrokes in ms
   * @returns {Promise<Object>} - Result of keyboard simulation
   */
  async function simulateKeyboard(params) {
    try {
      const { text, keys, selector, delay = 50 } = params;
      let targetElement = null;

      // Focus on target element if selector provided
      if (selector) {
        targetElement = document.querySelector(selector);
        if (!targetElement) {
          return {
            error: `Element with selector "${selector}" not found`,
          };
        }
        targetElement.focus();
      } else {
        targetElement = document.activeElement || document.body;
      }

      const results = [];

      // Type text if provided
      if (text) {
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          
          // Dispatch keydown, keypress, and keyup events
          const keydownEvent = new KeyboardEvent('keydown', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            bubbles: true,
            cancelable: true,
          });
          
          const keypressEvent = new KeyboardEvent('keypress', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            bubbles: true,
            cancelable: true,
          });
          
          const keyupEvent = new KeyboardEvent('keyup', {
            key: char,
            code: `Key${char.toUpperCase()}`,
            bubbles: true,
            cancelable: true,
          });

          targetElement.dispatchEvent(keydownEvent);
          targetElement.dispatchEvent(keypressEvent);
          
          // Update input value for input elements
          if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
            targetElement.value += char;
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          targetElement.dispatchEvent(keyupEvent);
          
          // Add delay between keystrokes
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        results.push({ action: 'type', text, success: true });
      }

      // Press special keys if provided
      if (keys && Array.isArray(keys)) {
        for (const key of keys) {
          await pressKey(targetElement, key);
          results.push({ action: 'keypress', key, success: true });
          
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Trigger change event for form elements
      if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'SELECT') {
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
      }

      return {
        success: true,
        message: 'Keyboard simulation completed successfully',
        results: results,
        targetElement: {
          tagName: targetElement.tagName,
          id: targetElement.id,
          className: targetElement.className,
        }
      };
    } catch (error) {
      return {
        error: `Error simulating keyboard: ${error.message}`,
      };
    }
  }

  /**
   * Press a specific key
   * @param {Element} element - Target element
   * @param {string} key - Key to press
   */
  async function pressKey(element, key) {
    const keyCode = getKeyCode(key);
    
    const keydownEvent = new KeyboardEvent('keydown', {
      key: key,
      code: getKeyCode(key, 'code'),
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key: key,
      code: getKeyCode(key, 'code'),
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });

    element.dispatchEvent(keydownEvent);
    
    // Handle special key behaviors
    switch (key.toLowerCase()) {
      case 'enter':
        // Trigger form submission for form elements
        const form = element.closest('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        }
        break;
      case 'tab':
        // Move to next focusable element
        const focusableElements = document.querySelectorAll(
          'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        );
        const currentIndex = Array.from(focusableElements).indexOf(element);
        if (currentIndex >= 0 && currentIndex < focusableElements.length - 1) {
          focusableElements[currentIndex + 1].focus();
        }
        break;
      case 'escape':
        // Blur current element
        element.blur();
        break;
      case 'backspace':
        // Remove last character for input elements
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          if (element.value.length > 0) {
            element.value = element.value.slice(0, -1);
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        break;
    }
    
    element.dispatchEvent(keyupEvent);
  }

  /**
   * Get key code for a key name
   * @param {string} key - Key name
   * @param {string} type - Type of code to return ('keyCode' or 'code')
   * @returns {string|number} - Key code
   */
  function getKeyCode(key, type = 'keyCode') {
    const keyMap = {
      'Enter': { keyCode: 13, code: 'Enter' },
      'Tab': { keyCode: 9, code: 'Tab' },
      'Escape': { keyCode: 27, code: 'Escape' },
      'Backspace': { keyCode: 8, code: 'Backspace' },
      'Delete': { keyCode: 46, code: 'Delete' },
      'ArrowUp': { keyCode: 38, code: 'ArrowUp' },
      'ArrowDown': { keyCode: 40, code: 'ArrowDown' },
      'ArrowLeft': { keyCode: 37, code: 'ArrowLeft' },
      'ArrowRight': { keyCode: 39, code: 'ArrowRight' },
      'Space': { keyCode: 32, code: 'Space' },
      'Home': { keyCode: 36, code: 'Home' },
      'End': { keyCode: 35, code: 'End' },
      'PageUp': { keyCode: 33, code: 'PageUp' },
      'PageDown': { keyCode: 34, code: 'PageDown' },
    };

    const mapping = keyMap[key];
    if (mapping) {
      return mapping[type];
    }

    // For single characters
    if (key.length === 1) {
      const charCode = key.toUpperCase().charCodeAt(0);
      if (type === 'code') {
        return `Key${key.toUpperCase()}`;
      }
      return charCode;
    }

    return type === 'code' ? key : 0;
  }

  /**
   * Simulate key combination (e.g., Ctrl+C, Alt+Tab)
   * @param {Object} params - Key combination parameters
   * @param {Array} params.keys - Array of keys in combination
   * @param {string} params.selector - Optional selector to focus
   * @returns {Promise<Object>} - Result of key combination
   */
  async function simulateKeyCombination(params) {
    try {
      const { keys, selector } = params;
      let targetElement = document.activeElement || document.body;

      if (selector) {
        targetElement = document.querySelector(selector);
        if (!targetElement) {
          return {
            error: `Element with selector "${selector}" not found`,
          };
        }
        targetElement.focus();
      }

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return {
          error: 'Keys array is required and must not be empty',
        };
      }

      // Determine modifier keys and main key
      const modifiers = {
        ctrlKey: keys.includes('Ctrl') || keys.includes('Control'),
        altKey: keys.includes('Alt'),
        shiftKey: keys.includes('Shift'),
        metaKey: keys.includes('Meta') || keys.includes('Cmd'),
      };

      const mainKey = keys.find(key => 
        !['Ctrl', 'Control', 'Alt', 'Shift', 'Meta', 'Cmd'].includes(key)
      );

      if (!mainKey) {
        return {
          error: 'A main key (non-modifier) is required',
        };
      }

      const keyCode = getKeyCode(mainKey);

      // Dispatch keydown for all keys
      for (const key of keys) {
        const keydownEvent = new KeyboardEvent('keydown', {
          key: key,
          code: getKeyCode(key, 'code'),
          keyCode: getKeyCode(key),
          ...modifiers,
          bubbles: true,
          cancelable: true,
        });
        targetElement.dispatchEvent(keydownEvent);
      }

      // Dispatch keyup for all keys (in reverse order)
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        const keyupEvent = new KeyboardEvent('keyup', {
          key: key,
          code: getKeyCode(key, 'code'),
          keyCode: getKeyCode(key),
          ...modifiers,
          bubbles: true,
          cancelable: true,
        });
        targetElement.dispatchEvent(keyupEvent);
      }

      return {
        success: true,
        message: `Key combination ${keys.join('+')} simulated successfully`,
        keys: keys,
        modifiers: modifiers,
      };
    } catch (error) {
      return {
        error: `Error simulating key combination: ${error.message}`,
      };
    }
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'simulateKeyboard') {
      simulateKeyboard(request)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            error: `Unexpected error: ${error.message}`,
          });
        });
      return true; // Indicates async response
    } else if (request.action === 'simulateKeyCombination') {
      simulateKeyCombination(request)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            error: `Unexpected error: ${error.message}`,
          });
        });
      return true; // Indicates async response
    } else if (request.action === 'chrome_keyboard_helper_ping') {
      sendResponse({ status: 'pong' });
      return false;
    }
  });

  console.log('Keyboard helper script loaded');
}