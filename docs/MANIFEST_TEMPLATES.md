# Manifest Templates

Complete configuration files for all components of the Chrome MCP server.

## Chrome Extension Manifest

### manifest.json (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "Chrome MCP Controller",
  "version": "1.0.0",
  "description": "Enables AI control of Chrome through MCP protocol",
  "author": "Your Name",
  
  "permissions": [
    "tabs",
    "activeTab",
    "scripting",
    "nativeMessaging",
    "storage",
    "webNavigation"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "action": {
    "default_title": "Chrome MCP Controller",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  
  "content_scripts": [],
  
  "web_accessible_resources": [],
  
  "externally_connectable": {
    "matches": []
  }
}
```

### Alternative: With Optional Popup

```json
{
  "manifest_version": 3,
  "name": "Chrome MCP Controller",
  "version": "1.0.0",
  "description": "Enables AI control of Chrome through MCP protocol",
  
  "permissions": [
    "tabs",
    "activeTab",
    "scripting",
    "nativeMessaging",
    "storage",
    "webNavigation",
    "notifications"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "action": {
    "default_popup": "popup.html",
    "default_title": "Chrome MCP Controller",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  
  "options_page": "options.html",
  
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

## Native Host Manifests

### Windows: com.chrome_mcp.host.json

```json
{
  "name": "com.chrome_mcp.host",
  "description": "Chrome MCP Native Messaging Host",
  "path": "C:\\path\\to\\native-host.bat",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID_HERE/"
  ]
}
```

### macOS: com.chrome_mcp.host.json

```json
{
  "name": "com.chrome_mcp.host",
  "description": "Chrome MCP Native Messaging Host",
  "path": "/Users/username/path/to/native-host.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID_HERE/"
  ]
}
```

### Linux: com.chrome_mcp.host.json

```json
{
  "name": "com.chrome_mcp.host",
  "description": "Chrome MCP Native Messaging Host",
  "path": "/home/username/path/to/native-host.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID_HERE/"
  ]
}
```

## MCP Configuration

### For Claude Desktop (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/chrome-mcp-server/dist/index.js",
        "stdio"
      ],
      "env": {}
    }
  }
}
```

### Alternative: HTTP Mode Configuration

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer optional-token"
      }
    }
  }
}
```

## Package Configurations

### Server package.json

```json
{
  "name": "chrome-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for Chrome browser automation",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "start:stdio": "node dist/index.js stdio",
    "start:http": "node dist/index.js http",
    "start:native": "node dist/index.js native",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "prettier": "^3.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Extension package.json

```json
{
  "name": "chrome-mcp-extension",
  "version": "1.0.0",
  "description": "Chrome extension for MCP server",
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch",
    "clean": "rm -rf dist",
    "lint": "eslint src/**/*.js"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.250",
    "copy-webpack-plugin": "^11.0.0",
    "eslint": "^8.0.0",
    "webpack": "^5.0.0",
    "webpack-cli": "^5.0.0"
  }
}
```

## TypeScript Configurations

### Server tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Extension tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "types": ["chrome"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Build Configurations

### Webpack Configuration (extension/webpack.config.js)

```javascript
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  devtool: 'source-map',
  
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    popup: './src/popup.js',
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'icons', to: 'icons' },
        { from: 'popup.html', to: 'popup.html' },
      ],
    }),
  ],
  
  resolve: {
    extensions: ['.js', '.json'],
  },
};
```

## Docker Configuration (Optional)

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Expose port for HTTP mode
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js", "http"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./native-host:/app/native-host
    restart: unless-stopped
```

## Environment Configuration

### .env.example

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Extension Configuration
EXTENSION_ID=your_extension_id_here

# Native Host Configuration
NATIVE_HOST_NAME=com.chrome_mcp.host

# Optional: Authentication
API_KEY=optional_api_key_for_http_mode

# Optional: Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

## GitHub Actions CI/CD

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run linter
        run: npm run lint
      
      - name: Build
        run: npm run build

  build-extension:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
      
      - name: Install dependencies
        working-directory: ./extension
        run: npm ci
      
      - name: Build extension
        working-directory: ./extension
        run: npm run build
      
      - name: Upload extension artifact
        uses: actions/upload-artifact@v3
        with:
          name: chrome-extension
          path: extension/dist/
```

## VS Code Configuration

### .vscode/launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug MCP Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "args": ["stdio"]
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome Extension",
      "url": "http://localhost:8080",
      "webRoot": "${workspaceFolder}/extension",
      "runtimeArgs": [
        "--load-extension=${workspaceFolder}/extension/dist"
      ]
    }
  ]
}
```

### .vscode/settings.json

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```