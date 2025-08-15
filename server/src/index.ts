#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { NativeMessenger } from "./native-host.js";
import { ChromeTools } from "./tools/chrome-tools.js";
import { ChromeWebSocketServer } from "./websocket-server.js";
import { ChromeWebSocketTools } from "./websocket-tools.js";

class ChromeMCPServer {
  private server: Server;
  private nativeMessenger?: NativeMessenger;
  private chromeTools?: ChromeTools;
  private webSocketServer?: ChromeWebSocketServer;
  private webSocketTools?: ChromeWebSocketTools;
  private mode: "stdio" | "websocket";

  constructor(mode: "stdio" | "websocket" = "stdio") {
    this.mode = mode;
    this.server = new Server(
      {
        name: "chrome-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Initialize based on mode
    if (this.mode === "websocket") {
      this.webSocketServer = new ChromeWebSocketServer();
      this.webSocketTools = new ChromeWebSocketTools(this.webSocketServer);
    } else {
      this.nativeMessenger = new NativeMessenger();
      this.chromeTools = new ChromeTools(this.nativeMessenger);
    }

    this.setupErrorHandling();
    this.setupToolHandlers();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "navigate",
            description: "Navigate to a URL in the browser",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL to navigate to",
                },
                tabId: {
                  type: "number",
                  description:
                    "Optional tab ID. If not provided, uses the active tab",
                },
              },
              required: ["url"],
            },
          },
          {
            name: "get_tabs",
            description: "Get all open browser tabs",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          {
            name: "get_current_tab",
            description: "Get information about the currently active tab",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          {
            name: "close_tab",
            description: "Close a browser tab",
            inputSchema: {
              type: "object",
              properties: {
                tabId: {
                  type: "number",
                  description: "The ID of the tab to close",
                },
              },
              required: ["tabId"],
            },
          },
          {
            name: "click",
            description: "Click on an element in the page",
            inputSchema: {
              type: "object",
              properties: {
                selector: {
                  type: "string",
                  description: "CSS selector or XPath of the element to click",
                },
                tabId: {
                  type: "number",
                  description:
                    "Optional tab ID. If not provided, uses the active tab",
                },
              },
              required: ["selector"],
            },
          },
          {
            name: "type",
            description: "Type text into an input field",
            inputSchema: {
              type: "object",
              properties: {
                selector: {
                  type: "string",
                  description: "CSS selector of the input element",
                },
                text: {
                  type: "string",
                  description: "Text to type",
                },
                tabId: {
                  type: "number",
                  description:
                    "Optional tab ID. If not provided, uses the active tab",
                },
              },
              required: ["selector", "text"],
            },
          },
          {
            name: "scroll",
            description: "Scroll the page in a specified direction",
            inputSchema: {
              type: "object",
              properties: {
                direction: {
                  type: "string",
                  enum: ["up", "down", "left", "right"],
                  description: "Direction to scroll",
                },
                amount: {
                  type: "number",
                  description: "Amount to scroll in pixels (default: 500)",
                },
                tabId: {
                  type: "number",
                  description:
                    "Optional tab ID. If not provided, uses the active tab",
                },
              },
              required: ["direction"],
            },
          },
          {
            name: "screenshot",
            description: "Take a screenshot of the current page",
            inputSchema: {
              type: "object",
              properties: {
                tabId: {
                  type: "number",
                  description:
                    "Optional tab ID. If not provided, uses the active tab",
                },
              },
              required: [],
            },
          },
          {
            name: "get_content",
            description: "Get the content of the page or a specific element",
            inputSchema: {
              type: "object",
              properties: {
                selector: {
                  type: "string",
                  description:
                    "Optional CSS selector to get content from a specific element",
                },
                tabId: {
                  type: "number",
                  description:
                    "Optional tab ID. If not provided, uses the active tab",
                },
              },
              required: [],
            },
          },
          {
            name: "get_interactive_elements",
            description:
              "Get all interactive elements on the page (buttons, inputs, links, etc.)",
            inputSchema: {
              type: "object",
              properties: {
                tabId: {
                  type: "number",
                  description:
                    "Optional tab ID. If not provided, uses the active tab",
                },
              },
              required: [],
            },
          },
          {
            name: "wait_for_element",
            description: "Wait for an element to appear on the page",
            inputSchema: {
              type: "object",
              properties: {
                selector: {
                  type: "string",
                  description: "CSS selector of the element to wait for",
                },
                timeout: {
                  type: "number",
                  description: "Timeout in milliseconds (default: 10000)",
                },
                tabId: {
                  type: "number",
                  description:
                    "Optional tab ID. If not provided, uses the active tab",
                },
              },
              required: ["selector"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!args) {
        throw new Error("Missing arguments");
      }

      try {
        let result;

        // Use appropriate tools based on mode
        const tools =
          this.mode === "websocket" ? this.webSocketTools : this.chromeTools;

        if (!tools) {
          throw new Error(`Tools not initialized for mode: ${this.mode}`);
        }

        switch (name) {
          case "navigate":
            result = await tools.navigate(
              args.url as string,
              args.tabId as number,
            );
            break;

          case "get_tabs":
            result = await tools.getTabs();
            break;

          case "get_current_tab":
            result = await tools.getCurrentTab();
            break;

          case "close_tab":
            result = await tools.closeTab(args.tabId as number);
            break;

          case "click":
            result = await tools.click(
              args.selector as string,
              args.tabId as number,
            );
            break;

          case "type":
            result = await tools.type(
              args.selector as string,
              args.text as string,
              args.tabId as number,
            );
            break;

          case "scroll":
            result = await tools.scroll(
              args.direction as string,
              args.amount as number,
              args.tabId as number,
            );
            break;

          case "screenshot":
            result = await tools.screenshot(args.tabId as number);
            break;

          case "get_content":
            result = await tools.getContent(
              args.selector as string,
              args.tabId as number,
            );
            break;

          case "get_interactive_elements":
            result = await tools.getInteractiveElements(args.tabId as number);
            break;

          case "wait_for_element":
            result = await tools.waitForElement(
              args.selector as string,
              args.timeout as number,
              args.tabId as number,
            );
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    if (this.mode === "websocket") {
      // Start WebSocket server
      if (this.webSocketServer) {
        await this.webSocketServer.start();
      }

      // Also start MCP server on stdio for Claude Code integration
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error(
        "Chrome MCP Server running in WebSocket mode with stdio transport",
      );
    } else {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error("Chrome MCP Server running on stdio");
    }
  }
}

// Check if we're being run directly
if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  // Check for WebSocket mode argument
  const mode = process.argv.includes("--websocket") ? "websocket" : "stdio";
  const server = new ChromeMCPServer(mode);
  server.run().catch(console.error);
}
