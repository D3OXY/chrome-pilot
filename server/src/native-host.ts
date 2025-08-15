import { EventEmitter } from "events";

interface NativeMessage {
  id: string;
  action: string;
  params?: any;
}

interface NativeResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class NativeMessenger extends EventEmitter {
  private messageHandlers = new Map<
    string,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();
  private isRunning = false;

  constructor() {
    super();
    this.setupStdioHandling();
  }

  private setupStdioHandling(): void {
    // Handle incoming messages from Chrome extension
    process.stdin.on("readable", () => {
      this.readMessage();
    });

    process.stdin.on("end", () => {
      console.error("Chrome extension disconnected");
      process.exit(0);
    });

    // Handle process termination
    process.on("SIGTERM", () => {
      console.error("Native host terminated");
      process.exit(0);
    });

    process.on("SIGINT", () => {
      console.error("Native host interrupted");
      process.exit(0);
    });
  }

  private readMessage(): void {
    if (!this.isRunning) {
      this.isRunning = true;
    }

    let input = "";
    let chunk;

    while ((chunk = process.stdin.read()) !== null) {
      input += chunk;
    }

    if (input.length === 0) {
      return;
    }

    try {
      // Native messaging protocol: first 4 bytes are message length
      const buffer = Buffer.from(input, "binary");

      if (buffer.length < 4) {
        return;
      }

      const messageLength = buffer.readUInt32LE(0);
      const messageBuffer = buffer.slice(4, 4 + messageLength);

      if (messageBuffer.length < messageLength) {
        return;
      }

      const messageData = messageBuffer.toString("utf8");
      const message = JSON.parse(messageData) as NativeMessage;

      console.error("Received message from extension:", message);
      this.handleMessage(message);
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }

  private handleMessage(message: NativeMessage): void {
    if (message.id && this.messageHandlers.has(message.id)) {
      // This is a response to a request we sent
      const handler = this.messageHandlers.get(message.id)!;
      clearTimeout(handler.timeout);
      this.messageHandlers.delete(message.id);

      const response = message as any as NativeResponse;
      if (response.success) {
        handler.resolve(response.data);
      } else {
        handler.reject(new Error(response.error || "Unknown error"));
      }
    } else {
      // This is a new request from the extension
      this.emit("message", message);
    }
  }

  private sendMessage(message: any): void {
    try {
      const messageString = JSON.stringify(message);
      const messageBuffer = Buffer.from(messageString, "utf8");
      const lengthBuffer = Buffer.alloc(4);

      lengthBuffer.writeUInt32LE(messageBuffer.length, 0);

      process.stdout.write(lengthBuffer);
      process.stdout.write(messageBuffer);

      console.error("Sent message to extension:", message);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  public sendCommand(action: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = this.generateId();
      const message: NativeMessage = {
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
      this.sendMessage(message);
    });
  }

  public respondToMessage(
    originalMessage: NativeMessage,
    success: boolean,
    data?: any,
    error?: string,
  ): void {
    const response: NativeResponse = {
      id: originalMessage.id,
      success,
      data,
      error,
    };

    this.sendMessage(response);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  public isConnected(): boolean {
    return this.isRunning;
  }
}
