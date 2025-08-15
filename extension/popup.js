// Chrome MCP Controller - Popup Script

document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const wsUrlInput = document.getElementById('wsUrl');
  const saveConfigBtn = document.getElementById('saveConfig');
  const reconnectBtn = document.getElementById('reconnect');
  const testConnectionBtn = document.getElementById('testConnection');
  const getTabsBtn = document.getElementById('getTabs');
  const logDiv = document.getElementById('log');

  // Load saved configuration
  chrome.storage.local.get(['wsServerUrl'], (result) => {
    if (result.wsServerUrl) {
      wsUrlInput.value = result.wsServerUrl;
    } else {
      wsUrlInput.value = 'ws://172.25.0.1:9222/ws'; // Default WSL IP
    }
  });

  // Update status from background script
  function updateStatus() {
    chrome.runtime.sendMessage({action: 'getConnectionStatus'}, (response) => {
      if (response && response.connected) {
        statusDiv.textContent = 'Connected';
        statusDiv.className = 'status connected';
      } else {
        statusDiv.textContent = 'Disconnected';
        statusDiv.className = 'status disconnected';
      }
    });
  }

  // Log messages
  function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    logDiv.innerHTML += `[${timestamp}] ${message}<br>`;
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  // Save configuration
  saveConfigBtn.addEventListener('click', () => {
    const wsUrl = wsUrlInput.value.trim();
    if (!wsUrl) {
      log('Error: WebSocket URL is required');
      return;
    }

    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      log('Error: URL must start with ws:// or wss://');
      return;
    }

    chrome.storage.local.set({wsServerUrl: wsUrl}, () => {
      log(`Configuration saved: ${wsUrl}`);
      // The background script will automatically reconnect due to storage change listener
    });
  });

  // Manual reconnect
  reconnectBtn.addEventListener('click', () => {
    log('Attempting to reconnect...');
    chrome.runtime.sendMessage({action: 'reconnect'}, (response) => {
      if (response && response.success) {
        log('Reconnection initiated');
      } else {
        log('Reconnection failed');
      }
    });
  });

  // Test connection
  testConnectionBtn.addEventListener('click', () => {
    log('Testing connection...');
    chrome.runtime.sendMessage({action: 'testConnection'}, (response) => {
      if (response && response.success) {
        log('✅ Connection test successful');
      } else {
        log(`❌ Connection test failed: ${response ? response.error : 'Unknown error'}`);
      }
    });
  });

  // Get tabs test
  getTabsBtn.addEventListener('click', () => {
    log('Getting tabs...');
    chrome.runtime.sendMessage({action: 'getTabs'}, (response) => {
      if (response && response.success) {
        log(`✅ Found ${response.data.length} tabs`);
        response.data.forEach((tab, index) => {
          log(`  ${index + 1}. ${tab.title} (${tab.url})`);
        });
      } else {
        log(`❌ Get tabs failed: ${response ? response.error : 'Unknown error'}`);
      }
    });
  });

  // Update status periodically
  updateStatus();
  setInterval(updateStatus, 2000);

  // Listen for status updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'statusUpdate') {
      log(message.message);
      updateStatus();
    }
  });

  log('Popup initialized');
});