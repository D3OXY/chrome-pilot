import { ChromeWebSocketServer } from "./websocket-server.js";
import { writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export class ChromeWebSocketTools {
  constructor(private webSocketServer: ChromeWebSocketServer) {}

  async navigate(url: string, tabId?: number): Promise<any> {
    try {
      const result = await this.webSocketServer.sendCommand("navigate", {
        url,
        tabId,
      });
      return {
        success: true,
        url,
        tabId: tabId || "active",
        message: `Successfully navigated to ${url}`,
      };
    } catch (error) {
      throw new Error(
        `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getTabs(): Promise<any> {
    try {
      const tabs = await this.webSocketServer.sendCommand("get_tabs");
      return {
        success: true,
        tabs,
        count: tabs.length,
        message: `Found ${tabs.length} open tabs`,
      };
    } catch (error) {
      throw new Error(
        `Failed to get tabs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getCurrentTab(): Promise<any> {
    try {
      const tab = await this.webSocketServer.sendCommand("get_active_tab");
      return {
        success: true,
        tab,
        message: `Current tab: ${tab.title} (${tab.url})`,
      };
    } catch (error) {
      throw new Error(
        `Failed to get current tab: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async closeTab(tabId: number): Promise<any> {
    try {
      await this.webSocketServer.sendCommand("close_tab", { tabId });
      return {
        success: true,
        tabId,
        message: `Successfully closed tab ${tabId}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to close tab: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async click(
    selector: string,
    tabId?: number,
    waitForNavigation?: boolean,
    timeout?: number,
  ): Promise<any> {
    try {
      const result = await this.webSocketServer.sendCommand("click_enhanced", {
        selector,
        tabId,
        waitForNavigation: waitForNavigation || false,
        timeout: timeout || 5000,
      });
      return {
        success: true,
        selector,
        tabId: tabId || "active",
        waitForNavigation: waitForNavigation || false,
        navigationOccurred: result.navigationOccurred || false,
        message: `Successfully clicked element: ${selector}`,
      };
    } catch (error) {
      throw new Error(
        `Click failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async type(selector: string, text: string, tabId?: number): Promise<any> {
    try {
      const result = await this.webSocketServer.sendCommand("fill_enhanced", {
        selector,
        value: text,
        tabId,
      });
      return {
        success: true,
        selector,
        text,
        tabId: tabId || "active",
        message: `Successfully typed "${text}" into ${selector}`,
      };
    } catch (error) {
      throw new Error(
        `Type failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async scroll(direction: string, amount = 500, tabId?: number): Promise<any> {
    try {
      const result = await this.webSocketServer.sendCommand("scroll", {
        direction,
        amount,
        tabId,
      });
      return {
        success: true,
        direction,
        amount,
        tabId: tabId || "active",
        message: `Successfully scrolled ${direction} by ${amount} pixels`,
      };
    } catch (error) {
      throw new Error(
        `Scroll failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async screenshot(tabId?: number): Promise<any> {
    try {
      const result = await this.webSocketServer.sendCommand("screenshot", {
        tabId,
      });

      // Save screenshot to temp file
      const timestamp = Date.now();
      const filename = `chrome-screenshot-${timestamp}.png`;
      const tempDir = tmpdir();
      const filepath = join(tempDir, filename);

      // Extract base64 data from data URL with improved format handling
      let base64Data = result.screenshot;
      let imageFormat = "png";

      // Check if it's a data URL and extract the format and data
      const dataUrlMatch = base64Data.match(
        /^data:image\/([^;]+);base64,(.*)$/,
      );
      if (dataUrlMatch) {
        imageFormat = dataUrlMatch[1];
        base64Data = dataUrlMatch[2];
      } else if (base64Data.startsWith("data:")) {
        // Handle other data URL formats
        const dataUrlParts = base64Data.split(",");
        if (dataUrlParts.length === 2) {
          base64Data = dataUrlParts[1];
          // Try to extract format from the header
          const formatMatch = dataUrlParts[0].match(/data:image\/([^;]+)/);
          if (formatMatch) {
            imageFormat = formatMatch[1];
          }
        }
      }

      try {
        const buffer = Buffer.from(base64Data, "base64");

        // Validate that we have a valid buffer
        if (buffer.length === 0) {
          throw new Error("Invalid screenshot data: empty buffer");
        }

        // Update filename with correct extension
        const actualFilename = `chrome-screenshot-${timestamp}.${imageFormat}`;
        const actualFilepath = join(tempDir, actualFilename);

        // Write to temp file
        writeFileSync(actualFilepath, buffer);

        return {
          success: true,
          screenshotPath: actualFilepath,
          filename: actualFilename,
          timestamp: result.timestamp,
          tabId: tabId || "active",
          message: `Screenshot saved to: ${actualFilepath}`,
        };
      } catch (bufferError) {
        throw new Error(
          `Failed to process screenshot data: ${bufferError instanceof Error ? bufferError.message : String(bufferError)}`,
        );
      }
    } catch (error) {
      throw new Error(
        `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getContent(selector?: string, tabId?: number): Promise<any> {
    try {
      const result = await this.webSocketServer.sendCommand("get_web_content", {
        selector,
        tabId,
      });
      return {
        success: true,
        content: result,
        selector: selector || "page",
        tabId: tabId || "active",
        message: selector
          ? `Successfully retrieved content from element: ${selector}`
          : "Successfully retrieved page content",
      };
    } catch (error) {
      throw new Error(
        `Get content failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getInteractiveElements(tabId?: number): Promise<any> {
    try {
      const result = await this.webSocketServer.sendCommand(
        "get_interactive_elements",
        { tabId },
      );
      return {
        success: true,
        elements: result,
        count: result.length,
        tabId: tabId || "active",
        message: `Found ${result.length} interactive elements`,
      };
    } catch (error) {
      throw new Error(
        `Get interactive elements failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async waitForElement(
    selector: string,
    timeout = 10000,
    tabId?: number,
  ): Promise<any> {
    try {
      await this.webSocketServer.sendCommand("wait_for_element", {
        selector,
        timeout,
        tabId,
      });
      return {
        success: true,
        selector,
        timeout,
        tabId: tabId || "active",
        message: `Element appeared: ${selector}`,
      };
    } catch (error) {
      throw new Error(
        `Wait for element failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createTab(url: string): Promise<any> {
    try {
      const tab = await this.webSocketServer.sendCommand("create_tab", { url });
      return {
        success: true,
        tab,
        url,
        message: `Successfully created new tab: ${url}`,
      };
    } catch (error) {
      throw new Error(
        `Create tab failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  isConnected(): boolean {
    return this.webSocketServer.isExtensionConnected();
  }
}
