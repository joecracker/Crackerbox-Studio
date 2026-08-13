import { useEffect, useRef } from "react";
import type { ChatMessage, ChatToolCall } from "../../hooks/useChatHistory";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function AttachmentList({ attachments }: { attachments: ChatMessage["attachments"] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map((a) =>
        a.dataUrl && a.type.startsWith("image/") ? (
          <img
            key={a.id}
            src={a.dataUrl}
            alt={a.name}
            className="max-h-40 max-w-full rounded-md object-cover"
          />
        ) : (
          <div
            key={a.id}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-zinc-400">
              <path
                d="M4 2.5h5.5L12.5 6v7.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path d="M9.5 2.5v3.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span className="max-w-36 truncate text-[11px] text-zinc-200">{a.name}</span>
            <span className="text-[10px] tabular-nums text-zinc-500">{formatSize(a.size)}</span>
          </div>
        )
      )}
    </div>
  );
}

function toolArgsPath(args: string): string {
  try {
    const parsed = JSON.parse(args || "{}") as Record<string, unknown>;
    if (typeof parsed.path === "string") return parsed.path;
    if (typeof parsed.command === "string") return parsed.command;
    if (typeof parsed.spec === "string") return `npm install ${parsed.spec}`;
  } catch {
    // ignore malformed arguments
  }
  return "";
}

function toolSummary(call: ChatToolCall): string {
  const result = call.result ?? "";
  if (call.name === "list_directory") {
    const count = result.split("\n").filter((line) => line.trim().length > 0).length;
    return `${count} ${count === 1 ? "entry" : "entries"}`;
  }
  if (call.name === "read_file") {
    return formatSize(new TextEncoder().encode(result).length);
  }
  if (call.name === "run_command" || call.name === "install_package") {
    const firstLine = result.split("\n")[0] ?? "";
    return firstLine.trim();
  }
  return "";
}

function ToolActivity({ call }: { call: ChatToolCall }) {
  const path = toolArgsPath(call.arguments);
  const summary = toolSummary(call);
  return (
    <div className="mt-1 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {call.status === "done" && (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-emerald-400">
            <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {call.status === "error" && (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-red-400">
            <path d="M8 1.8 15 13.8H1L8 1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M8 6v3M8 11.2v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
        {call.status === "rejected" && (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-amber-400">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        {call.status === "blocked" && (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-red-400">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 5l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
        {call.status === "approval" && (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-sky-400">
            <path d="M8 12h.5M6 5a2 2 0 1 1 3.5 1.3C8.7 7.1 8 7.6 8 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
        {call.status === "running" && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
        )}
      </span>
      <code className="shrink-0 font-mono text-[11px] font-medium text-zinc-300">{call.name}</code>
      {path && (
        <code className="max-w-56 truncate rounded bg-zinc-800/80 px-1 py-px font-mono text-[10px] text-zinc-400">
          {path}
        </code>
      )}
      {call.status === "approval" && (
        <span className="min-w-0 truncate text-[11px] text-sky-400">awaiting approval</span>
      )}
      {call.status !== "running" && call.status !== "approval" && (
        <span
          className={`min-w-0 truncate text-[11px] ${
            call.status === "error" || call.status === "blocked"
              ? "text-red-400"
              : call.status === "rejected"
                ? "text-amber-400"
                : "text-zinc-500"
          }`}
        >
          {call.status === "error"
            ? (call.result ?? "failed")
            : call.status === "blocked"
              ? (call.result ?? "blocked")
              : call.status === "rejected"
                ? (call.result ?? "rejected")
                : summary}
        </span>
      )}
    </div>
  );
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const isUser = message.role === "user";
  const pending = !isUser && streaming && !message.text;
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm border border-sky-500/25 bg-sky-500/10 text-zinc-100"
            : "rounded-bl-sm border border-zinc-800 bg-zinc-800/60 text-zinc-200"
        }`}
      >
        {message.attachments.length > 0 && <AttachmentList attachments={message.attachments} />}
        {pending ? (
          <span className="flex items-center gap-1 py-0.5" aria-label="Assistant is thinking">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500"
                style={{ animationDelay: `${dot * 160}ms` }}
              />
            ))}
          </span>
        ) : (
          message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>
        )}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {message.toolCalls.map((call) => (
              <ToolActivity key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
      <span className="mt-1 text-[10px] tabular-nums text-zinc-600">
        {isUser ? "You" : "Assistant"} · {formatTime(message.createdAt)}
      </span>
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  streaming?: boolean;
}

export default function MessageList({ messages, streaming = false }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastText = messages.length > 0 ? messages[messages.length - 1].text : "";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastText]);

  if (messages.length === 0) {
    return (
      <div
        data-native-context-menu=""
        className="flex min-h-0 flex-1 items-center justify-center p-8"
      >
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-zinc-100">Cracker Box</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Start a conversation about your workspace. Ask questions and attach files — the model
            streams its reply right in this chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      data-native-context-menu=""
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            streaming={streaming && index === messages.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
