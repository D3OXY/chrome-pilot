#!/bin/bash

# Chrome MCP Native Host Installation Script for Linux/WSL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MANIFEST_FILE="$SCRIPT_DIR/com.chrome_mcp.host.json"
NATIVE_HOST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"

echo "Installing Chrome MCP Native Host..."

# Create native messaging host directory if it doesn't exist
mkdir -p "$NATIVE_HOST_DIR"

# Update the manifest with the correct path
ABSOLUTE_PATH="$PROJECT_DIR/server/dist/index.js"
echo "Setting path to: $ABSOLUTE_PATH"

# Create a temporary manifest with the correct path
cat > "$NATIVE_HOST_DIR/com.chrome_mcp.host.json" << EOF
{
  "name": "com.chrome_mcp.host",
  "description": "Chrome MCP Native Messaging Host",
  "path": "$ABSOLUTE_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID_PLACEHOLDER/"
  ]
}
EOF

echo "Native host manifest installed to: $NATIVE_HOST_DIR/com.chrome_mcp.host.json"

# Build the TypeScript server
echo "Building TypeScript server..."
cd "$PROJECT_DIR/server"
npm run build

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Load the Chrome extension from: $PROJECT_DIR/extension"
echo "2. Copy the extension ID and update the native host manifest"
echo "3. Test the connection"
echo ""
echo "To update the extension ID, run:"
echo "  sed -i 's/EXTENSION_ID_PLACEHOLDER/YOUR_EXTENSION_ID/g' '$NATIVE_HOST_DIR/com.chrome_mcp.host.json'"
echo ""
echo "To test native messaging:"
echo "  node '$ABSOLUTE_PATH' <<< '{\"test\": \"ping\"}'"