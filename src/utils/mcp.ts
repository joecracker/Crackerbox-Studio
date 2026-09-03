// Minimal Model Context Protocol (MCP) client using the "Streamable HTTP" transport.
// Works entirely in the browser (fetch + SSE), which is the only way a web app can
// reach a remote MCP server such as Home Assistant's.

import JSON5 from "json5";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

async function readSseData(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let acc = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          acc += trimmed.slice(5).trim();
        }
      }
    }
    if (buffer.trim().startsWith("data:")) {
      acc += buffer.trim().slice(5).trim();
    }
  } finally {
    reader.releaseLock();
  }
  return acc;
}

/**
 * A connection to an MCP server over Streamable HTTP.
 * Set `token` when the server expects an Authorization bearer token.
 */
export class McpClient {
  private url: string;
  private target: string;
  private token: string | null;
  private proxyUrl: string | null;
  private nextId = 1;
  private sessionId: string | null = null;
  private initialized = false;

  constructor(url: string, token: string | null = null, proxyUrl: string | null = null) {
    this.target = url.replace(/\/+$/, "");
    this.token = token;
    this.proxyUrl = proxyUrl;
    // When proxying, the fetch URL is the proxy; the real target goes in a header.
    this.url = proxyUrl ? proxyUrl.replace(/\/+$/, "") : this.target;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    if (this.sessionId) h["Mcp-Session-Id"] = this.sessionId;
    if (this.proxyUrl) h["x-mcp-target"] = this.target;
    return h;
  }

  private async request<T>(
    body: Record<string, unknown>,
    timeoutMs = 30_000
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      throw new Error(e instanceof Error ? `MCP request failed: ${e.message}` : "MCP request failed");
    } finally {
      clearTimeout(timer);
    }

    const newSession = res.headers.get("Mcp-Session-Id");
    if (newSession) this.sessionId = newSession;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MCP server error (HTTP ${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
    }

    const contentType = res.headers.get("Content-Type") ?? "";
    let payloadText: string;
    if (contentType.includes("text/event-stream")) {
      payloadText = await readSseData(res.body as ReadableStream<Uint8Array>);
    } else {
      payloadText = await res.text();
      if (payloadText.trim().startsWith("data:")) {
        payloadText = payloadText
          .split(/\r?\n/)
          .filter((line) => line.trim().startsWith("data:"))
          .map((line) => line.trim().slice(5).trim())
          .join("");
      }
    }

    let json: JsonRpcResponse;
    try {
      json = JSON5.parse(payloadText) as JsonRpcResponse;
    } catch (e) {
      const preview = payloadText.trim().slice(0, 150);
      throw new Error(
        `Failed to parse MCP response as JSON: ${e instanceof Error ? e.message : "parse error"}. Preview: "${preview}"`
      );
    }

    if (json.error) {
      throw new Error(json.error.message || `MCP error ${json.error.code}`);
    }
    return json.result as T;
  }

  async initialize(): Promise<void> {
    await this.request({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "crackerbox", version: "0.1.0" },
      },
    });
    // Notify the server the client is ready (fire-and-forget).
    void fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }).catch(() => {});
    this.initialized = true;
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.request<{ tools?: McpTool[] }>({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/list",
    });
    return Array.isArray(result.tools) ? result.tools : [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.request<{ content?: Array<{ type?: string; text?: string }> }>(
      {
        jsonrpc: "2.0",
        id: this.nextId++,
        method: "tools/call",
        params: { name, arguments: args },
      },
      60_000
    );
    const content = result.content ?? [];
    return content
      .map((c) => c.text ?? "")
      .filter((t) => t.length > 0)
      .join("\n");
  }

  get connected(): boolean {
    return this.initialized;
  }
}

/** Maps an MCP tool definition to the OpenRouter tool JSON schema shape. */
export function mcpToolToDefinition(tool: McpTool): {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
} {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters:
        (tool.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
    },
  };
}