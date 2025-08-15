#!/bin/bash

# Chrome MCP Server Cleanup Script

echo "Stopping Chrome MCP Server processes..."

# Kill any existing processes on port 9222
PID=$(lsof -ti:9222 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "Killing process on port 9222 (PID: $PID)"
    kill -9 $PID
    sleep 1
else
    echo "No process found on port 9222"
fi

# Kill any node processes running the MCP server
pkill -f "chrome-pilot.*index.js" 2>/dev/null && echo "Killed Chrome MCP server processes" || echo "No Chrome MCP processes found"

# Kill any npm processes that might be running the server
pkill -f "npm.*chrome-pilot" 2>/dev/null && echo "Killed npm processes" || echo "No npm processes found"

echo "Cleanup complete!"
echo ""
echo "You can now restart the server with:"
echo "  npm run dev"
echo "  or"
echo "  node dist/index.js --websocket"