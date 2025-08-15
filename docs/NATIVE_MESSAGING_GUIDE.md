# Native Messaging Setup Guide

## Overview

Native messaging enables communication between your Chrome extension and the Node.js MCP server. This guide covers setup for all platforms.

## How Native Messaging Works

```
Chrome Extension <--> Native Host (Node.js) <--> MCP Server
     JSON                stdin/stdout              JSON-RPC
```

## Native Host Manifest

### Manifest Structure

Create `com.chrome_mcp.host.json`:

```json
{
  "name": "com.chrome_mcp.host",
  "description": "Chrome MCP Native Messaging Host",
  "path": "/path/to/native-host.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID/"
  ]
}
```

### Getting Your Extension ID

1. Load your extension in Chrome
2. Go to `chrome://extensions/`
3. Find your extension and copy its ID
4. Update the manifest with this ID

## Platform-Specific Installation

### Windows

#### 1. Create Batch Wrapper

Create `native-host.bat`:

```batch
@echo off
node "%~dp0\native-host.js" %*
```

#### 2. Update Manifest Path

```json
{
  "path": "C:\\path\\to\\native-host.bat"
}
```

#### 3. Register with Registry

Create `install-windows.bat`:

```batch
@echo off
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chrome_mcp.host" /ve /t REG_SZ /d "%~dp0\com.chrome_mcp.host.json" /f
echo Native host registered successfully
pause
```

### macOS

#### 1. Install Location

```bash
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
cp com.chrome_mcp.host.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
```

#### 2. Make Executable

```bash
chmod +x /path/to/native-host.js
```

#### 3. Update Manifest

```json
{
  "path": "/Users/username/path/to/native-host.js"
}
```

### Linux/WSL

#### 1. Install Location

```bash
mkdir -p ~/.config/google-chrome/NativeMessagingHosts/
cp com.chrome_mcp.host.json ~/.config/google-chrome/NativeMessagingHosts/
```

#### 2. Create Shell Wrapper

Create `native-host.sh`:

```bash
#!/bin/bash
node "$(dirname "$0")/native-host.js"
```

#### 3. Make Executable

```bash
chmod +x native-host.sh
chmod +x native-host.js
```

#### 4. Update Manifest

```json
{
  "path": "/home/username/path/to/native-host.sh"
}
```

## Native Host Implementation

### Basic Native Host (native-host.js)

```javascript
#!/usr/bin/env node

const process = require('process');
const { ChromeNativeMessaging } = require('./chrome-native-messaging');

// Native messaging handler
class NativeHost {
  constructor() {
    this.messaging = new ChromeNativeMessaging();
    this.setupHandlers();
  }
  
  setupHandlers() {
    // Handle incoming messages from extension
    this.messaging.on('message', async (message) => {
      try {
        const response = await this.handleMessage(message);
        this.messaging.send(response);
      } catch (error) {
        this.messaging.send({
          id: message.id,
          error: error.message
        });
      }
    });
    
    // Handle errors
    this.messaging.on('error', (error) => {
      console.error('Native messaging error:', error);
    });
  }
  
  async handleMessage(message) {
    const { id, action, params } = message;
    
    // Route to MCP server or handle directly
    switch (action) {
      case 'ping':
        return { id, data: 'pong' };
        
      case 'navigate':
        // Forward to MCP server
        return await this.forwardToMcp(action, params);
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
  
  async forwardToMcp(action, params) {
    // Implementation to forward to MCP server
    // This would connect to your MCP server instance
  }
  
  start() {
    this.messaging.start();
    console.error('Native host started');
  }
}

// Start the native host
const host = new NativeHost();
host.start();
```

### Chrome Native Messaging Module

```javascript
// chrome-native-messaging.js

const { EventEmitter } = require('events');

class ChromeNativeMessaging extends EventEmitter {
  constructor() {
    super();
    this.inputBuffer = Buffer.alloc(0);
  }
  
  start() {
    // Set stdin to binary mode
    process.stdin.setEncoding(null);
    
    // Handle incoming data
    process.stdin.on('data', (chunk) => {
      this.inputBuffer = Buffer.concat([this.inputBuffer, chunk]);
      this.processInput();
    });
    
    // Handle stdin close
    process.stdin.on('end', () => {
      process.exit(0);
    });
  }
  
  processInput() {
    while (this.inputBuffer.length >= 4) {
      // Read message length (first 4 bytes)
      const messageLength = this.inputBuffer.readUInt32LE(0);
      
      if (this.inputBuffer.length < 4 + messageLength) {
        // Not enough data yet
        break;
      }
      
      // Extract message
      const messageBytes = this.inputBuffer.slice(4, 4 + messageLength);
      this.inputBuffer = this.inputBuffer.slice(4 + messageLength);
      
      try {
        const message = JSON.parse(messageBytes.toString());
        this.emit('message', message);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }
  
  send(message) {
    const json = JSON.stringify(message);
    const buffer = Buffer.from(json);
    
    // Write message length (4 bytes)
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32LE(buffer.length, 0);
    
    // Write to stdout
    process.stdout.write(lengthBuffer);
    process.stdout.write(buffer);
  }
}

module.exports = { ChromeNativeMessaging };
```

## Installation Script

Create a universal installation script:

```javascript
// install.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class NativeHostInstaller {
  constructor() {
    this.hostName = 'com.chrome_mcp.host';
    this.platform = os.platform();
  }
  
  install() {
    console.log(`Installing native host for ${this.platform}...`);
    
    switch (this.platform) {
      case 'win32':
        this.installWindows();
        break;
      case 'darwin':
        this.installMacOS();
        break;
      case 'linux':
        this.installLinux();
        break;
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
    
    console.log('Installation complete!');
  }
  
  installWindows() {
    const manifestPath = path.resolve(__dirname, `${this.hostName}.json`);
    
    // Update manifest with correct path
    this.updateManifest(path.resolve(__dirname, 'native-host.bat'));
    
    // Add to registry
    const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${this.hostName}`;
    execSync(`REG ADD "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`);
  }
  
  installMacOS() {
    const targetDir = path.join(
      os.homedir(),
      'Library/Application Support/Google/Chrome/NativeMessagingHosts'
    );
    
    // Create directory if it doesn't exist
    fs.mkdirSync(targetDir, { recursive: true });
    
    // Update manifest with correct path
    this.updateManifest(path.resolve(__dirname, 'native-host.js'));
    
    // Copy manifest
    const manifestSource = path.resolve(__dirname, `${this.hostName}.json`);
    const manifestTarget = path.join(targetDir, `${this.hostName}.json`);
    fs.copyFileSync(manifestSource, manifestTarget);
    
    // Make executable
    fs.chmodSync(path.resolve(__dirname, 'native-host.js'), '755');
  }
  
  installLinux() {
    const targetDir = path.join(
      os.homedir(),
      '.config/google-chrome/NativeMessagingHosts'
    );
    
    // Create directory if it doesn't exist
    fs.mkdirSync(targetDir, { recursive: true });
    
    // Update manifest with correct path
    this.updateManifest(path.resolve(__dirname, 'native-host.sh'));
    
    // Copy manifest
    const manifestSource = path.resolve(__dirname, `${this.hostName}.json`);
    const manifestTarget = path.join(targetDir, `${this.hostName}.json`);
    fs.copyFileSync(manifestSource, manifestTarget);
    
    // Make executable
    fs.chmodSync(path.resolve(__dirname, 'native-host.sh'), '755');
    fs.chmodSync(path.resolve(__dirname, 'native-host.js'), '755');
  }
  
  updateManifest(hostPath) {
    const manifestPath = path.resolve(__dirname, `${this.hostName}.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    manifest.path = hostPath;
    
    // Get extension ID from environment or use default
    const extensionId = process.env.EXTENSION_ID || 'YOUR_EXTENSION_ID_HERE';
    manifest.allowed_origins = [`chrome-extension://${extensionId}/`];
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  
  uninstall() {
    console.log(`Uninstalling native host for ${this.platform}...`);
    
    switch (this.platform) {
      case 'win32':
        this.uninstallWindows();
        break;
      case 'darwin':
        this.uninstallMacOS();
        break;
      case 'linux':
        this.uninstallLinux();
        break;
    }
    
    console.log('Uninstallation complete!');
  }
  
  uninstallWindows() {
    const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${this.hostName}`;
    try {
      execSync(`REG DELETE "${regKey}" /f`);
    } catch (error) {
      console.error('Failed to remove registry key');
    }
  }
  
  uninstallMacOS() {
    const manifestPath = path.join(
      os.homedir(),
      'Library/Application Support/Google/Chrome/NativeMessagingHosts',
      `${this.hostName}.json`
    );
    
    try {
      fs.unlinkSync(manifestPath);
    } catch (error) {
      console.error('Failed to remove manifest');
    }
  }
  
  uninstallLinux() {
    const manifestPath = path.join(
      os.homedir(),
      '.config/google-chrome/NativeMessagingHosts',
      `${this.hostName}.json`
    );
    
    try {
      fs.unlinkSync(manifestPath);
    } catch (error) {
      console.error('Failed to remove manifest');
    }
  }
}

// Run installer
const installer = new NativeHostInstaller();

if (process.argv.includes('--uninstall')) {
  installer.uninstall();
} else {
  installer.install();
}
```

## Testing Native Messaging

### 1. Test Native Host Directly

```bash
# Send a test message
echo -n -e '\x0e\x00\x00\x00{"test":"ping"}' | node native-host.js
```

### 2. Test from Extension

```javascript
// In extension background script
const port = chrome.runtime.connectNative('com.chrome_mcp.host');

port.onMessage.addListener((message) => {
  console.log('Received:', message);
});

port.onDisconnect.addListener(() => {
  console.log('Disconnected');
  if (chrome.runtime.lastError) {
    console.error('Error:', chrome.runtime.lastError.message);
  }
});

port.postMessage({ test: 'ping' });
```

## Troubleshooting

### Common Issues

1. **"Specified native messaging host not found"**
   - Check manifest is in correct location
   - Verify manifest JSON is valid
   - Ensure path in manifest is absolute

2. **"Native host has exited"**
   - Check native host script has shebang line
   - Verify script is executable
   - Check for syntax errors in script

3. **"Access to the specified native messaging host is forbidden"**
   - Verify extension ID in manifest
   - Check allowed_origins format

4. **No response from native host**
   - Check message format (4-byte header)
   - Verify JSON is valid
   - Check for errors in stderr

### Debug Logging

Add logging to native host:

```javascript
const fs = require('fs');
const logFile = '/tmp/native-host.log';

function log(message) {
  fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}
```

## Security Considerations

1. **Validate Extension ID**: Always verify the extension ID
2. **Input Validation**: Validate all messages from extension
3. **Path Security**: Use absolute paths in manifest
4. **Permission Check**: Verify user has proper permissions
5. **Message Size Limits**: Chrome limits messages to 1MB