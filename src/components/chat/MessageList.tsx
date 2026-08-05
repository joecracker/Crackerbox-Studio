import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../hooks/useChatHistory";

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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
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
        {message.text && (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
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
}

export default function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div
        data-native-context-menu=""
        className="flex min-h-0 flex-1 items-center justify-center p-8"
      >
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-zinc-100">Cracker Box</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Start a conversation about your workspace. Ask questions, attach files, and get
            AI-assisted help — replies are coming in a follow-up feature.
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
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}
