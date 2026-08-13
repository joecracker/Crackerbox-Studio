import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";
import type { ChatAttachment } from "../../hooks/useChatHistory";

const MAX_EMBED_SIZE = 1_500_000;
const ACCEPT =
  "image/*,.txt,.md,.json,.js,.mjs,.cjs,.ts,.tsx,.jsx,.css,.html,.svg,.csv,.yml,.yaml,.toml,.xml,.py,.rs,.go,.java,.sh,.env";

interface ComposerProps {
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onOpenParameters: () => void;
  disabled?: boolean;
  disabledReason?: string | null;
  busy?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function Composer({
  onSend,
  onOpenParameters,
  disabled = false,
  disabledReason = null,
  busy = false,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = text.trim().length > 0 || attachments.length > 0;

  const syncHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  useEffect(() => {
    syncHeight();
  }, [text]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const resetComposer = () => {
    setText("");
    setAttachments([]);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = "60px";
    }
  };

  const handleSend = () => {
    if (!canSend) return;
    if (disabled || busy) return;
    onSend(text.trim(), attachments);
    resetComposer();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const images = items.filter((item) => item.type.startsWith("image/"));
    if (images.length === 0) return;
    e.preventDefault();
    const files = images
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length > 0) addFiles(files);
  };

  const addFiles = (files: File[]) => {
    files.forEach((file) => {
      const attachment: ChatAttachment = {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      };
      if (file.size <= MAX_EMBED_SIZE) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            { ...attachment, dataUrl: String(reader.result) },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, attachment]);
      }
    });
  };

  const handlePickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    addFiles(files);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      data-native-context-menu=""
      className="shrink-0 border-t border-zinc-800 px-4 pb-3 pt-2"
    >
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 py-1 pl-1.5 pr-1"
            >
              {a.dataUrl && a.type.startsWith("image/") ? (
                <img
                  src={a.dataUrl}
                  alt={a.name}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-zinc-400">
                  <path
                    d="M4 2.5h5.5L12.5 6v7.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path d="M9.5 2.5v3.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              )}
              <span className="max-w-36 truncate text-[11px] text-zinc-300">{a.name}</span>
              <span className="text-[10px] tabular-nums text-zinc-600">{formatSize(a.size)}</span>
              {!a.dataUrl && (
                <span className="text-[10px] text-amber-400/80">not embedded</span>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                aria-label={`Remove ${a.name}`}
                className="flex h-4 w-4 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 focus-within:border-sky-600 focus-within:ring-1 focus-within:ring-sky-600">
        {disabled && disabledReason && (
          <div className="flex items-start gap-1.5 border-b border-zinc-800 px-3 py-1.5 text-[11px] leading-relaxed text-amber-400/90">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            >
              <path
                d="M8 1.8 15 13.8H1L8 1.8Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path d="M8 6v3M8 11.2v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span>{disabledReason}</span>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          placeholder="Ask anything…"
          className="block w-full resize-none bg-transparent px-3 pb-1 pt-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          style={{ minHeight: 60, maxHeight: 200, overflowY: "auto" }}
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <button
            type="button"
            onClick={onOpenParameters}
            title="Assistant settings"
            aria-label="Assistant settings"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="6" cy="4" r="1.2" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="10" cy="8" r="1.2" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="5" cy="12" r="1.2" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach a file"
            aria-label="Attach a file"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={handlePickFiles}
            className="hidden"
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || disabled || busy}
            aria-label="Send message"
            title={busy ? "Waiting for reply…" : "Send (Enter)"}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500 text-zinc-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 8h11M9.5 3.5 14 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
