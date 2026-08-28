import { useCallback, useEffect, useRef, useState } from "react";
import { McpClient, mcpToolToDefinition } from "../utils/mcp";
import type { McpTool } from "../utils/mcp";
import type { ToolDefinition } from "./useChatStream";

const KEY = "crackerbox.mcp";

interface UseMcpOptions {
  token: string | null;
}

export interface McpController {
  url: string;
  setUrl: (url: string) => void;
  connected: boolean;
  connecting: boolean;
  tools: McpTool[];
  toolDefinitions: ToolDefinition[];
  error: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
}

export function useMcp({ token }: UseMcpOptions): McpController {
  const [url, setUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<McpClient | null>(null);

  const persistUrl = useCallback((next: string) => {
    setUrl(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current = null;
    };
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!url.trim()) {
      setError("Enter the Home Assistant MCP server URL first.");
      return false;
    }
    setConnecting(true);
    setError(null);
    try {
      const client = new McpClient(url.trim(), token);
      await client.initialize();
      const list = await client.listTools();
      clientRef.current = client;
      setTools(list);
      setConnected(true);
      return true;
    } catch (e) {
      clientRef.current = null;
      setConnected(false);
      setTools([]);
      setError(e instanceof Error ? e.message : "Could not connect to the MCP server.");
      return false;
    } finally {
      setConnecting(false);
    }
  }, [url, token]);

  const disconnect = useCallback(() => {
    clientRef.current = null;
    setConnected(false);
    setTools([]);
    setError(null);
  }, []);

  const callTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<string> => {
      const client = clientRef.current;
      if (!client) throw new Error("MCP not connected.");
      return client.callTool(name, args);
    },
    []
  );

  const toolDefinitions: ToolDefinition[] = tools.map(mcpToolToDefinition);

  return {
    url,
    setUrl: persistUrl,
    connected,
    connecting,
    tools,
    toolDefinitions,
    error,
    connect,
    disconnect,
    callTool,
  };
}