# Chrome MCP Server - Network Setup for WSL/Windows

The Chrome MCP server now supports both local native messaging and network-based communication for WSL/Windows cross-communication.

## 🚀 Quick Start (WSL → Windows Chrome)

### 1. Start the WebSocket Server (in WSL)
```bash
cd /home/deoxy/code/chrome-pilot/server
node dist/index.js --websocket
```

You'll see output like:
```
Chrome WebSocket Server running on:
  Local: http://localhost:9222
  Network: http://192.168.1.2:9222/ws
  WebSocket: ws://192.168.1.2:9222/ws
```

### 2. Load Chrome Extension (in Windows Chrome)
1. Open Chrome in Windows
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `/extension` folder from WSL (accessible via `\\wsl$\Ubuntu\home\deoxy\code\chrome-pilot\extension`)

### 3. Configure WebSocket URL
1. Click the Chrome MCP Controller extension icon
2. Enter the WebSocket URL: `ws://192.168.1.2:9222/ws` (use your actual WSL IP)
3. Click "Save Configuration"
4. Click "Reconnect"

### 4. Add to Claude Code (in WSL)
Add to your `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "chrome-pilot": {
      "command": "node",
      "args": ["/home/deoxy/code/chrome-pilot/server/dist/index.js", "--websocket"],
      "env": {}
    }
  }
}
```

## 🔧 Configuration

### Find Your WSL IP Address
```bash
# In WSL terminal
ip route | grep default
# Look for the IP address, usually 172.x.x.x or 192.168.x.x
```

### Windows Firewall
If connection fails, ensure Windows Firewall allows port 9222:
```powershell
# In Windows PowerShell (as Administrator)
New-NetFirewallRule -DisplayName "Chrome MCP Server" -Direction Inbound -Port 9222 -Protocol TCP -Action Allow
```

### Extension Configuration
The extension popup allows you to:
- Set custom WebSocket URL
- Test connection
- View connection status
- Get tabs (test functionality)

## 🏗️ Architecture

```
┌─────────────┐    WebSocket     ┌─────────────┐    MCP/stdio    ┌─────────────┐
│   Windows   │ ←─────────────→  │     WSL     │ ←─────────────→ │ Claude Code │
│   Chrome    │   ws://IP:9222   │   Server    │                 │             │
│ + Extension │                  │             │                 │             │
└─────────────┘                  └─────────────┘                 └─────────────┘
```

## 🧪 Testing

### Test WebSocket Server
```bash
# Check server status
curl http://localhost:9222/info

# Send test command
curl -X POST http://localhost:9222/command \
  -H "Content-Type: application/json" \
  -d '{"action": "get_tabs", "params": {}}'
```

### Test Extension Connection
1. Open extension popup
2. Click "Test Connection" - should show ✅
3. Click "Get Tabs" - should list open tabs

### Test with Claude Code
```
Can you take a screenshot of the current page?
```

## 🔍 Troubleshooting

### Extension Not Connecting
- Verify WebSocket URL in extension popup
- Check WSL IP address hasn't changed
- Ensure WebSocket server is running
- Check Windows firewall settings

### MCP Tools Not Working
- Restart Chrome extension
- Verify extension popup shows "Connected" status
- Check server logs for errors
- Ensure extension has necessary permissions

### Performance Issues
- Use ethernet connection for best performance
- Consider running server on a fixed port
- Monitor network latency between WSL and Windows

## 🎯 Available Tools

All browser automation tools work over the network:
- `navigate` - Navigate to URLs
- `get_tabs` / `get_current_tab` - Tab management
- `click` - Click elements
- `type` - Fill forms
- `scroll` - Page scrolling
- `screenshot` - Capture screenshots
- `get_content` - Extract page content
- `get_interactive_elements` - Find clickable elements
- `wait_for_element` - Wait for elements

The system automatically handles the network communication between Claude Code (WSL) and Chrome (Windows).