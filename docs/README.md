# Chrome MCP Server - Build From Scratch Guide

## Overview

This documentation provides a complete guide to building a Chrome MCP (Model Context Protocol) server from scratch. The server enables AI assistants like Claude to control your Chrome browser directly through a Chrome extension and native messaging.

## What You'll Build

A lightweight Chrome automation system with:
- **Chrome Extension** - Manages browser tabs and executes page interactions
- **MCP Server** - Implements the Model Context Protocol for AI communication
- **Native Messaging Bridge** - Connects the extension to the MCP server

## Core Features

- 📸 **Screenshots** - Capture full page or element screenshots
- 🌐 **Navigation** - Navigate to URLs, go back/forward
- 🖱️ **Interactions** - Click elements, scroll pages
- 📝 **Form Filling** - Fill inputs, select options, check boxes
- 📋 **Content Extraction** - Get page HTML, text, or specific elements
- 🗂️ **Tab Management** - List, switch, close tabs

## Project Structure

```
chrome-mcp-server/
├── extension/                 # Chrome Extension
│   ├── manifest.json         # Extension configuration
│   ├── background.js         # Service worker for tab management
│   ├── content.js           # Content script for page interaction
│   └── native-messaging.js  # Communication with MCP server
│
├── server/                   # MCP Server
│   ├── src/
│   │   ├── index.ts         # Main server entry
│   │   ├── mcp-server.ts    # MCP protocol implementation
│   │   ├── native-host.ts   # Native messaging handler
│   │   └── tools/           # Browser automation tools
│   │       ├── screenshot.ts
│   │       ├── navigate.ts
│   │       ├── click.ts
│   │       ├── scroll.ts
│   │       ├── forms.ts
│   │       └── content.ts
│   ├── package.json
│   └── tsconfig.json
│
└── native-host/              # Native messaging configuration
    ├── manifest.json         # Native host manifest
    └── install.sh           # Installation script
```

## Technology Stack

- **TypeScript** - Type-safe development
- **Node.js** - Server runtime
- **Chrome Extension APIs** - Browser automation
- **MCP SDK** - Protocol implementation
- **Native Messaging** - Extension-server communication

## Documentation Contents

### Getting Started
- [PROJECT_PLAN.md](PROJECT_PLAN.md) - Detailed implementation roadmap
- [INSTALLATION.md](INSTALLATION.md) - Step-by-step setup guide
- [WSL_SETUP.md](WSL_SETUP.md) - WSL-specific configuration

### Architecture & Design
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design and component interaction
- [TOOLS_SPEC.md](TOOLS_SPEC.md) - Detailed tool specifications
- [API_REFERENCE.md](API_REFERENCE.md) - Complete API documentation

### Implementation Guides
- [CHROME_EXTENSION_GUIDE.md](CHROME_EXTENSION_GUIDE.md) - Extension development
- [MCP_SERVER_GUIDE.md](MCP_SERVER_GUIDE.md) - Server implementation
- [NATIVE_MESSAGING_GUIDE.md](NATIVE_MESSAGING_GUIDE.md) - Native messaging setup

### Code & Configuration
- [CODE_TEMPLATES.md](CODE_TEMPLATES.md) - Ready-to-use TypeScript code
- [MANIFEST_TEMPLATES.md](MANIFEST_TEMPLATES.md) - Configuration templates
- [PACKAGE_SETUP.md](PACKAGE_SETUP.md) - Package.json and TypeScript config

### Support
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions

## Quick Start

1. **Clone this documentation to your new project**
   ```bash
   cp -r docs/chrome-mcp-from-scratch/* /path/to/your/new/project/docs/
   ```

2. **Follow the implementation plan**
   - Start with [PROJECT_PLAN.md](PROJECT_PLAN.md) for the roadmap
   - Use [CODE_TEMPLATES.md](CODE_TEMPLATES.md) for ready-to-use code
   - Refer to guides as you build each component

3. **Test with Claude**
   - Install the extension and server
   - Configure Claude with the MCP endpoint
   - Start automating your browser!

## Time Estimate

- **Prototype**: 1-2 weeks
- **Production-ready**: 3-4 weeks
- **With all features**: 4-6 weeks

## Prerequisites

- Node.js >= 18.0.0
- TypeScript knowledge
- Basic Chrome extension understanding
- Chrome/Chromium browser

## Support & Compatibility

- ✅ Windows 10/11
- ✅ macOS 10.15+
- ✅ Linux (Ubuntu 20.04+)
- ✅ WSL2

## License

MIT - Free to use and modify