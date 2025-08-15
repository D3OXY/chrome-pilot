// Advanced interactive elements helper - Chrome Pilot
// This script provides comprehensive element detection with multi-layered search strategies

(function () {
  // Prevent re-initialization
  if (window.__INTERACTIVE_ELEMENTS_HELPER_INITIALIZED__) {
    return;
  }
  window.__INTERACTIVE_ELEMENTS_HELPER_INITIALIZED__ = true;

  /**
   * Configuration for element types and their corresponding selectors.
   * Comprehensive list including ARIA roles for modern web apps.
   */
  const ELEMENT_CONFIG = {
    button: 'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]',
    link: 'a[href], [role="link"]',
    input: 'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"])',
    checkbox: 'input[type="checkbox"], [role="checkbox"]',
    radio: 'input[type="radio"], [role="radio"]',
    textarea: 'textarea',
    select: 'select',
    tab: '[role="tab"]',
    menuitem: '[role="menuitem"]',
    slider: '[role="slider"]',
    option: '[role="option"]',
    treeitem: '[role="treeitem"]',
    // Generic interactive elements: combines tabindex, common roles, and explicit handlers
    interactive: `[onclick], [onmousedown], [onmouseup], [tabindex]:not([tabindex^="-"]), [role="menuitem"], [role="slider"], [role="option"], [role="treeitem"]`,
  };

  // Combined selector for ANY interactive element
  const ANY_INTERACTIVE_SELECTOR = Object.values(ELEMENT_CONFIG).join(', ');

  /**
   * Checks if an element is genuinely visible on the page.
   * @param {Element} el The element to check.
   * @returns {boolean} True if the element is visible.
   */
  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;

    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0
    ) {
      return false;
    }

    const rect = el.getBoundingClientRect();
    // Allow zero-size anchors and hidden inputs as they can still be interactive
    return rect.width > 0 || rect.height > 0 || el.tagName === 'A' || el.type === 'hidden';
  }

  /**
   * Checks if an element is considered interactive (not disabled or hidden from accessibility).
   * @param {Element} el The element to check.
   * @returns {boolean} True if the element is interactive.
   */
  function isElementInteractive(el) {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
      return false;
    }
    if (el.closest('[aria-hidden="true"]')) {
      return false;
    }
    return true;
  }

  /**
   * Generates a stable CSS selector for a given element.
   * @param {Element} el The element.
   * @returns {string} A CSS selector.
   */
  function generateSelector(el) {
    if (!(el instanceof Element)) return '';

    // Try ID first if it's unique
    if (el.id) {
      const idSelector = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) return idSelector;
    }

    // Try data attributes commonly used for testing
    for (const attr of ['data-testid', 'data-cy', 'data-test', 'name']) {
      const attrValue = el.getAttribute(attr);
      if (attrValue) {
        const attrSelector = `[${attr}="${CSS.escape(attrValue)}"]`;
        if (document.querySelectorAll(attrSelector).length === 1) return attrSelector;
      }
    }

    // Try class-based selector
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(' ').filter(c => c && !c.startsWith('_')); // Filter out dynamic classes
      if (classes.length > 0) {
        const classSelector = `${el.tagName.toLowerCase()}.${CSS.escape(classes[0])}`;
        if (document.querySelectorAll(classSelector).length <= 3) { // Allow some duplicates
          return classSelector;
        }
      }
    }

    // Build path-based selector
    let path = '';
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName !== 'BODY') {
      let selector = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === current.tagName,
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      path = path ? `${selector} > ${path}` : selector;
      current = parent;
    }
    return path ? `body > ${path}` : 'body';
  }

  /**
   * Finds the accessible name for an element (label, aria-label, etc.).
   * @param {Element} el The element.
   * @returns {string} The accessible name.
   */
  function getAccessibleName(el) {
    // aria-labelledby reference
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const labelElement = document.getElementById(labelledby);
      if (labelElement) return labelElement.textContent?.trim() || '';
    }

    // Direct aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // Associated label element
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent?.trim() || '';
    }

    // Parent label
    const parentLabel = el.closest('label');
    if (parentLabel) {
      // Get text content but exclude the input's own text
      const labelText = parentLabel.textContent?.trim() || '';
      return labelText;
    }

    // Element content
    let text = el.textContent?.trim() || '';
    
    // For inputs, try placeholder, value, or alt
    if (!text && el.tagName === 'INPUT') {
      text = el.getAttribute('placeholder') || 
             el.getAttribute('value') || 
             el.getAttribute('alt') || '';
    }

    // For images, try alt or title
    if (!text && el.tagName === 'IMG') {
      text = el.getAttribute('alt') || el.getAttribute('title') || '';
    }

    // Generic title attribute
    if (!text) {
      text = el.getAttribute('title') || '';
    }

    return text;
  }

  /**
   * Simple subsequence matching for fuzzy search.
   * @param {string} text The text to search within.
   * @param {string} query The query subsequence.
   * @returns {boolean}
   */
  function fuzzyMatch(text, query) {
    if (!text || !query) return false;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let textIndex = 0;
    let queryIndex = 0;
    while (textIndex < lowerText.length && queryIndex < lowerQuery.length) {
      if (lowerText[textIndex] === lowerQuery[queryIndex]) {
        queryIndex++;
      }
      textIndex++;
    }
    return queryIndex === lowerQuery.length;
  }

  /**
   * Creates the standardized info object for an element.
   */
  function createElementInfo(el, type, includeCoordinates, isInteractiveOverride = null) {
    const isActuallyInteractive = isElementInteractive(el);
    const accessibleName = getAccessibleName(el);
    
    const info = {
      type,
      selector: generateSelector(el),
      text: accessibleName || el.textContent?.trim() || '',
      isInteractive: isInteractiveOverride !== null ? isInteractiveOverride : isActuallyInteractive,
      disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      className: el.className || '',
    };

    // Add element-specific properties
    if (el.href) info.href = el.href;
    if (el.type) info.inputType = el.type;
    if (el.value !== undefined) info.value = el.value;
    if (el.checked !== undefined) info.checked = el.checked;
    if (el.selected !== undefined) info.selected = el.selected;

    if (includeCoordinates) {
      const rect = el.getBoundingClientRect();
      info.coordinates = {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
        },
      };
    }
    return info;
  }

  /**
   * High-performance Layer 1 search function for interactive elements.
   */
  function findInteractiveElements(options = {}) {
    const { textQuery, includeCoordinates = true, types = Object.keys(ELEMENT_CONFIG) } = options;

    const selectorsToFind = types
      .map((type) => ELEMENT_CONFIG[type])
      .filter(Boolean)
      .join(', ');
    if (!selectorsToFind) return [];

    const targetElements = Array.from(document.querySelectorAll(selectorsToFind));
    const uniqueElements = new Set(targetElements);
    const results = [];

    for (const el of uniqueElements) {
      if (!isElementVisible(el) || !isElementInteractive(el)) continue;

      const accessibleName = getAccessibleName(el);
      if (textQuery && !fuzzyMatch(accessibleName, textQuery)) continue;

      // Determine element type
      let elementType = 'interactive';
      for (const [type, typeSelector] of Object.entries(ELEMENT_CONFIG)) {
        if (el.matches(typeSelector)) {
          elementType = type;
          break;
        }
      }
      results.push(createElementInfo(el, elementType, includeCoordinates));
    }
    return results;
  }

  /**
   * The main entry point that implements the 3-layer fallback logic.
   * @param {object} options - The main search options.
   * @returns {Array} Array of element info objects
   */
  function findElementsByTextWithFallback(options = {}) {
    const { textQuery, includeCoordinates = true } = options;

    if (!textQuery) {
      return findInteractiveElements({ ...options, types: Object.keys(ELEMENT_CONFIG) });
    }

    // Layer 1: High-reliability search for interactive elements matching text
    let results = findInteractiveElements({ ...options, types: Object.keys(ELEMENT_CONFIG) });
    if (results.length > 0) {
      return results;
    }

    // Layer 2: Find text, then find its interactive ancestor
    const lowerCaseText = textQuery.toLowerCase();
    const xPath = `//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lowerCaseText}')]`;
    const textNodes = document.evaluate(
      xPath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );

    const interactiveElements = new Set();
    if (textNodes.snapshotLength > 0) {
      for (let i = 0; i < textNodes.snapshotLength; i++) {
        const parentElement = textNodes.snapshotItem(i).parentElement;
        if (parentElement) {
          const interactiveAncestor = parentElement.closest(ANY_INTERACTIVE_SELECTOR);
          if (
            interactiveAncestor &&
            isElementVisible(interactiveAncestor) &&
            isElementInteractive(interactiveAncestor)
          ) {
            interactiveElements.add(interactiveAncestor);
          }
        }
      }

      if (interactiveElements.size > 0) {
        return Array.from(interactiveElements).map((el) => {
          let elementType = 'interactive';
          for (const [type, typeSelector] of Object.entries(ELEMENT_CONFIG)) {
            if (el.matches(typeSelector)) {
              elementType = type;
              break;
            }
          }
          return createElementInfo(el, elementType, includeCoordinates);
        });
      }
    }

    // Layer 3: Final fallback, return any element containing the text
    const leafElements = new Set();
    for (let i = 0; i < textNodes.snapshotLength; i++) {
      const parentElement = textNodes.snapshotItem(i).parentElement;
      if (parentElement && isElementVisible(parentElement)) {
        leafElements.add(parentElement);
      }
    }

    // Filter to get leaf elements (no child elements)
    const finalElements = Array.from(leafElements).filter((el) => {
      return ![...leafElements].some((otherEl) => el !== otherEl && el.contains(otherEl));
    });

    return finalElements.map((el) => createElementInfo(el, 'text', includeCoordinates, true));
  }

  /**
   * Find elements by various criteria
   */
  function findElements(options = {}) {
    const { selector, textQuery, includeCoordinates = true, types } = options;

    if (selector) {
      // Direct selector-based search
      const foundEls = Array.from(document.querySelectorAll(selector));
      return foundEls
        .filter(el => isElementVisible(el))
        .map((el) =>
          createElementInfo(
            el,
            'selected',
            includeCoordinates,
            isElementInteractive(el),
          ),
        );
    } else {
      // Text-based or comprehensive search
      return findElementsByTextWithFallback(options);
    }
  }

  // Chrome Message Listener
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'getInteractiveElements') {
      try {
        const elements = findElements(request);
        sendResponse({ success: true, elements });
      } catch (error) {
        console.error('Error in getInteractiveElements:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Async response
    } else if (request.action === 'chrome_interactive_elements_ping') {
      sendResponse({ status: 'pong' });
      return false;
    }
  });

  console.log('Interactive elements helper script loaded');
})();