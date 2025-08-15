# System Architecture

## Overview

The Chrome MCP Server consists of three main components that work together to provide browser automation capabilities to AI assistants.

## Architecture Diagram

```
┌─────────────────┐     MCP Protocol      ┌──────────────┐
│                 │ ◄──────────────────► │              │
│  Claude/AI      │                      │  MCP Server  │
│  Assistant      │                      │  (Node.js)   │
│                 │                      │              │
└─────────────────┘                      └──────┬───────┘
                                                 │
                                          Native │ Messaging
                                                 │
                                         ┌───────▼────────┐
                                         │                │
                                         │ Chrome Extension│
                                         │                │
                                         └───────┬────────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    │            │            │
                              ┌─────▼─────┐ ┌───▼────┐ ┌─────▼─────┐
                              │Background │ │Content │ │   Popup   │
                              │  Worker   │ │Scripts │ │   (opt)   │
                              └───────────┘ └────────┘ └───────────┘
                                    │            │
                                    └────────────┘
                                         │
                                    Chrome APIs
                                         │
                                   ┌─────▼─────┐
                                   │  Browser  │
                                   │   Tabs    │
                                   └───────────┘
```

## Component Details

### 1. MCP Server (Node.js)

**Responsibilities:**
- Implements Model Context Protocol
- Manages tool registration and execution
- Handles native messaging communication
- Provides HTTP/stdio endpoints for AI clients

**Key Modules:**
```typescript
mcp-server.ts       // MCP protocol implementation
native-host.ts      // Chrome native messaging handler
tool-registry.ts    // Tool registration and management
server.ts          // HTTP server for MCP connections
```

**Communication:**
- **Input**: MCP requests from AI assistant
- **Output**: Tool results and responses
- **Protocol**: JSON-RPC over HTTP/stdio

### 2. Chrome Extension

**Components:**

#### Background Service Worker
- Manages extension lifecycle
- Handles native messaging port
- Coordinates tab operations
- Routes messages between components

#### Content Scripts
- Injected into web pages
- Executes DOM operations
- Captures screenshots
- Handles form interactions

#### Popup UI (Optional)
- Extension configuration
- Connection status
- Debug information

**Permissions Required:**
```json
{
  "permissions": [
    "tabs",
    "activeTab",
    "scripting",
    "nativeMessaging"
  ],
  "host_permissions": ["<all_urls>"]
}
```

### 3. Native Messaging Bridge

**Purpose:**
Enables bi-directional communication between Chrome extension and Node.js server

**Configuration:**
- Native host manifest registration
- Message size limits (4GB max)
- Platform-specific installation

## Data Flow

### Tool Execution Flow

```
1. AI Assistant sends tool request
   └─> MCP Server receives via JSON-RPC
       └─> Server validates and prepares command
           └─> Command sent via Native Messaging
               └─> Extension Background Worker receives
                   └─> Appropriate handler invoked
                       └─> Content script injected (if needed)
                           └─> Action performed on page
                               └─> Result collected
                                   └─> Response sent back through chain
```

### Message Format

**MCP to Extension:**
```typescript
interface Command {
  id: string;
  action: string;
  params: Record<string, any>;
  timestamp: number;
}
```

**Extension to MCP:**
```typescript
interface Response {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}
```

## Security Considerations

### 1. Permission Model
- Minimal required permissions
- Host permissions only when needed
- Content script injection on-demand

### 2. Message Validation
- Schema validation for all messages
- Parameter sanitization
- Command whitelisting

### 3. Isolation
- Content scripts run in isolated context
- No direct DOM access from background
- Sandboxed execution environment

## Performance Optimization

### 1. Connection Management
- Persistent native messaging port
- Connection pooling for multiple requests
- Automatic reconnection on failure

### 2. Content Script Injection
- Lazy loading of content scripts
- Script caching for repeated use
- Minimal DOM manipulation

### 3. Message Batching
- Combine multiple operations when possible
- Reduce round-trip communication
- Efficient serialization

## Error Handling

### Error Propagation Chain

```
Browser Error
    └─> Content Script catches
        └─> Background Worker processes
            └─> Native Messaging forwards
                └─> MCP Server formats
                    └─> AI Assistant receives
```

### Error Types

1. **Browser Errors**: Page not found, network issues
2. **Extension Errors**: Permission denied, script injection failed
3. **Communication Errors**: Native messaging disconnect
4. **Protocol Errors**: Invalid MCP format
5. **Tool Errors**: Invalid parameters, operation failed

## Scalability Considerations

### Multi-tab Support
- Concurrent operations on multiple tabs
- Tab ID tracking and management
- Resource cleanup on tab close

### Request Queuing
- FIFO queue for sequential operations
- Priority queue for critical commands
- Rate limiting to prevent overload

### State Management
- Stateless tool execution
- Session persistence in extension
- Recovery from crashes

## Platform Differences

### Windows
- Native host in `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\`
- Batch script wrapper for Node.js

### macOS
- Native host in `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- Direct Node.js execution

### Linux/WSL
- Native host in `~/.config/google-chrome/NativeMessagingHosts/`
- Shell script wrapper

## Testing Strategy

### Unit Tests
- Individual tool functions
- Message parsing and validation
- Error handling scenarios

### Integration Tests
- End-to-end tool execution
- Native messaging communication
- Multi-tab operations

### Manual Testing
- Real browser interaction
- Various website compatibility
- Performance under load