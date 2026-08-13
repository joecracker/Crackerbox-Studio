import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatMessage } from "./useChatHistory";

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const HISTORY_LIMIT = 40;
const TEXT_FILE_RE =
  /\.(txt|md|markdown|json|js|jsx|mjs|cjs|ts|tsx|css|html|svg|csv|yml|yaml|toml|xml|py|rs|go|java|sh|env)$/i;

type PayloadRole = "system" | "user" | "assistant";

interface PayloadTextPart {
  type: "text";
  text: string;
}

interface PayloadImagePart {
  type: "image_url";
  image_url: { url: string; detail: string };
}

type PayloadContent = string | (PayloadTextPart | PayloadImagePart)[];

export interface ChatStreamOptions {
  activeProjectId: string;
  messages: ChatMessage[];
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  getApiKey: () => string | null;
  appendAssistant: () => string;
  patchAssistant: (id: string, updater: (text: string) => string) => void;
  removeAssistant: (id: string) => void;
}

export interface ChatStreamResult {
  ok: boolean;
  error: string | null;
}

export interface ChatStreamState {
  busy: boolean;
  error: string | null;
  dismissError: () => void;
  stream: (text: string, attachments: ChatAttachment[]) => Promise<ChatStreamResult>;
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

function messageToPayload(message: ChatMessage): {
  role: "user" | "assistant";
  content: PayloadContent;
} {
  return { role: message.role, content: contentFor(message.text, message.attachments) };
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

function candidateContent(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const choices = (json as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const choice = choices[0] as Record<string, unknown>;
  const delta = choice.delta;
  if (delta && typeof delta === "object") {
    const content = (delta as Record<string, unknown>).content;
    if (typeof content === "string") return content;
  }
  const fullMessage = choice.message as Record<string, unknown> | undefined;
  if (fullMessage && typeof fullMessage.content === "string") return fullMessage.content;
  return "";
}

export function useChatStream(options: ChatStreamOptions): ChatStreamState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

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
    }
  }, [options.activeProjectId]);

  const dismissError = useCallback(() => setError(null), []);

  const stream = useCallback(
    async (text: string, attachments: ChatAttachment[]): Promise<ChatStreamResult> => {
      const {
        model,
        systemPrompt,
        temperature,
        maxTokens,
        messages,
        getApiKey,
        appendAssistant,
        patchAssistant,
        removeAssistant,
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

      const assistantId = appendAssistant();
      const controller = new AbortController();
      abortRef.current = controller;

      const userPayload = messageToPayload({
        id: "",
        role: "user",
        text,
        attachments,
        createdAt: Date.now(),
      });

      const payload: { role: PayloadRole; content: PayloadContent }[] = [
        { role: "system", content: systemPrompt },
        ...messages.slice(-HISTORY_LIMIT).map(messageToPayload),
        userPayload,
      ];

      let receivedText = "";

      const finish = (result: ChatStreamResult): ChatStreamResult => {
        if (abortRef.current === controller) abortRef.current = null;
        busyRef.current = false;
        setBusy(false);
        return result;
      };

      const fail = (message: string): ChatStreamResult => {
        if (receivedText === "") removeAssistant(assistantId);
        setError(message);
        return finish({ ok: false, error: message });
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
            messages: payload,
            stream: true,
            temperature,
            max_tokens: maxTokens,
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
        if (!reason) {
          reason =
            res.status === 401
              ? "Invalid OpenRouter API key — save a new one in the vault."
              : res.status === 402
                ? "Insufficient OpenRouter credits — add funds to your account."
                : res.status === 429
                  ? "Rate limited (429) — wait a moment and try again."
                  : res.status === 404
                    ? `Model unavailable (${model}).`
                    : `Request failed (${res.status}).`;
        }
        return fail(reason);
      }

      try {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Response has no readable stream");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newline = buffer.indexOf("\n");
          while (newline !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              if (data === "[DONE]") return finish({ ok: true, error: null });
              let json: unknown;
              try {
                json = JSON.parse(data);
              } catch {
                continue;
              }
              const err = extractError(json);
              if (err) throw new Error(err);
              const content = candidateContent(json);
              if (content) {
                receivedText += content;
                patchAssistant(assistantId, (prev) => prev + content);
              }
            }
            newline = buffer.indexOf("\n");
          }
        }

        return finish({ ok: true, error: null });
      } catch (e) {
        if (controller.signal.aborted) {
          if (receivedText === "") removeAssistant(assistantId);
          return finish({ ok: false, error: null });
        }
        const message = e instanceof Error && e.message ? e.message : "Streaming failed";
        return fail(message);
      }
    },
    []
  );

  return { busy, error, dismissError, stream };
}