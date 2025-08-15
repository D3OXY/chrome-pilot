// Chrome Pilot Inject Bridge - Communication between ISOLATED and MAIN worlds
// Based on reference project pattern for advanced script execution

(() => {
  // Prevent duplicate injection of the bridge
  if (window.__CHROME_PILOT_INJECT_BRIDGE_LOADED__) return;
  window.__CHROME_PILOT_INJECT_BRIDGE_LOADED__ = true;
  
  const EVENT_NAME = {
    RESPONSE: 'chrome-pilot:response',
    CLEANUP: 'chrome-pilot:cleanup', 
    EXECUTE: 'chrome-pilot:execute',
  };
  
  const pendingRequests = new Map();

  const messageHandler = (request, _sender, sendResponse) => {
    // --- Lifecycle Command ---
    if (request.type === EVENT_NAME.CLEANUP) {
      window.dispatchEvent(new CustomEvent(EVENT_NAME.CLEANUP));
      // Acknowledge cleanup signal received
      sendResponse({ success: true });
      return true;
    }

    // --- Execution Command for MAIN world ---
    if (request.targetWorld === 'MAIN') {
      const requestId = `req-${Date.now()}-${Math.random()}`;
      pendingRequests.set(requestId, sendResponse);

      window.dispatchEvent(
        new CustomEvent(EVENT_NAME.EXECUTE, {
          detail: {
            action: request.action,
            payload: request.payload,
            requestId: requestId,
          },
        }),
      );
      return true; // Async response expected
    }
    
    // Handle ping for bridge health check
    if (request.action === 'chrome_inject_bridge_ping') {
      sendResponse({ status: 'pong' });
      return false;
    }
  };

  chrome.runtime.onMessage.addListener(messageHandler);

  // Listen for responses coming back from the MAIN world
  const responseHandler = (event) => {
    const { requestId, data, error } = event.detail;
    if (pendingRequests.has(requestId)) {
      const sendResponse = pendingRequests.get(requestId);
      sendResponse({ data, error });
      pendingRequests.delete(requestId);
    }
  };
  window.addEventListener(EVENT_NAME.RESPONSE, responseHandler);

  // --- Self Cleanup ---
  // When the cleanup signal arrives, this bridge must also clean itself up
  const cleanupHandler = () => {
    chrome.runtime.onMessage.removeListener(messageHandler);
    window.removeEventListener(EVENT_NAME.RESPONSE, responseHandler);
    window.removeEventListener(EVENT_NAME.CLEANUP, cleanupHandler);
    delete window.__CHROME_PILOT_INJECT_BRIDGE_LOADED__;
    
    // Clear any pending requests
    pendingRequests.clear();
    
    console.log('Chrome Pilot inject bridge cleaned up');
  };
  window.addEventListener(EVENT_NAME.CLEANUP, cleanupHandler);

  console.log('Chrome Pilot inject bridge loaded');
})();