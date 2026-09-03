import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";
import type { ChatAttachment } from "../../hooks/useChatHistory";

const MAX_EMBED_SIZE = 1_500_000;
const ACCEPT =
  "image/*,.txt,.md,.json,.js,.mjs,.cjs,.ts,.tsx,.jsx,.css,.html,.svg,.csv,.yml,.yaml,.toml,.xml,.py,.rs,.go,.java,.sh,.env";

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  item(index: number): SpeechRecognitionAlternative;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechRecognitionResultListLike }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionResultListLike {
  length: number;
  item(index: number): SpeechRecognitionResultLike;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

const SpeechRecognitionCtor =
  typeof window !== "undefined"
    ? (window as unknown as SpeechRecognitionWindow).SpeechRecognition ??
      (window as unknown as SpeechRecognitionWindow).webkitSpeechRecognition
    : undefined;

const speechSupported = SpeechRecognitionCtor != null;

interface ComposerProps {
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onOpenParameters: () => void;
  disabled?: boolean;
  disabledReason?: string | null;
  busy?: boolean;
  modelLabel?: string | null;
  visionSupported?: boolean;
  approvalPending?: boolean;
  onApprovalReply?: (text: string) => "resolved" | "ambiguous";
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
  modelLabel = null,
  visionSupported = true,
  approvalPending = false,
  onApprovalReply,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [listening, setListening] = useState(false);
  const [visionWarning, setVisionWarning] = useState<string | null>(null);
  const [approvalHint, setApprovalHint] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const canSend = text.trim().length > 0 || attachments.length > 0;
  const effectiveBusy = busy && !approvalPending;

  useEffect(() => {
    if (visionSupported) setVisionWarning(null);
  }, [visionSupported]);

  useEffect(() => {
    if (!approvalPending) setApprovalHint(null);
  }, [approvalPending]);

  const syncHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = window.matchMedia && window.matchMedia("(max-width: 640px)").matches ? 132 : 200;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  };

  useEffect(() => {
    syncHeight();
  }, [text]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const toggleListening = () => {
    if (listening) {
      stopListening();
      return;
    }
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alternative = e.results.item(i).item(0);
        if (alternative) transcript += alternative.transcript;
      }
      if (transcript) {
        setText((prev) => {
          const base = prev.replace(/\s+$/, "");
          return base ? `${base} ${transcript.trim()}` : transcript.trim();
        });
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const resetComposer = () => {
    setText("");
    setAttachments([]);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = "40px";
    }
  };

  const handleSend = () => {
    if (!canSend) return;
    if (disabled || effectiveBusy) return;
    if (approvalPending && onApprovalReply) {
      const result = onApprovalReply(text.trim());
      if (result === "ambiguous") {
        setApprovalHint(
          "I couldn't tell if that was a yes or a no — try 'yes', 'no', or something like 'skip the delete'."
        );
        return;
      }
      setApprovalHint(null);
      resetComposer();
      return;
    }
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
    const images = files.filter((f) => f.type.startsWith("image/"));
    const allowed = visionSupported ? files : files.filter((f) => !f.type.startsWith("image/"));
    if (images.length > 0 && !visionSupported) {
      setVisionWarning(
        "This model doesn't support images — switch to a vision model in Parameters to attach them."
      );
    } else if (images.length > 0) {
      setVisionWarning(null);
    }
    allowed.forEach((file) => {
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
      className="shrink-0 border-t border-zinc-800 px-2 pb-2 pt-1.5 sm:px-4 sm:pb-3 sm:pt-2"
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
        {visionWarning && (
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
            <span className="min-w-0 flex-1">{visionWarning}</span>
            <button
              type="button"
              onClick={() => setVisionWarning(null)}
              aria-label="Dismiss warning"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
            >
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        {approvalHint && (
          <div className="flex items-start gap-1.5 border-b border-zinc-800 px-3 py-1.5 text-[11px] leading-relaxed text-sky-400/90">
            <span>{approvalHint}</span>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          placeholder={
            approvalPending
              ? "Type your answer — e.g. 'yes', 'no', 'skip the delete'"
              : "Ask anything…"
          }
          className="block w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none sm:pt-3"
          style={{ minHeight: 40, maxHeight: 200, overflowY: "auto" }}
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
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              title={listening ? "Stop dictation" : "Dictate with microphone"}
              aria-label={listening ? "Stop dictation" : "Dictate with microphone"}
              aria-pressed={listening}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                listening
                  ? "bg-red-500/20 text-red-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 10a2 2 0 0 0 2-2V4a2 2 0 0 0-4 0v4a2 2 0 0 0 2 2Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path d="M4.5 7.5a3.5 3.5 0 0 0 7 0M8 11v3M6 14h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {modelLabel && (
            <button
              type="button"
              onClick={onOpenParameters}
              title={modelLabel}
              className="flex h-7 max-w-44 shrink-0 items-center gap-1.5 truncate rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-400 transition-colors hover:border-sky-600 hover:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                <path d="M6 13.5 13.5 6a2.1 2.1 0 0 0-3-3L3 10.5 2 14l3.5-1ZM10 3.5 12.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="truncate">{modelLabel}</span>
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || disabled || effectiveBusy}
            aria-label="Send message"
            title={approvalPending ? "Send your answer (Enter)" : busy ? "Waiting for reply…" : "Send (Enter)"}
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
