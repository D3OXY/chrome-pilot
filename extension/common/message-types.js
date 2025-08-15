// Message type constants for Chrome Pilot extension communication
// Based on reference project patterns

// Message targets for routing
export const MessageTarget = {
  BACKGROUND: 'background',
  CONTENT_SCRIPT: 'content_script',
  HELPER_SCRIPT: 'helper_script',
};

// Background script message types
export const BACKGROUND_MESSAGE_TYPES = {
  GET_TABS: 'get_tabs',
  GET_ACTIVE_TAB: 'get_active_tab',
  NAVIGATE: 'navigate',
  CLOSE_TAB: 'close_tab',
  CREATE_TAB: 'create_tab',
  SCREENSHOT: 'screenshot',
  INJECT_SCRIPT: 'inject_script',
  SEND_COMMAND_TO_INJECT_SCRIPT: 'send_command_to_inject_script',
};

// Content script message types
export const CONTENT_MESSAGE_TYPES = {
  CONTENT_PING: 'chrome_content_ping',
  GET_INTERACTIVE_ELEMENTS: 'get_interactive_elements',
  CLICK_ENHANCED: 'click_enhanced',
  FILL_FORM: 'fill_form',
  WAIT_FOR_ELEMENT: 'wait_for_element',
  GET_PAGE_INFO: 'get_page_info',
  GET_WEB_CONTENT: 'get_web_content',
  FIND_ELEMENTS_BY_TEXT: 'find_elements_by_text',
  SCROLL_TO_ELEMENT: 'scroll_to_element',
  CLICK_COORDINATES: 'click_coordinates',
};

// Helper script action message types (for chrome.runtime.sendMessage)
export const HELPER_MESSAGE_TYPES = {
  // Screenshot related
  SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE: 'preparePageForCapture',
  SCREENSHOT_GET_PAGE_DETAILS: 'getPageDetails',
  SCREENSHOT_GET_ELEMENT_DETAILS: 'getElementDetails',
  SCREENSHOT_SCROLL_PAGE: 'scrollPage',
  SCREENSHOT_RESET_PAGE_AFTER_CAPTURE: 'resetPageAfterCapture',

  // Web content fetching
  WEB_FETCHER_GET_HTML_CONTENT: 'getHTMLContent',
  WEB_FETCHER_GET_TEXT_CONTENT: 'getTextContent',

  // User interactions
  CLICK_ELEMENT: 'clickElement',
  FILL_ELEMENT: 'fillElement',
  CLEAR_ELEMENT: 'clearElement',
  SIMULATE_KEYBOARD: 'simulateKeyboard',

  // Interactive elements
  GET_INTERACTIVE_ELEMENTS: 'getInteractiveElements',

  // Network requests
  NETWORK_SEND_REQUEST: 'sendPureNetworkRequest',
};

// Ping action names for health checks
export const PING_ACTIONS = {
  CONTENT_SCRIPT: 'chrome_content_ping',
  FILL_HELPER: 'chrome_fill_helper_ping',
  CLICK_HELPER: 'chrome_click_element_ping',
  INTERACTIVE_ELEMENTS_HELPER: 'chrome_interactive_elements_ping',
  WEB_FETCHER_HELPER: 'chrome_web_fetcher_ping',
  SCREENSHOT_HELPER: 'chrome_screenshot_helper_ping',
  INJECT_BRIDGE: 'chrome_inject_bridge_ping',
};

// Inject bridge event names
export const INJECT_BRIDGE_EVENTS = {
  RESPONSE: 'chrome-pilot:response',
  CLEANUP: 'chrome-pilot:cleanup',
  EXECUTE: 'chrome-pilot:execute',
};

// WebSocket server action types (what the server sends)
export const WEBSOCKET_ACTIONS = {
  // Tab management
  GET_TABS: 'get_tabs',
  GET_ACTIVE_TAB: 'get_active_tab',
  NAVIGATE: 'navigate',
  CLOSE_TAB: 'close_tab',
  CREATE_TAB: 'create_tab',

  // Page interactions
  CLICK: 'click',
  CLICK_ENHANCED: 'click_enhanced',
  FILL_ENHANCED: 'fill_enhanced',
  CLEAR_ENHANCED: 'clear_enhanced',
  SCROLL: 'scroll',
  
  // Content extraction
  GET_CONTENT: 'get_content',
  GET_WEB_CONTENT: 'get_web_content',
  GET_HTML_CONTENT: 'get_html_content',
  GET_INTERACTIVE_ELEMENTS: 'get_interactive_elements',
  
  // Advanced operations
  WAIT_FOR_ELEMENT: 'wait_for_element',
  SCREENSHOT: 'screenshot',
  INJECT_SCRIPT: 'inject_script',
  SEND_COMMAND_TO_INJECT_SCRIPT: 'send_command_to_inject_script',
};

// Export all as default for easy importing
export default {
  MessageTarget,
  BACKGROUND_MESSAGE_TYPES,
  CONTENT_MESSAGE_TYPES,
  HELPER_MESSAGE_TYPES,
  PING_ACTIONS,
  INJECT_BRIDGE_EVENTS,
  WEBSOCKET_ACTIONS,
};