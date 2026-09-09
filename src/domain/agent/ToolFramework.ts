/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tool, ToolDefinition, ToolContext } from "./types";
import { EventBus } from "./EventBus";

/**
 * 1. Filesystem Access Tool
 */
export class FilesystemTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "filesystem",
      description: "Perform CRUD file operations within sandboxed workspace.",
      parameters: {
        operation: { type: "string", description: "Either 'read', 'write', 'delete' or 'list'", required: true },
        path: { type: "string", description: "Relative file path targeting", required: true },
        content: { type: "string", description: "Text content to write", required: false }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { operation, path: targetPath, content } = args;
    EventBus.getInstance().emit("ToolExecuted", { tool: "filesystem", operation, path: targetPath }, context.agentId, context.taskId);

    return {
      success: true,
      message: `Filesystem operation '${operation}' executed on path '${targetPath}' successfully.`,
      bytesTransferred: content ? content.length : 0
    };
  }
}

/**
 * 2. Headless Browser Simulating Tool
 */
export class BrowserTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "browser",
      description: "Navigate websites, extract schemas, click selectors, and capture visual state.",
      parameters: {
        url: { type: "string", description: "URL destination", required: true },
        action: { type: "string", description: "Either 'navigate', 'click', 'extract' or 'screenshot'", required: false },
        selector: { type: "string", description: "Target CSS element", required: false }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { url, action = "navigate", selector } = args;
    EventBus.getInstance().emit("BrowserOpened", { url, action, selector }, context.agentId, context.taskId);
    EventBus.getInstance().emit("ToolExecuted", { tool: "browser", url, action }, context.agentId, context.taskId);

    return {
      status: 200,
      title: "Google Workspace Portal",
      extractedData: { linksCount: 14, headings: ["Direct Integration Hub", "Dashboard Console"] },
      screenshotUri: `data:image/png;base64,mockScreenshotBytes_URL_${encodeURIComponent(url)}`
    };
  }
}

/**
 * 3. Secure Terminal Command Tool
 */
export class TerminalTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "terminal",
      description: "Run vetted CLI commands in the host shell console.",
      parameters: {
        command: { type: "string", description: "Vetted terminal CLI utility call", required: true }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { command } = args;
    EventBus.getInstance().emit("ToolExecuted", { tool: "terminal", command }, context.agentId, context.taskId);

    return {
      exitCode: 0,
      stdout: `[Terminal stdout] Successfully ran: ${command}\nAll dependencies verified. Build succeeded.\n`,
      stderr: ""
    };
  }
}

/**
 * 4. Context Memory Interaction Tool
 */
export class MemoryTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "memory_tool",
      description: "Recall or store records inside Working and Semantic memory partitions.",
      parameters: {
        action: { type: "string", description: "'retrieve' or 'persist'", required: true },
        key: { type: "string", description: "Key name", required: true },
        value: { type: "string", description: "Content string value", required: false }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { action, key, value } = args;
    EventBus.getInstance().emit("ToolExecuted", { tool: "memory", action, key }, context.agentId, context.taskId);
    EventBus.getInstance().emit("MemoryUpdated", { action, key, value }, context.agentId, context.taskId);

    return {
      success: true,
      key,
      value: action === "retrieve" ? `Retrieved mock memory value for key: ${key}` : value
    };
  }
}

/**
 * 5. SMTP/Gmail Transceiver Tool
 */
export class EmailTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "email",
      description: "Send transactional emails to external accounts.",
      parameters: {
        to: { type: "string", description: "Target recipient address", required: true },
        subject: { type: "string", description: "Email subject heading", required: true },
        body: { type: "string", description: "Raw text or HTML email content", required: true }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { to, subject, body } = args;
    EventBus.getInstance().emit("ToolExecuted", { tool: "email", to, subject }, context.agentId, context.taskId);

    return {
      success: true,
      messageId: `msg-email-${Date.now()}@aziz-os.internal`,
      recipient: to
    };
  }
}

/**
 * 6. Calendar Scheduler Tool
 */
export class CalendarTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "calendar",
      description: "Query and schedule calendar invitations.",
      parameters: {
        action: { type: "string", description: "'list' or 'create'", required: true },
        summary: { type: "string", description: "Event heading", required: false },
        startTime: { type: "string", description: "ISO start timestamp", required: false },
        endTime: { type: "string", description: "ISO end timestamp", required: false }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { action, summary, startTime } = args;
    EventBus.getInstance().emit("ToolExecuted", { tool: "calendar", action, summary }, context.agentId, context.taskId);

    return {
      success: true,
      action,
      eventId: `cal-${Date.now()}`,
      summary: summary || "General Sync",
      scheduledTime: startTime || new Date().toISOString()
    };
  }
}

/**
 * 7. Secure HTTP Fetch Client Tool
 */
export class HttpTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "http",
      description: "Make REST or webhook fetch requests securely.",
      parameters: {
        url: { type: "string", description: "Endpoint URL", required: true },
        method: { type: "string", description: "GET, POST, PUT, DELETE", required: false },
        body: { type: "object", description: "JSON payload body", required: false }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { url, method = "GET" } = args;
    EventBus.getInstance().emit("ToolExecuted", { tool: "http", url, method }, context.agentId, context.taskId);

    return {
      status: 200,
      ok: true,
      data: { msg: `Fetched successfully from endpoint ${url} using method ${method}` }
    };
  }
}

/**
 * 8. Git Version Control Tool
 */
export class GitTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "git",
      description: "Manage source repositories: commit, branch, push, pull.",
      parameters: {
        action: { type: "string", description: "commit, checkout, push, pull", required: true },
        message: { type: "string", description: "Commit message description", required: false }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { action, message } = args;
    EventBus.getInstance().emit("ToolExecuted", { tool: "git", action, message }, context.agentId, context.taskId);

    return {
      success: true,
      currentBranch: "main",
      commitsPushed: action === "push" ? 1 : 0,
      log: `Git '${action}' executed successfully inside local workspace.`
    };
  }
}

/**
 * 9. Database Connector Tool
 */
export class DatabaseTool implements Tool {
  public getDefinition(): ToolDefinition {
    return {
      name: "database",
      description: "Execute SQL statements on PostgreSQL or SQLite database schemas.",
      parameters: {
        query: { type: "string", description: "PostgreSQL or SQLite compatible query text", required: true }
      }
    };
  }

  public async execute(args: Record<string, any>, context: ToolContext): Promise<any> {
    const { query } = args;
    EventBus.getInstance().emit("ToolExecuted", { tool: "database", querySnippet: query.slice(0, 40) }, context.agentId, context.taskId);

    return {
      rowCount: 1,
      rows: [{ id: 1, name: "System Admin Account", email: "sahil.k00267@gmail.com", created_at: new Date().toISOString() }]
    };
  }
}

/**
 * Model Context Protocol (MCP) compatible Tool Registry
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, Tool>;

  private constructor() {
    this.tools = new Map();

    // Register all default out-of-the-box tools
    this.registerTool(new FilesystemTool());
    this.registerTool(new BrowserTool());
    this.registerTool(new TerminalTool());
    this.registerTool(new MemoryTool());
    this.registerTool(new EmailTool());
    this.registerTool(new CalendarTool());
    this.registerTool(new HttpTool());
    this.registerTool(new GitTool());
    this.registerTool(new DatabaseTool());
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public registerTool(tool: Tool): void {
    const def = tool.getDefinition();
    this.tools.set(def.name, tool);
  }

  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getToolsList(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.getDefinition());
  }

  public async executeTool(name: string, args: Record<string, any>, context: ToolContext): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool with name "${name}" is not registered in the ToolRegistry.`);
    }

    // Validate parameters
    const def = tool.getDefinition();
    for (const key in def.parameters) {
      if (def.parameters[key].required && args[key] === undefined) {
        throw new Error(`Missing required parameter "${key}" for tool "${name}".`);
      }
    }

    return tool.execute(args, context);
  }
}
