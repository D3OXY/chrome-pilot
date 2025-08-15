import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { networkInterfaces } from "os";

interface WebSocketMessage {
  id: string;
  action: string;
  params?: any;
}

interface WebSocketResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class ChromeWebSocketServer extends EventEmitter {
  private app: express.Application;
  private server: any;
  private wss!: WebSocketServer;
  private extensionSocket: WebSocket | null = null;
  private messageHandlers = new Map<
    string,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();
  private port: number;
  private host: string;

  constructor(port = 9222, host = "0.0.0.0") {
    super();
    this.port = port;
    this.host = host;

    this.app = express();
    this.setupExpress();
    this.server = createServer(this.app);
    this.setupWebSocket();
  }

  private setupExpress(): void {
    // Enable CORS for all origins (needed for WSL/Windows communication)
    this.app.use(
      cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      }),
    );

    this.app.use(express.json());

    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        extensionConnected: this.extensionSocket !== null,
        timestamp: new Date().toISOString(),
      });
    });

    // Get server info
    this.app.get("/info", (req, res) => {
      res.json({
        host: this.host,
        port: this.port,
        extensionConnected: this.extensionSocket !== null,
        wsUrl: `ws://${this.getLocalIP()}:${this.port}/ws`,
      });
    });

    // Manual command endpoint for testing
    this.app.post("/command", async (req, res) => {
      try {
        const { action, params } = req.body;
        const result = await this.sendCommand(action, params);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  private setupWebSocket(): void {
    this.wss = new WebSocketServer({
      server: this.server,
      path: "/ws",
    });

    this.wss.on("connection", (ws, req) => {
      console.error(
        "WebSocket connection established from:",
        req.socket.remoteAddress,
      );

      // Store the extension connection
      this.extensionSocket = ws;
      this.emit("extensionConnected");

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          console.error("Received message from extension:", message);
          this.handleMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      ws.on("close", () => {
        console.error("Extension WebSocket disconnected");
        this.extensionSocket = null;
        this.emit("extensionDisconnected");
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });

      // Send initial connection confirmation
      ws.send(
        JSON.stringify({
          type: "connection",
          status: "connected",
          timestamp: Date.now(),
        }),
      );
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    if (message.id && this.messageHandlers.has(message.id)) {
      // This is a response to a request we sent
      const handler = this.messageHandlers.get(message.id)!;
      clearTimeout(handler.timeout);
      this.messageHandlers.delete(message.id);

      const response = message as any as WebSocketResponse;
      if (response.success) {
        handler.resolve(response.data);
      } else {
        handler.reject(new Error(response.error || "Unknown error"));
      }
    } else {
      // This is a new request from the extension (not expected in our setup)
      this.emit("message", message);
    }
  }

  public sendCommand(action: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (
        !this.extensionSocket ||
        this.extensionSocket.readyState !== WebSocket.OPEN
      ) {
        reject(new Error("Extension not connected"));
        return;
      }

      const messageId = this.generateId();
      const message: WebSocketMessage = {
        id: messageId,
        action,
        params,
      };

      // Set up response handler
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        reject(new Error(`Request timeout for action: ${action}`));
      }, 30000); // 30 second timeout

      this.messageHandlers.set(messageId, { resolve, reject, timeout });

      // Send the message
      this.extensionSocket.send(JSON.stringify(message));
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getLocalIP(): string {
    // For WSL, we need to get the WSL IP that's accessible from Windows
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
      const networkList = nets[name];
      if (networkList) {
        for (const net of networkList) {
          // Skip over non-IPv4 and internal addresses
          if (net.family === "IPv4" && !net.internal) {
            // In WSL, look for the eth0 interface
            if (name === "eth0" || name.includes("eth")) {
              return net.address;
            }
          }
        }
      }
    }

    return this.host;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        const actualIP = this.getLocalIP();
        console.error(`Chrome WebSocket Server running on:`);
        console.error(`  Local: http://localhost:${this.port}`);
        console.error(`  Network: http://${actualIP}:${this.port}`);
        console.error(`  WebSocket: ws://${actualIP}:${this.port}/ws`);
        console.error("");
        console.error("Extension should connect to the WebSocket URL above");
        resolve();
      });

      this.server.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }

  public isExtensionConnected(): boolean {
    return (
      this.extensionSocket !== null &&
      this.extensionSocket.readyState === WebSocket.OPEN
    );
  }
}
