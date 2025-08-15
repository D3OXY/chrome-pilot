// Enhanced form filling helper - Chrome Pilot
// This script provides advanced form filling functionality with proper event handling

if (window.__FILL_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__FILL_HELPER_INITIALIZED__ = true;

  /**
   * Fill an input element with the specified value
   * @param {string} selector - CSS selector for the element to fill
   * @param {string} value - Value to fill into the element
   * @returns {Promise<Object>} - Result of the fill operation
   */
  async function fillElement(selector, value) {
    try {
      // Find the element
      const element = document.querySelector(selector);
      if (!element) {
        return {
          error: `Element with selector "${selector}" not found`,
        };
      }

      // Get element information
      const rect = element.getBoundingClientRect();
      const elementInfo = {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        type: element.type || null,
        isVisible: isElementVisible(element),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
        },
      };

      // Check if element is visible
      if (!elementInfo.isVisible) {
        return {
          error: `Element with selector "${selector}" is not visible`,
          elementInfo,
        };
      }

      // Check if element is fillable
      const validTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      const validInputTypes = [
        'text',
        'email',
        'password',
        'number',
        'search',
        'tel',
        'url',
        'date',
        'datetime-local',
        'month',
        'time',
        'week',
        'color',
        'range',
        'hidden', // Allow hidden inputs
      ];

      if (!validTags.includes(element.tagName)) {
        return {
          error: `Element with selector "${selector}" is not a fillable element (must be INPUT, TEXTAREA, or SELECT)`,
          elementInfo,
        };
      }

      // For input elements, check if the type is valid
      if (
        element.tagName === 'INPUT' &&
        !validInputTypes.includes(element.type) &&
        element.type !== null
      ) {
        return {
          error: `Input element with selector "${selector}" has type "${element.type}" which is not fillable`,
          elementInfo,
        };
      }

      // Scroll element into view (unless it's hidden)
      if (element.type !== 'hidden') {
        element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Fill the element based on its type
      let fillResult;
      if (element.tagName === 'SELECT') {
        fillResult = await fillSelectElement(element, value);
      } else if (element.type === 'checkbox' || element.type === 'radio') {
        fillResult = await fillCheckboxRadio(element, value);
      } else if (element.type === 'file') {
        fillResult = { error: 'File input filling not supported through content scripts' };
      } else {
        // For input and textarea elements
        fillResult = await fillTextElement(element, value);
      }

      if (fillResult.error) {
        return {
          error: fillResult.error,
          elementInfo,
        };
      }

      return {
        success: true,
        message: 'Element filled successfully',
        elementInfo: {
          ...elementInfo,
          value: element.value || element.textContent, // Include the final value in the response
        },
        fillResult,
      };
    } catch (error) {
      return {
        error: `Error filling element: ${error.message}`,
      };
    }
  }

  /**
   * Fill a select element
   * @param {HTMLSelectElement} element - The select element
   * @param {string} value - Value to select
   */
  async function fillSelectElement(element, value) {
    try {
      // Find the option with matching value or text
      let optionFound = false;
      
      for (const option of element.options) {
        if (option.value === value || option.text === value || option.textContent.trim() === value) {
          element.value = option.value;
          option.selected = true;
          optionFound = true;
          break;
        }
      }

      if (!optionFound) {
        // Try partial match
        for (const option of element.options) {
          if (option.text.toLowerCase().includes(value.toLowerCase()) || 
              option.textContent.toLowerCase().includes(value.toLowerCase())) {
            element.value = option.value;
            option.selected = true;
            optionFound = true;
            break;
          }
        }
      }

      if (!optionFound) {
        return {
          error: `No option with value or text "${value}" found in select element`,
        };
      }

      // Trigger change event
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Fill checkbox or radio button
   * @param {HTMLInputElement} element - The checkbox/radio element
   * @param {any} value - Value to set (truthy/falsy for checkbox, specific value for radio)
   */
  async function fillCheckboxRadio(element, value) {
    try {
      if (element.type === 'checkbox') {
        const shouldCheck = Boolean(value) && value !== 'false' && value !== '0';
        element.checked = shouldCheck;
      } else if (element.type === 'radio') {
        // For radio buttons, check if the value matches
        if (element.value === value || element.value === String(value)) {
          element.checked = true;
        } else {
          element.checked = false;
        }
      }

      // Trigger events
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('click', { bubbles: true }));

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Fill text-based elements (input, textarea)
   * @param {HTMLElement} element - The input/textarea element
   * @param {string} value - Value to fill
   */
  async function fillTextElement(element, value) {
    try {
      // Focus the element (unless it's hidden)
      if (element.type !== 'hidden') {
        element.focus();
        
        // Trigger focus events
        element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      }

      // Clear the current value using multiple strategies
      if (element.value && element.value.length > 0) {
        // Strategy 1: Select all and delete
        element.select();
        
        // Strategy 2: Set value to empty
        element.value = '';
        
        // Strategy 3: For contenteditable elements
        if (element.isContentEditable) {
          element.textContent = '';
          element.innerHTML = '';
        }
        
        // Trigger input event for clearing
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Set the new value - character by character for better framework compatibility
      element.value = '';
      
      // Type value character by character for React/Vue/Angular compatibility
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
        
        // Small delay for very reactive frameworks
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      // Final value set to ensure it's correct
      element.value = value;
      
      // Trigger final events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Blur the element (unless it's hidden)
      if (element.type !== 'hidden') {
        element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        element.blur();
      }

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Clear an element's value
   * @param {string} selector - CSS selector for the element to clear
   */
  async function clearElement(selector) {
    try {
      const element = document.querySelector(selector);
      if (!element) {
        return {
          error: `Element with selector "${selector}" not found`,
        };
      }

      // Focus the element
      if (element.type !== 'hidden') {
        element.focus();
      }

      // Clear using multiple strategies
      if (element.type === 'checkbox' || element.type === 'radio') {
        element.checked = false;
      } else if (element.tagName === 'SELECT') {
        element.selectedIndex = -1;
        element.value = '';
      } else {
        element.select();
        element.value = '';
        
        if (element.isContentEditable) {
          element.textContent = '';
          element.innerHTML = '';
        }
      }
      
      // Trigger events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      if (element.type !== 'hidden') {
        element.blur();
      }

      return {
        success: true,
        message: 'Element cleared successfully',
        selector,
      };
    } catch (error) {
      return {
        error: `Error clearing element: ${error.message}`,
      };
    }
  }

  /**
   * Check if an element is visible
   * @param {Element} element - The element to check
   * @returns {boolean} - Whether the element is visible
   */
  function isElementVisible(element) {
    if (!element) return false;

    // Hidden inputs are considered "visible" for filling purposes
    if (element.type === 'hidden') return true;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    return true;
  }

  // Listen for messages from the extension background or content scripts
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'fillElement') {
      fillElement(request.selector, request.value)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            error: `Unexpected error: ${error.message}`,
          });
        });
      return true; // Indicates async response
    } else if (request.action === 'clearElement') {
      clearElement(request.selector)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            error: `Unexpected error: ${error.message}`,
          });
        });
      return true; // Indicates async response
    } else if (request.action === 'chrome_fill_helper_ping') {
      sendResponse({ status: 'pong' });
      return false;
    }
  });
}