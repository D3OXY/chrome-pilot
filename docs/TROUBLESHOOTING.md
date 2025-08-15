# Troubleshooting Guide

Common issues and solutions for Chrome MCP Server development and deployment.

## Quick Diagnostics

Run this checklist first:

```bash
# 1. Check Node.js version
node --version  # Should be >= 18.0.0

# 2. Test server directly
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node server/dist/index.js stdio

# 3. Check extension loaded
# Go to chrome://extensions/ and verify extension is enabled

# 4. Test native messaging
# Open extension service worker console and run:
chrome.runtime.connectNative('com.chrome_mcp.host')
```

## Common Issues

### Extension Issues

#### Extension Won't Load

**Error:** "Manifest file is missing or unreadable"

**Solutions:**
1. Verify manifest.json exists in extension directory
2. Check JSON syntax:
```bash
# Validate JSON
python -m json.tool < manifest.json
```
3. Ensure no trailing commas in JSON

---

**Error:** "Invalid manifest version"

**Solutions:**
1. Use `"manifest_version": 3` for Chrome 88+
2. For older Chrome, use manifest v2 (not recommended)

---

**Error:** "Permission 'nativeMessaging' is unknown"

**Solutions:**
1. Ensure Chrome version supports native messaging (Chrome 29+)
2. Check spelling of permission exactly matches

#### Service Worker Not Starting

**Symptoms:** Background script doesn't run, no console logs

**Solutions:**
1. Check for syntax errors in background.js:
```javascript
// Add at top of background.js
console.log('Service worker starting...');
```

2. Check DevTools for service worker:
   - Open `chrome://extensions/`
   - Click "Service Worker" link
   - Check console for errors

3. Ensure service worker registration:
```json
"background": {
  "service_worker": "background.js",
  "type": "module"  // If using ES modules
}
```

### Native Messaging Issues

#### "Specified native messaging host not found"

**Solutions:**

1. **Verify manifest location:**
```bash
# Windows
dir "%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\"

# macOS
ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# Linux
ls ~/.config/google-chrome/NativeMessagingHosts/
```

2. **Check registry (Windows):**
```batch
REG QUERY "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chrome_mcp.host"
```

3. **Validate manifest JSON:**
```javascript
// test-manifest.js
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('com.chrome_mcp.host.json', 'utf8'));
console.log('Valid JSON:', manifest);
```

---

#### "Native host has exited"

**Common Causes:**

1. **Script not executable (Linux/macOS):**
```bash
chmod +x native-host.sh
chmod +x server/dist/index.js
```

2. **Node.js not in PATH:**
```bash
which node  # Should return path
# If not found, add to PATH or use full path in script
```

3. **Syntax error in native host:**
```bash
# Test directly
node server/dist/index.js native
```

4. **Wrong shebang line:**
```javascript
#!/usr/bin/env node  // Correct
#!/usr/bin/node     // May fail if node is elsewhere
```

---

#### "Access to native messaging host forbidden"

**Solutions:**

1. **Check extension ID matches:**
```javascript
// In extension console
chrome.runtime.id  // Get actual ID
```

Update manifest:
```json
"allowed_origins": ["chrome-extension://YOUR_ACTUAL_ID/"]
```

2. **Verify trailing slash:**
```json
// Correct - has trailing slash
"allowed_origins": ["chrome-extension://abc123/"]

// Wrong - missing trailing slash
"allowed_origins": ["chrome-extension://abc123"]
```

### MCP Server Issues

#### Server Crashes Immediately

**Debug Steps:**

1. **Run with verbose logging:**
```javascript
// Add to server/src/index.ts
console.error('Starting server...');
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
```

2. **Check for missing dependencies:**
```bash
cd server
npm list
npm install  # Reinstall if needed
```

3. **Verify TypeScript compilation:**
```bash
npx tsc --noEmit  # Check for errors without building
```

---

#### "Cannot find module" Errors

**Solutions:**

1. **Rebuild project:**
```bash
rm -rf dist node_modules
npm install
npm run build
```

2. **Check import paths:**
```typescript
// Correct for ES modules
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Wrong (missing .js extension)
import { Server } from '@modelcontextprotocol/sdk/server';
```

3. **Verify package.json type:**
```json
{
  "type": "module"  // For ES modules
}
```

### Communication Issues

#### No Response from Native Host

**Debug Process:**

1. **Add logging to native host:**
```javascript
// native-host.js
const fs = require('fs');
const logFile = '/tmp/native-host.log';

function log(msg) {
  fs.appendFileSync(logFile, `${new Date().toISOString()}: ${msg}\n`);
}

log('Native host started');
process.stdin.on('data', (data) => {
  log(`Received: ${data.length} bytes`);
});
```

2. **Check message format:**
```javascript
// Correct message format
function sendMessage(msg) {
  const json = JSON.stringify(msg);
  const len = Buffer.byteLength(json);
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(len, 0);
  
  process.stdout.write(buf);
  process.stdout.write(json);
}
```

3. **Test with minimal message:**
```javascript
// In extension console
const port = chrome.runtime.connectNative('com.chrome_mcp.host');
port.postMessage({ test: 'ping' });
port.onMessage.addListener(console.log);
port.onDisconnect.addListener(() => {
  console.log('Disconnected:', chrome.runtime.lastError);
});
```

---

#### Message Size Errors

**Error:** "Error when communicating with the native messaging host"

**Solutions:**

1. **Check message size (max 1MB):**
```javascript
const message = { /* your data */ };
const size = JSON.stringify(message).length;
console.log(`Message size: ${size} bytes`);
if (size > 1048576) {
  console.error('Message too large!');
}
```

2. **Split large messages:**
```javascript
function sendLargeData(data) {
  const chunks = [];
  const chunkSize = 500000; // 500KB chunks
  
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  
  chunks.forEach((chunk, index) => {
    port.postMessage({
      type: 'chunk',
      index,
      total: chunks.length,
      data: chunk
    });
  });
}
```

### Tool Execution Issues

#### Content Script Not Injecting

**Solutions:**

1. **Check page CSP:**
```javascript
// Some pages block content scripts
// Try programmatic injection:
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: () => { console.log('Injected!'); }
});
```

2. **Verify permissions:**
```json
{
  "permissions": ["scripting", "activeTab"],
  "host_permissions": ["<all_urls>"]
}
```

3. **Handle special pages:**
```javascript
// Can't inject into chrome:// pages
if (tab.url.startsWith('chrome://')) {
  return { error: 'Cannot inject into Chrome pages' };
}
```

---

#### Click/Input Actions Not Working

**Debug Steps:**

1. **Check element exists:**
```javascript
// In content script
const element = document.querySelector(selector);
if (!element) {
  console.error('Element not found:', selector);
  return { error: 'Element not found' };
}
console.log('Found element:', element);
```

2. **Verify element is visible:**
```javascript
function isVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return rect.width > 0 && 
         rect.height > 0 &&
         style.display !== 'none' &&
         style.visibility !== 'hidden';
}
```

3. **Handle dynamic content:**
```javascript
// Wait for element to appear
async function waitForElement(selector, timeout = 5000) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Element not found after timeout');
}
```

### Claude Integration Issues

#### Claude Doesn't See the Server

**Solutions:**

1. **Verify configuration path:**
```bash
# Find Claude config
# Windows
type "%APPDATA%\Claude\claude_desktop_config.json"

# macOS
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Linux
cat ~/.config/Claude/claude_desktop_config.json
```

2. **Test server independently:**
```bash
# Should list tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node server/dist/index.js stdio
```

3. **Check JSON syntax in config:**
```json
{
  "mcpServers": {
    "chrome": {
      "command": "node",
      "args": ["/absolute/path/to/server/dist/index.js", "stdio"]
    }
  }
}
```

## Debug Logging

### Enable Verbose Logging

```javascript
// server/src/debug.ts
export class Logger {
  static log(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${level}] ${message}`, data || '');
  }
  
  static debug(message: string, data?: any) {
    if (process.env.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }
}

// Use throughout code
Logger.debug('Received command', { action, params });
```

### Chrome Extension Debugging

```javascript
// Enable verbose logging in extension
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log('[Chrome-MCP]', ...args);
  }
}

// Log all messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('Message received:', request);
  // ... handle message
});
```

## Performance Issues

### Slow Response Times

**Optimizations:**

1. **Cache content scripts:**
```javascript
const injectedTabs = new Set();

async function ensureContentScript(tabId) {
  if (injectedTabs.has(tabId)) return;
  
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
  
  injectedTabs.add(tabId);
}
```

2. **Batch operations:**
```javascript
// Instead of multiple calls
await click('#button1');
await click('#button2');
await click('#button3');

// Batch into one call
await batchClick(['#button1', '#button2', '#button3']);
```

3. **Use connection pooling:**
```javascript
class ConnectionPool {
  private connections: Map<string, Port> = new Map();
  
  getConnection(id: string): Port {
    if (!this.connections.has(id)) {
      const port = chrome.runtime.connectNative('com.chrome_mcp.host');
      this.connections.set(id, port);
    }
    return this.connections.get(id)!;
  }
}
```

## Getting Help

### Collect Debug Information

```bash
# Create debug report
cat << EOF > debug-report.txt
Chrome Version: $(google-chrome --version)
Node Version: $(node --version)
OS: $(uname -a)
Extension ID: [paste from chrome://extensions]

Server Test:
$(echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node server/dist/index.js stdio 2>&1)

Native Host Location:
$(ls -la ~/.config/google-chrome/NativeMessagingHosts/ 2>&1)
EOF
```

### Resources

- Chrome Extension Docs: https://developer.chrome.com/docs/extensions/
- MCP Protocol: https://modelcontextprotocol.io
- Node.js Debugging: https://nodejs.org/en/docs/guides/debugging-getting-started/

### Community Support

- Report issues with full debug information
- Include error messages and logs
- Describe expected vs actual behavior
- Share minimal reproducible examples