# Installation Guide

Complete step-by-step installation guide for the Chrome MCP Server.

## Prerequisites

- Node.js >= 18.0.0
- npm or pnpm
- Chrome/Chromium browser
- Git (optional)

## Quick Install (5 minutes)

```bash
# 1. Clone or create project
mkdir chrome-mcp-server
cd chrome-mcp-server

# 2. Initialize and install
npm init -y
npm install @modelcontextprotocol/sdk

# 3. Copy templates from documentation
# Copy code from CODE_TEMPLATES.md

# 4. Build and install
npm run build
npm run install-native-host

# 5. Load extension in Chrome
# Go to chrome://extensions/ and load unpacked
```

## Detailed Installation

### Step 1: Project Setup

```bash
# Create project directory
mkdir chrome-mcp-server
cd chrome-mcp-server

# Create subdirectories
mkdir -p extension server/src/tools native-host

# Initialize npm in server directory
cd server
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx nodemon
```

### Step 2: Copy Source Files

1. Copy TypeScript configurations from [MANIFEST_TEMPLATES.md](MANIFEST_TEMPLATES.md)
2. Copy server code from [MCP_SERVER_GUIDE.md](MCP_SERVER_GUIDE.md)
3. Copy extension code from [CHROME_EXTENSION_GUIDE.md](CHROME_EXTENSION_GUIDE.md)
4. Copy tool implementations from [CODE_TEMPLATES.md](CODE_TEMPLATES.md)

### Step 3: Build Server

```bash
cd server

# Create tsconfig.json (copy from MANIFEST_TEMPLATES.md)
# Create source files in src/

# Build TypeScript
npx tsc

# Test server
node dist/index.js stdio
```

### Step 4: Setup Chrome Extension

```bash
cd ../extension

# Create manifest.json (copy from MANIFEST_TEMPLATES.md)
# Create background.js, content.js files

# No build needed for basic JavaScript extension
```

### Step 5: Install Native Host

#### Automatic Installation

```bash
cd ../native-host

# Create install.js (copy from NATIVE_MESSAGING_GUIDE.md)
node install.js
```

#### Manual Installation

**Windows:**
```batch
# 1. Create native-host.bat
@echo off
node "%~dp0\server\dist\index.js" native %*

# 2. Create manifest
# Copy com.chrome_mcp.host.json from templates

# 3. Register in registry
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chrome_mcp.host" /ve /t REG_SZ /d "C:\path\to\manifest.json" /f
```

**macOS:**
```bash
# 1. Create manifest directory
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# 2. Copy manifest
cp com.chrome_mcp.host.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# 3. Update paths in manifest
# Edit to use absolute paths
```

**Linux/WSL:**
```bash
# 1. Create manifest directory
mkdir -p ~/.config/google-chrome/NativeMessagingHosts/

# 2. Copy manifest
cp com.chrome_mcp.host.json ~/.config/google-chrome/NativeMessagingHosts/

# 3. Make executable
chmod +x native-host.sh
```

### Step 6: Load Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select your `extension` directory
5. Copy the Extension ID shown
6. Update native host manifest with this ID

### Step 7: Configure MCP Client

#### For Claude Desktop

1. Find Claude configuration:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Add server configuration:
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

3. Restart Claude Desktop

#### For Other MCP Clients

Configure according to your client's documentation, using:
- Command: `node /path/to/server/dist/index.js stdio`
- Or HTTP endpoint: `http://localhost:3000/mcp`

## Verification

### 1. Test Native Messaging

```javascript
// In Chrome extension console (background service worker)
const port = chrome.runtime.connectNative('com.chrome_mcp.host');
port.postMessage({ test: 'ping' });
port.onMessage.addListener(msg => console.log('Response:', msg));
```

### 2. Test MCP Server

```bash
# Test with stdio
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node server/dist/index.js stdio

# Test with HTTP
node server/dist/index.js http
curl -X POST http://localhost:3000/mcp -d '{"method":"tools/list"}'
```

### 3. Test with Claude

Type in Claude:
```
Can you list the tabs in my browser?
```

Expected: Claude should use the `get_tabs` tool.

## Troubleshooting Installation

### Extension Won't Load

**Problem:** "Manifest file is missing or unreadable"
**Solution:** Ensure manifest.json is valid JSON

**Problem:** "Cannot load extension with file or directory name _metadata"
**Solution:** Remove _metadata folder if present

### Native Messaging Fails

**Problem:** "Specified native messaging host not found"
**Solution:** 
1. Check manifest path is correct
2. Verify manifest is valid JSON
3. Ensure absolute paths are used

**Problem:** "Native host has exited"
**Solution:**
1. Check native host script exists and is executable
2. Look for syntax errors in the script
3. Check Node.js is in PATH

### MCP Connection Issues

**Problem:** Claude says "Server not found"
**Solution:**
1. Verify server path in configuration
2. Test server manually with stdio
3. Check Claude configuration file syntax

## Platform-Specific Notes

### Windows

- Use backslashes in paths (escaped in JSON: `\\`)
- Run Command Prompt as Administrator for registry changes
- Ensure Node.js is in system PATH

### macOS

- May need to grant Terminal permissions for automation
- Use `~/Library` not `~Library` for paths
- Check Gatekeeper settings if scripts are blocked

### Linux/WSL

- Ensure scripts have execute permissions (`chmod +x`)
- Use `.config` not `config` for Chrome paths
- May need to install Chrome manually in WSL

## Docker Installation (Optional)

```bash
# Build Docker image
docker build -t chrome-mcp-server .

# Run container
docker run -p 3000:3000 chrome-mcp-server

# Configure Claude to use HTTP endpoint
# http://localhost:3000/mcp
```

## Uninstallation

### Remove Extension
1. Go to `chrome://extensions/`
2. Find Chrome MCP Controller
3. Click Remove

### Remove Native Host

**Windows:**
```batch
REG DELETE "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chrome_mcp.host" /f
```

**macOS:**
```bash
rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.chrome_mcp.host.json
```

**Linux:**
```bash
rm ~/.config/google-chrome/NativeMessagingHosts/com.chrome_mcp.host.json
```

### Remove Server
```bash
rm -rf chrome-mcp-server
```

## Next Steps

After successful installation:

1. Test basic tools (navigate, screenshot)
2. Add more tools as needed
3. Customize for your workflow
4. Share feedback and improvements