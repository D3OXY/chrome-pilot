// Enhanced screenshot helper - Chrome Pilot
// This script handles page preparation, scrolling, element positioning for screenshots

if (window.__SCREENSHOT_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__SCREENSHOT_HELPER_INITIALIZED__ = true;

  // Save original styles
  let originalOverflowStyle = '';
  let hiddenFixedElements = [];

  /**
   * Get fixed/sticky positioned elements that might interfere with screenshots
   * @returns {Array} Array of fixed/sticky elements with their original styles
   */
  function getFixedElements() {
    const fixed = [];

    document.querySelectorAll('*').forEach((el) => {
      const htmlEl = el;
      const style = window.getComputedStyle(htmlEl);
      if (style.position === 'fixed' || style.position === 'sticky') {
        // Filter out tiny or invisible elements, and Chrome extension elements
        if (
          htmlEl.offsetWidth > 1 &&
          htmlEl.offsetHeight > 1 &&
          !htmlEl.id.startsWith('chrome-') &&
          !htmlEl.className.includes('chrome-extension')
        ) {
          fixed.push({
            element: htmlEl,
            originalDisplay: htmlEl.style.display,
            originalVisibility: htmlEl.style.visibility,
          });
        }
      }
    });
    return fixed;
  }

  /**
   * Hide fixed/sticky elements that might create overlays during screenshots
   */
  function hideFixedElements() {
    hiddenFixedElements = getFixedElements();
    hiddenFixedElements.forEach((item) => {
      item.element.style.display = 'none';
    });
  }

  /**
   * Restore previously hidden fixed/sticky elements
   */
  function showFixedElements() {
    hiddenFixedElements.forEach((item) => {
      item.element.style.display = item.originalDisplay || '';
    });
    hiddenFixedElements = [];
  }

  /**
   * Prepare page for screenshot capture
   * @param {Object} options - Preparation options
   */
  function preparePageForCapture(options = {}) {
    const { fullPage = false } = options;

    // Hide main scrollbar
    originalOverflowStyle = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    // Hide fixed elements for full page screenshots to avoid duplication
    if (fullPage) {
      hideFixedElements();
    }

    return { success: true };
  }

  /**
   * Get comprehensive page details for screenshot planning
   */
  function getPageDetails() {
    const body = document.body;
    const html = document.documentElement;
    
    return {
      totalWidth: Math.max(
        body.scrollWidth,
        body.offsetWidth,
        html.clientWidth,
        html.scrollWidth,
        html.offsetWidth,
      ),
      totalHeight: Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight,
      ),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      currentScrollX: window.scrollX,
      currentScrollY: window.scrollY,
      documentReady: document.readyState === 'complete',
    };
  }

  /**
   * Get details for a specific element for element-based screenshots
   * @param {string} selector - CSS selector for the element
   */
  function getElementDetails(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      return { error: `Element with selector "${selector}" not found.` };
    }

    // Scroll element into view for accurate positioning
    element.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
    
    // Wait for scroll to complete
    return new Promise((resolve) => {
      setTimeout(() => {
        const rect = element.getBoundingClientRect();
        resolve({
          rect: { 
            x: rect.left, 
            y: rect.top, 
            width: rect.width, 
            height: rect.height,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
          },
          devicePixelRatio: window.devicePixelRatio || 1,
          isVisible: isElementVisible(element),
          tagName: element.tagName,
          id: element.id || '',
          className: element.className || '',
        });
      }, 200);
    });
  }

  /**
   * Scroll the page to specific coordinates
   * @param {number} x - X coordinate to scroll to
   * @param {number} y - Y coordinate to scroll to
   * @param {number} scrollDelay - Delay to wait after scrolling
   */
  function scrollPage(x, y, scrollDelay = 300) {
    window.scrollTo({ left: x, top: y, behavior: 'instant' });
    
    // Wait for scroll completion and potential lazy loading
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          newScrollX: window.scrollX,
          newScrollY: window.scrollY,
        });
      }, scrollDelay);
    });
  }

  /**
   * Reset page after screenshot capture
   * @param {number} scrollX - Original X scroll position to restore
   * @param {number} scrollY - Original Y scroll position to restore
   */
  function resetPageAfterCapture(scrollX = 0, scrollY = 0) {
    // Restore overflow style
    document.documentElement.style.overflow = originalOverflowStyle;
    
    // Show hidden fixed elements
    showFixedElements();
    
    // Restore scroll position
    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    
    return { success: true };
  }

  /**
   * Check if an element is visible
   * @param {Element} element - The element to check
   * @returns {boolean} - Whether the element is visible
   */
  function isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  /**
   * Highlight an element for screenshot purposes
   * @param {string} selector - CSS selector for the element to highlight
   * @param {Object} options - Highlight options
   */
  function highlightElement(selector, options = {}) {
    const element = document.querySelector(selector);
    if (!element) {
      return { error: `Element with selector "${selector}" not found.` };
    }

    const { 
      borderColor = '#ff0000', 
      borderWidth = '2px', 
      borderStyle = 'solid',
      backgroundColor = 'rgba(255, 0, 0, 0.1)',
      duration = 0 // 0 means permanent until unhighlight is called
    } = options;

    // Store original styles
    const originalStyle = {
      border: element.style.border,
      backgroundColor: element.style.backgroundColor,
      outline: element.style.outline,
      zIndex: element.style.zIndex,
    };

    // Apply highlight styles
    element.style.border = `${borderWidth} ${borderStyle} ${borderColor}`;
    element.style.backgroundColor = backgroundColor;
    element.style.outline = 'none';
    element.style.zIndex = '9999';

    // Store reference for unhighlighting
    if (!window.__highlighted_elements__) {
      window.__highlighted_elements__ = new Map();
    }
    window.__highlighted_elements__.set(element, originalStyle);

    // Auto-remove highlight after duration
    if (duration > 0) {
      setTimeout(() => {
        unhighlightElement(selector);
      }, duration);
    }

    return { 
      success: true, 
      selector,
      highlightApplied: true 
    };
  }

  /**
   * Remove highlight from an element
   * @param {string} selector - CSS selector for the element to unhighlight
   */
  function unhighlightElement(selector) {
    const element = document.querySelector(selector);
    if (!element || !window.__highlighted_elements__) {
      return { error: `Element with selector "${selector}" not found or not highlighted.` };
    }

    const originalStyle = window.__highlighted_elements__.get(element);
    if (originalStyle) {
      // Restore original styles
      element.style.border = originalStyle.border;
      element.style.backgroundColor = originalStyle.backgroundColor;
      element.style.outline = originalStyle.outline;
      element.style.zIndex = originalStyle.zIndex;

      window.__highlighted_elements__.delete(element);
    }

    return { 
      success: true, 
      selector,
      highlightRemoved: true 
    };
  }

  /**
   * Remove all highlights
   */
  function removeAllHighlights() {
    if (!window.__highlighted_elements__) return { success: true, count: 0 };

    let count = 0;
    for (const [element, originalStyle] of window.__highlighted_elements__) {
      element.style.border = originalStyle.border;
      element.style.backgroundColor = originalStyle.backgroundColor;
      element.style.outline = originalStyle.outline;
      element.style.zIndex = originalStyle.zIndex;
      count++;
    }

    window.__highlighted_elements__.clear();
    return { success: true, count };
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    try {
      switch (request.action) {
        case 'chrome_screenshot_ping':
          sendResponse({ status: 'pong' });
          return false;

        case 'preparePageForCapture':
          const prepareResult = preparePageForCapture(request.options || {});
          // Give styles a moment to apply
          setTimeout(() => {
            sendResponse(prepareResult);
          }, 50);
          return true; // Async response

        case 'getPageDetails':
          sendResponse(getPageDetails());
          return false;

        case 'getElementDetails':
          getElementDetails(request.selector)
            .then(sendResponse)
            .catch((error) => {
              sendResponse({ error: error.message });
            });
          return true; // Async response

        case 'scrollPage':
          scrollPage(request.x, request.y, request.scrollDelay)
            .then(sendResponse)
            .catch((error) => {
              sendResponse({ error: error.message });
            });
          return true; // Async response

        case 'resetPageAfterCapture':
          const resetResult = resetPageAfterCapture(request.scrollX, request.scrollY);
          sendResponse(resetResult);
          return false;

        case 'highlightElement':
          const highlightResult = highlightElement(request.selector, request.options);
          sendResponse(highlightResult);
          return false;

        case 'unhighlightElement':
          const unhighlightResult = unhighlightElement(request.selector);
          sendResponse(unhighlightResult);
          return false;

        case 'removeAllHighlights':
          const removeResult = removeAllHighlights();
          sendResponse(removeResult);
          return false;

        default:
          sendResponse({ error: `Unknown action: ${request.action}` });
          return false;
      }
    } catch (error) {
      console.error('Screenshot helper error:', error);
      sendResponse({ error: error.message });
      return false;
    }
  });

  console.log('Screenshot helper script loaded');
}