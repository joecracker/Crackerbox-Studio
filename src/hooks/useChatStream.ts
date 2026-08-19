import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWorkspaceFS,
  executeWorkspaceTool,
  formatDirectoryLines,
  getFile,
} from "../utils/workspace";
import {
  writeWorkspaceFile,
  deleteWorkspaceFile,
  runCommandInContainer,
  installPackageInContainer,
  listDirectoryInContainer,
  readFileInContainer,
} from "../utils/workspaceWebContainer";
import { checkCommandDenylist } from "../utils/commandGuard";
import { buildFileIndex, isExplicitlyRequested, isTinySafeEdit } from "../utils/approvalPolicy";
import type { GuardrailMode } from "../utils/approvalPolicy";
import {
  interpretApprovalReply,
  type ApprovalActionName,
  type ApprovalReplyDecision,
} from "../utils/approvalReply";
import { lintContentInContainer, isLintablePath } from "../utils/lint";
import type { LintResult } from "../utils/lint";
import type {
  ChatToolCall,
  ChatAttachment,
  ChatMessage,
  ChatToolCallPartial,
} from "./useChatHistory";
import type { DemoFile } from "../data/demoFiles";
import type { WebContainer } from "@webcontainer/api";

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const HISTORY_LIMIT = 40;
const MAX_TOOL_ITERATIONS = 8;
const READY_TIMEOUT_MS = 10_000;
const TEXT_FILE_RE =
  /\.(txt|md|markdown|json|js|jsx|mjs|cjs|ts|tsx|css|html|svg|csv|yml|yaml|toml|xml|py|rs|go|java|sh|env)$/i;

interface PayloadTextPart {
  type: "text";
  text: string;
}

interface PayloadImagePart {
  type: "image_url";
  image_url: { url: string; detail: string };
}

type PayloadContent = string | (PayloadTextPart | PayloadImagePart)[];

interface ToolCallPayload {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface PayloadToolMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

type PayloadMessage =
  | { role: "system" | "user" | "assistant"; content: PayloadContent; tool_calls?: ToolCallPayload[] }
  | PayloadToolMessage;

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const READONLY_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_directory",
      description:
        "List the entries in a directory of the active project workspace. Directories are " +
        "suffixed with '/'. Pass an empty string ('') for the project root.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Directory path relative to the project root, e.g. 'src' or 'src/components'. " +
              "Use forward slashes.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a text file in the active project workspace. Returns the raw " +
        "file content.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path relative to the project root, e.g. 'src/App.tsx'.",
          },
        },
        required: ["path"],
      },
    },
  },
];

const WRITE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write a text file to the active project workspace. If the user explicitly asked for " +
        "this file to be changed in their message, it is applied immediately (the diff is " +
        "shown in the chat). Otherwise the user's approval is requested — the full new file " +
        "content is shown as a diff before it is applied. Provide the complete new file contents.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path relative to the project root, e.g. 'src/App.tsx'.",
          },
          content: {
            type: "string",
            description: "The complete new file contents.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description:
        "Delete a text file from the active project workspace. Requires the user's approval — " +
        "the file content is shown before it is removed.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path relative to the project root, e.g. 'src/tmp.ts'.",
          },
        },
        required: ["path"],
      },
    },
  },
];

const COMMAND_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Run a shell command in the project workspace (WebContainers). Requires the user's " +
        "approval — the exact command is shown before it runs. Use only for safe, project-scoped " +
        "commands.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The exact command line to run, e.g. 'npm run build'.",
          },
          description: {
            type: "string",
            description:
              "Short explanation of why you want to run this command — shown to the user for " +
              "approval.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "install_package",
      description:
        "Install an npm package into the project workspace. Requires the user's approval — the " +
        "exact package spec is shown before it installs.",
      parameters: {
        type: "object",
        properties: {
          spec: {
            type: "string",
            description: "The npm package name (and optional version), e.g. 'express' or 'lodash@4'.",
          },
          description: {
            type: "string",
            description:
              "Short explanation of why you want to install this package — shown to the user for " +
              "approval.",
          },
        },
        required: ["spec"],
      },
    },
  },
];

function toolsFor(webContainer: WebContainer | null, available: boolean): ToolDefinition[] {
  return available && webContainer !== null
    ? [...READONLY_TOOLS, ...WRITE_TOOLS, ...COMMAND_TOOLS]
    : READONLY_TOOLS;
}

export interface ChatStreamOptions {
  activeProjectId: string;
  messages: ChatMessage[];
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  getApiKey: () => string | null;
  workspaceFiles: DemoFile[];
  webContainer: WebContainer | null;
  webContainerAvailable: boolean;
  guardrailMode: GuardrailMode;
  whenReady: (timeoutMs?: number) => Promise<WebContainer | null>;
  refreshTree: () => Promise<void>;
  persistFile: (path: string, content: string) => void;
  removeFile: (path: string) => void;
  appendAssistant: () => string;
  patchAssistant: (id: string, updater: (text: string) => string) => void;
  removeAssistant: (id: string) => void;
  setAssistantToolCalls: (id: string, calls: ChatToolCall[]) => void;
  patchAssistantToolCall: (
    id: string,
    callId: string,
    patch: ChatToolCallPartial
  ) => void;
}

export interface ChatStreamResult {
  ok: boolean;
  error: string | null;
}

export interface PendingApproval {
  callId: string;
  name: "write_file" | "delete_file" | "run_command" | "install_package" | "preview_start";
  path: string;
  content: string;
  oldContent: string;
  newContent: string;
  rationale: string;
  command?: string;
  lint?: LintResult | null;
}

export interface ChatStreamState {
  busy: boolean;
  error: string | null;
  dismissError: () => void;
  stream: (text: string, attachments: ChatAttachment[]) => Promise<ChatStreamResult>;
  approval: PendingApproval | null;
  resolveApproval: (callId: string, approved: boolean) => void;
  resolveApprovalWithReply: (callId: string, reply: string) => "resolved" | "ambiguous";
}

function decodeDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return "";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function contentFor(text: string, attachments: ChatAttachment[]): PayloadContent {
  const textAttachments = attachments.filter(
    (a) =>
      a.dataUrl &&
      !a.type.startsWith("image/") &&
      (a.type.startsWith("text/") || TEXT_FILE_RE.test(a.name))
  );
  const images = attachments.filter((a) => a.dataUrl && a.type.startsWith("image/"));

  const fullText = [
    text,
    ...textAttachments.map(
      (a) => `[Attachment: ${a.name}]\n${decodeDataUrl(a.dataUrl as string).trim()}`
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  if (images.length === 0) return fullText;

  const parts: (PayloadTextPart | PayloadImagePart)[] = [];
  if (fullText) parts.push({ type: "text", text: fullText });
  for (const img of images) {
    parts.push({ type: "image_url", image_url: { url: img.dataUrl as string, detail: "auto" } });
  }
  return parts;
}

function messageToPayloadMessages(message: ChatMessage): PayloadMessage[] {
  const base: PayloadMessage = {
    role: message.role,
    content: contentFor(message.text, message.attachments),
  };
  const calls = message.toolCalls;
  if (message.role !== "assistant" || !calls || calls.length === 0) return [base];
  const toolCalls: ToolCallPayload[] = calls.map((c) => ({
    id: c.id,
    type: "function",
    function: { name: c.name, arguments: c.arguments },
  }));
  const tools: PayloadToolMessage[] = calls
    .filter((c) => c.result != null)
    .map((c) => ({ role: "tool", tool_call_id: c.id, content: c.result as string }));
  return [{ ...base, tool_calls: toolCalls }, ...tools];
}

function extractError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const error = obj.error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  if (typeof obj.message === "string") return obj.message;
  return null;
}

interface ToolCallDeltaFragment {
  index?: number;
  id?: string;
  name?: string;
  arguments?: string;
}

function extractDelta(json: unknown): { content?: string; toolCalls?: ToolCallDeltaFragment[] } {
  if (!json || typeof json !== "object") return {};
  const choices = (json as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return {};
  const choice = choices[0] as Record<string, unknown>;
  const delta = choice.delta;
  if (!delta || typeof delta !== "object") {
    const fullMessage = choice.message as Record<string, unknown> | undefined;
    if (fullMessage && typeof fullMessage.content === "string") {
      return { content: fullMessage.content };
    }
    return {};
  }
  const out: { content?: string; toolCalls?: ToolCallDeltaFragment[] } = {};
  const content = (delta as Record<string, unknown>).content;
  if (typeof content === "string") out.content = content;
  const toolCalls = (delta as Record<string, unknown>).tool_calls;
  if (Array.isArray(toolCalls)) {
    out.toolCalls = toolCalls.map((tc) => {
      const t = (tc ?? {}) as Record<string, unknown>;
      const fn = (t.function ?? {}) as Record<string, unknown>;
      const frag: ToolCallDeltaFragment = {};
      if (typeof t.index === "number") frag.index = t.index;
      if (typeof t.id === "string") frag.id = t.id;
      if (typeof fn.name === "string") frag.name = fn.name;
      if (typeof fn.arguments === "string") frag.arguments = fn.arguments;
      return frag;
    });
  }
  return out;
}

interface ToolCallDraft {
  index: number;
  id?: string;
  name?: string;
  arguments: string;
}

function createToolCallId(): string {
  return `call_${Math.random().toString(36).slice(2, 10)}`;
}

function looksToolRelated(reason: string): boolean {
  return /tool|tools|function|unsupported parameter|unknown parameter/i.test(reason);
}

function statusReason(status: number, model: string): string {
  switch (status) {
    case 401:
      return "Invalid OpenRouter API key — save a new one in the vault.";
    case 402:
      return "Insufficient OpenRouter credits — add funds to your account.";
    case 429:
      return "Rate limited (429) — wait a moment and try again.";
    case 404:
      return `Model unavailable (${model}).`;
    default:
      return `Request failed (${status}).`;
  }
}

export function useChatStream(options: ChatStreamOptions): ChatStreamState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const approvalBatchRef = useRef<ApprovalReplyDecision | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const projectRef = useRef(options.activeProjectId);
  useEffect(() => {
    if (projectRef.current !== options.activeProjectId) {
      projectRef.current = options.activeProjectId;
      abortRef.current?.abort();
      abortRef.current = null;
      busyRef.current = false;
      setBusy(false);
      setApproval(null);
      const resolver = approvalResolverRef.current;
      approvalResolverRef.current = null;
      resolver?.(false);
    }
  }, [options.activeProjectId]);

  const dismissError = useCallback(() => setError(null), []);

  const resolveApproval = useCallback((callId: string, approved: boolean) => {
    setApproval((current) => {
      if (current && current.callId === callId) return null;
      return current;
    });
    approvalResolverRef.current?.(approved);
    approvalResolverRef.current = null;
  }, []);

  const resolveApprovalWithReply = useCallback(
    (callId: string, reply: string): "resolved" | "ambiguous" => {
      const decision = interpretApprovalReply(reply);
      const current = approval;
      if (decision.kind === "unknown") return "ambiguous";
      if (current && current.callId !== callId) return "ambiguous";
      approvalBatchRef.current = decision;
      if (decision.kind === "approve") {
        approvalResolverRef.current?.(true);
      } else if (decision.kind === "reject") {
        approvalResolverRef.current?.(false);
      } else if (decision.kind === "approveAll") {
        approvalResolverRef.current?.(true);
      } else if (decision.kind === "rejectAll") {
        approvalResolverRef.current?.(false);
      } else if (decision.kind === "perAction") {
        const name = current?.name ?? "unknown";
        const verdict =
          name in decision.actions ? decision.actions[name as ApprovalActionName] : decision.defaultForOthers;
        approvalResolverRef.current?.(verdict);
      }
      approvalResolverRef.current = null;
      setApproval(null);
      return "resolved";
    },
    [approval]
  );

  const stream = useCallback(
    async (text: string, attachments: ChatAttachment[]): Promise<ChatStreamResult> => {
      const {
        model,
        systemPrompt,
        temperature,
        maxTokens,
        messages,
        getApiKey,
        workspaceFiles,
        webContainer,
        webContainerAvailable,
        guardrailMode,
        whenReady,
        refreshTree,
        persistFile,
        removeFile,
        appendAssistant,
        patchAssistant,
        removeAssistant,
        setAssistantToolCalls,
        patchAssistantToolCall,
      } = optionsRef.current;

      const guardError = !model
        ? "No model selected — open Parameters and pick a model."
        : !getApiKey()
          ? "No OpenRouter API key — unlock the vault (Deploy tab) and add one."
          : null;
      if (guardError) {
        setError(guardError);
        return { ok: false, error: guardError };
      }
      if (busyRef.current) {
        return { ok: false, error: null };
      }
      busyRef.current = true;
      setBusy(true);
      setError(null);
      approvalBatchRef.current = null;

      let assistantId = appendAssistant();
      const controller = new AbortController();
      abortRef.current = controller;

      const workingPayload: PayloadMessage[] = [
        { role: "system", content: systemPrompt },
        ...messages.slice(-HISTORY_LIMIT).flatMap(messageToPayloadMessages),
        { role: "user", content: contentFor(text, attachments) },
      ];

      const fileIndex = buildFileIndex(workspaceFiles);

      let receivedText = "";
      let toolsEnabled = true;
      let toolMessagesPushed = false;
      let toolIterations = 0;

      const finish = (result: ChatStreamResult): ChatStreamResult => {
        if (abortRef.current === controller) abortRef.current = null;
        busyRef.current = false;
        setBusy(false);
        setApproval(null);
        approvalResolverRef.current = null;
        approvalBatchRef.current = null;
        return result;
      };

      const fail = (message: string): ChatStreamResult => {
        if (receivedText === "") removeAssistant(assistantId);
        setError(message);
        return finish({ ok: false, error: message });
      };

      const requestApproval = (pending: PendingApproval): Promise<boolean> => {
        const batch = approvalBatchRef.current;
        if (batch) {
          if (batch.kind === "approveAll") return Promise.resolve(true);
          if (batch.kind === "rejectAll") return Promise.resolve(false);
          if (batch.kind === "approve") return Promise.resolve(true);
          if (batch.kind === "reject") return Promise.resolve(false);
          if (batch.kind === "perAction") {
            const verdict =
              pending.name in batch.actions
                ? batch.actions[pending.name as ApprovalActionName]
                : batch.defaultForOthers;
            return Promise.resolve(verdict);
          }
        }
        return new Promise<boolean>((resolve) => {
          approvalResolverRef.current = resolve;
          setApproval(pending);
        });
      };

      const parseArgs = (raw: string): Record<string, unknown> => {
        try {
          return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
          return {};
        }
      };

      const readWorkspace = async (
        name: string,
        rawArgs: string
      ): Promise<{ ok: true; content: string } | { ok: false; error: string }> => {
        const container = await whenReady(READY_TIMEOUT_MS);
        if (container) {
          const args = parseArgs(rawArgs);
          const path = typeof args.path === "string" ? args.path : "";
          if (name === "list_directory") {
            const result = await listDirectoryInContainer(container, path);
            if (!result.ok) return result;
            const lines = formatDirectoryLines(result.entries);
            return { ok: true, content: lines.length > 0 ? lines.join("\n") : "(empty directory)" };
          }
          if (name === "read_file") {
            return readFileInContainer(container, path);
          }
          return { ok: false, error: `Unknown tool: ${name}` };
        }
        const fs = createWorkspaceFS(workspaceFiles);
        return executeWorkspaceTool(fs, name, rawArgs);
      };

      const readPathContent = async (path: string): Promise<string> => {
        const container = await whenReady(READY_TIMEOUT_MS);
        if (container) {
          const result = await readFileInContainer(container, path);
          return result.ok ? result.content : "";
        }
        const oldFile = getFile(workspaceFiles, path);
        return oldFile && oldFile.type === "file" ? (oldFile.content ?? "") : "";
      };

      const pushToolResult = (callId: string, content: string) => {
        workingPayload.push({ role: "tool", tool_call_id: callId, content });
      };

      readLoop: while (true) {
        let turnText = "";
        const drafts = new Map<number, ToolCallDraft>();
        let nextCallIndex = 0;
        const collect = (fragments: ToolCallDeltaFragment[]) => {
          for (const frag of fragments) {
            const index = frag.index ?? nextCallIndex++;
            let draft = drafts.get(index);
            if (!draft) {
              draft = { index, arguments: "" };
              drafts.set(index, draft);
            }
            if (frag.id) draft.id = frag.id;
            if (frag.name) draft.name = frag.name;
            if (frag.arguments) draft.arguments += frag.arguments;
          }
        };

        let res: Response;
        try {
          res = await fetch(CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getApiKey()}`,
            },
            body: JSON.stringify({
              model,
              messages: workingPayload,
              stream: true,
              temperature,
              max_tokens: maxTokens,
              ...(toolsEnabled
                ? { tools: toolsFor(webContainer, webContainerAvailable), tool_choice: "auto" as const }
                : {}),
            }),
            signal: controller.signal,
          });
        } catch (e) {
          if (controller.signal.aborted) {
            if (receivedText === "") removeAssistant(assistantId);
            return finish({ ok: false, error: null });
          }
          const message = e instanceof Error && e.message ? e.message : "Network error";
          return fail(`Request failed: ${message}`);
        }

        if (!res.ok) {
          let reason = "";
          try {
            reason = extractError((await res.json()) as unknown) ?? "";
          } catch {
            // non-JSON error body
          }
          if (!reason) reason = statusReason(res.status, model);
          if (
            toolsEnabled &&
            !toolMessagesPushed &&
            res.status === 400 &&
            looksToolRelated(reason)
          ) {
            toolsEnabled = false;
            continue;
          }
          return fail(reason);
        }

        try {
          const reader = res.body?.getReader();
          if (!reader) throw new Error("Response has no readable stream");
          const decoder = new TextDecoder();
          let buffer = "";

          streamLoop: while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newline = buffer.indexOf("\n");
            while (newline !== -1) {
              const line = buffer.slice(0, newline).trim();
              buffer = buffer.slice(newline + 1);
              if (line.startsWith("data:")) {
                const data = line.slice(5).trim();
                if (data === "[DONE]") break streamLoop;
                let json: unknown;
                try {
                  json = JSON.parse(data);
                } catch {
                  continue;
                }
                const err = extractError(json);
                if (err) throw new Error(err);
                const delta = extractDelta(json);
                if (delta.content) {
                  turnText += delta.content;
                  receivedText += delta.content;
                  patchAssistant(assistantId, (prev) => prev + delta.content);
                }
                if (delta.toolCalls && delta.toolCalls.length > 0) collect(delta.toolCalls);
              }
              newline = buffer.indexOf("\n");
            }
          }
        } catch (e) {
          if (controller.signal.aborted) {
            if (receivedText === "") removeAssistant(assistantId);
            return finish({ ok: false, error: null });
          }
          const message = e instanceof Error && e.message ? e.message : "Streaming failed";
          return fail(message);
        }

        const callDrafts = [...drafts.values()].sort((a, b) => a.index - b.index);
        if (callDrafts.length === 0) return finish({ ok: true, error: null });

        if (toolIterations >= MAX_TOOL_ITERATIONS) {
          return fail("Stopped: the model kept requesting tools beyond the iteration limit.");
        }
        toolIterations++;
        toolMessagesPushed = true;

        const calls: ChatToolCall[] = callDrafts.map((d) => ({
          id: d.id ?? createToolCallId(),
          name: d.name ?? "unknown",
          arguments: d.arguments,
          status: "running",
        }));
        setAssistantToolCalls(assistantId, calls);

        workingPayload.push({
          role: "assistant",
          content: turnText,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments },
          })),
        });

        for (const call of calls) {
          const args = parseArgs(call.arguments);
          const path = typeof args.path === "string" ? args.path : "";
          const content = typeof args.content === "string" ? args.content : "";

          if (call.name === "write_file" || call.name === "delete_file") {
            const oldContent = await readPathContent(path);
            const autoApproved =
              call.name === "write_file" &&
              guardrailMode === "tiered" &&
              (isExplicitlyRequested(path, text, fileIndex) ||
                isTinySafeEdit(path, oldContent, content));
            patchAssistantToolCall(assistantId, call.id, {
              status: autoApproved ? "running" : "approval",
              result: undefined,
              oldContent,
              newContent: call.name === "delete_file" ? "" : content,
              autoApproved,
            });
            const pending: PendingApproval = {
              callId: call.id,
              name: call.name,
              path,
              content,
              oldContent,
              newContent: call.name === "delete_file" ? "" : content,
              rationale: turnText,
            };
            if (!autoApproved && isLintablePath(path)) {
              void (async () => {
                try {
                  const container = await whenReady(READY_TIMEOUT_MS);
                  if (!container) return;
                  const lint = await lintContentInContainer(container, path, content);
                  setApproval((current) =>
                    current && current.callId === call.id ? { ...current, lint } : current
                  );
                } catch {
                  // lint is best-effort; never block or break the approval flow
                }
              })();
            }
            const approved = autoApproved || (await requestApproval(pending));
            if (!approved) {
              const rejection = "User rejected this action. Please adjust your approach and propose an alternative.";
              patchAssistantToolCall(assistantId, call.id, { status: "rejected", result: rejection });
              pushToolResult(call.id, rejection);
              continue;
            }
            const container = await whenReady(READY_TIMEOUT_MS);
            if (!container) {
              const message = "WebContainers is unavailable — cannot apply this change.";
              patchAssistantToolCall(assistantId, call.id, { status: "error", result: message });
              pushToolResult(call.id, message);
              continue;
            }
            if (call.name === "write_file") {
              const result = await writeWorkspaceFile(container, path, content);
              const status = result.ok ? "done" : "error";
              const resultText = result.ok
                ? `Wrote file (${result.size} bytes).`
                : `Error: ${result.error}. Try again with a valid path.`;
              patchAssistantToolCall(assistantId, call.id, { status, result: resultText });
              if (result.ok) {
                persistFile(path, content);
                void refreshTree();
              }
              pushToolResult(call.id, resultText);
            } else {
              const result = await deleteWorkspaceFile(container, path);
              const status = result.ok ? "done" : "error";
              const resultText = result.ok ? "Deleted file." : `Error: ${result.error}.`;
              patchAssistantToolCall(assistantId, call.id, { status, result: resultText });
              if (result.ok) {
                removeFile(path);
                void refreshTree();
              }
              pushToolResult(call.id, resultText);
            }
            continue;
          }

          if (call.name === "run_command" || call.name === "install_package") {
            const commandText =
              call.name === "run_command"
                ? (typeof args.command === "string" ? args.command : "")
                : `npm install ${typeof args.spec === "string" ? args.spec : ""}`;
            const description =
              typeof args.description === "string" ? args.description : "";
            const denylist = checkCommandDenylist(commandText);
            if (denylist.blocked) {
              const blockedText = `Blocked: ${denylist.reason}. Propose a non-destructive alternative.`;
              patchAssistantToolCall(assistantId, call.id, {
                status: "blocked",
                result: blockedText,
              });
              pushToolResult(call.id, blockedText);
              continue;
            }
            patchAssistantToolCall(assistantId, call.id, {
              status: "approval",
              result: undefined,
            });
            const approved = await requestApproval({
              callId: call.id,
              name: call.name,
              path: "",
              content: "",
              oldContent: "",
              newContent: "",
              rationale: turnText || description || commandText,
              command: commandText,
            });
            if (!approved) {
              const rejection = "User rejected this action. Please adjust your approach and propose an alternative.";
              patchAssistantToolCall(assistantId, call.id, { status: "rejected", result: rejection });
              pushToolResult(call.id, rejection);
              continue;
            }
            const container = await whenReady(READY_TIMEOUT_MS);
            if (!container) {
              const message = "WebContainers is unavailable — cannot run this command.";
              patchAssistantToolCall(assistantId, call.id, { status: "error", result: message });
              pushToolResult(call.id, message);
              continue;
            }
            const commandResult =
              call.name === "run_command"
                ? await runCommandInContainer(container, commandText)
                : await installPackageInContainer(
                    container,
                    typeof args.spec === "string" ? args.spec : ""
                  );
            const resultSummary =
              commandResult.timedOut
                ? `Timed out after 60s.`
                : commandResult.exitCode === 0
                  ? `Exit code: 0`
                  : `Exit code: ${commandResult.exitCode}`;
            const resultText = `${resultSummary}\n${commandResult.output.trim()}`;
            const status = commandResult.ok ? "done" : "error";
            patchAssistantToolCall(assistantId, call.id, { status, result: resultText });
            pushToolResult(call.id, resultText);
            void refreshTree();
            continue;
          }

          const result = await readWorkspace(call.name, call.arguments);
          const contentText = result.ok ? result.content : `Error: ${result.error}`;
          patchAssistantToolCall(assistantId, call.id, {
            status: result.ok ? "done" : "error",
            result: contentText,
          });
          pushToolResult(call.id, contentText);
        }

        if (controller.signal.aborted) return finish({ ok: false, error: null });

        assistantId = appendAssistant();
      }
    },
    []
  );

  return { busy, error, dismissError, stream, approval, resolveApproval, resolveApprovalWithReply };
}