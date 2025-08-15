# Chrome MCP Server

A Model Context Protocol (MCP) server that enables AI assistants like Claude to control Chrome browsers through a Chrome extension and WebSocket communication. Perfect for cross-platform automation, especially WSL/Windows setups.

## 🚀 Features

- **Browser Automation**: Navigate, click, scroll, fill forms, take screenshots
- **Cross-Platform**: Works across WSL/Windows network boundaries  
- **Dual Communication**: Native messaging (local) + WebSocket (network)
- **Claude Integration**: Direct integration with Claude Code and Claude Desktop
- **Real-time Control**: Live browser interaction through MCP tools
- **Chrome Extension**: Easy-to-install browser extension with popup controls

## 🏗️ Architecture

```
┌─────────────┐    WebSocket     ┌─────────────┐    MCP/stdio    ┌─────────────┐
│   Windows   │ ←─────────────→  │     WSL     │ ←─────────────→ │ Claude Code │
│   Chrome    │   ws://IP:9222   │   Server    │                 │             │
│ + Extension │                  │             │                 │             │
└─────────────┘                  └─────────────┘                 └─────────────┘
```

## 📦 Installation

### Prerequisites
- Node.js >= 18.0.0
- Chrome/Chromium browser
- TypeScript (for development)

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/deoxy/chrome-pilot.git
   cd chrome-pilot
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   npm run build
   ```

3. **Start the WebSocket server**
   ```bash
   node dist/index.js --websocket
   ```

4. **Load Chrome extension**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

5. **Configure extension**
   - Click extension icon
   - Enter WebSocket URL: `ws://YOUR_IP:9222/ws`
   - Click "Save Configuration" and "Reconnect"

## 🔧 Configuration

### For Claude Code (WSL)
Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "chrome-pilot": {
      "command": "node",
      "args": ["/path/to/chrome-pilot/server/dist/index.js", "--websocket"],
      "env": {}
    }
  }
}
```

### For Claude Desktop
Add to Claude Desktop settings:
```json
{
  "mcpServers": {
    "chrome-pilot": {
      "command": "node",
      "args": ["/path/to/chrome-pilot/server/dist/index.js"]
    }
  }
}
```

## 🛠️ Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `navigate` | Navigate to a URL | `url`, `tabId?` |
| `get_tabs` | Get all open browser tabs | - |
| `get_current_tab` | Get currently active tab | - |
| `close_tab` | Close a browser tab | `tabId` |
| `click` | Click on an element | `selector`, `tabId?` |
| `type` | Type text into an input | `selector`, `text`, `tabId?` |
| `scroll` | Scroll the page | `direction`, `amount?`, `tabId?` |
| `screenshot` | Take a screenshot | `tabId?` |
| `get_content` | Extract page content | `selector?`, `tabId?` |
| `get_interactive_elements` | Find clickable elements | `tabId?` |
| `wait_for_element` | Wait for element to appear | `selector`, `timeout?`, `tabId?` |

## 🌐 Network Setup (WSL/Windows)

### 1. Find WSL IP
```bash
ip route | grep default
```

### 2. Configure Windows Firewall
```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Chrome MCP Server" -Direction Inbound -Port 9222 -Protocol TCP -Action Allow
```

### 3. Extension Setup
1. Access extension via `\\wsl$\Ubuntu\path\to\chrome-pilot\extension`
2. Load in Windows Chrome
3. Configure WebSocket URL in popup
4. Test connection

## 🧪 Testing

### Test WebSocket Server
```bash
curl http://localhost:9222/info
curl -X POST http://localhost:9222/command \
  -H "Content-Type: application/json" \
  -d '{"action": "get_tabs", "params": {}}'
```

### Test with Claude
```
Can you navigate to google.com and take a screenshot?
```

## 📁 Project Structure

```
chrome-pilot/
├── server/                 # MCP Server (TypeScript)
│   ├── src/
│   │   ├── index.ts        # Main server entry
│   │   ├── websocket-server.ts    # WebSocket server
│   │   ├── native-host.ts  # Native messaging
│   │   └── tools/          # Browser automation tools
│   ├── package.json
│   └── tsconfig.json
├── extension/              # Chrome Extension
│   ├── manifest.json       # Extension config
│   ├── background-websocket.js   # Service worker
│   ├── content.js          # Content script
│   ├── popup.html          # Extension popup
│   └── popup.js
├── native-host/            # Native messaging setup
│   ├── install.sh          # Installation script
│   └── com.chrome_mcp.host.json.template
└── docs/                   # Documentation
```

## 🔍 Troubleshooting

### Extension Not Connecting
- Verify WebSocket URL in extension popup
- Check WSL IP address hasn't changed
- Ensure server is running on correct port
- Check Windows firewall settings

### MCP Tools Not Working
- Restart Chrome extension
- Verify "Connected" status in popup
- Check server logs for errors
- Ensure extension has necessary permissions

### Performance Issues
- Use ethernet connection for best performance
- Monitor network latency between WSL and Windows
- Consider running on fixed IP

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [MCP SDK](https://modelcontextprotocol.io) by Anthropic
- Uses Chrome Extension APIs for browser automation
- WebSocket communication for cross-platform support

## 📞 Support

- Create an [issue](https://github.com/deoxy/chrome-pilot/issues) for bug reports
- Check [documentation](docs/) for detailed guides
- See [network setup guide](README-NETWORK.md) for WSL/Windows configuration