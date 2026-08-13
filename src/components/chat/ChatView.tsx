import type { ChatMessage } from "../../hooks/useChatHistory";
import Composer from "./Composer";
import MessageList from "./MessageList";

interface ChatViewProps {
  projectName: string;
  messages: ChatMessage[];
  onSend: (text: string, attachments: ChatMessage["attachments"]) => void;
  onOpenParameters: () => void;
  streaming: boolean;
  sendDisabled: boolean;
  sendDisabledReason: string | null;
  streamError: string | null;
  onDismissStreamError: () => void;
}

export default function ChatView({
  projectName,
  messages,
  onSend,
  onOpenParameters,
  streaming,
  sendDisabled,
  sendDisabledReason,
  streamError,
  onDismissStreamError,
}: ChatViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="truncate text-xs font-medium text-zinc-300">{projectName}</span>
        <span className="ml-auto shrink-0 text-[11px] text-zinc-600">chat</span>
      </div>
      <MessageList messages={messages} streaming={streaming} />
      {streamError && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2">
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-red-400"
          >
            <path
              d="M8 1.8 15 13.8H1L8 1.8Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M8 6v3M8 11.2v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-red-300">
            {streamError}
          </p>
          <button
            type="button"
            onClick={onDismissStreamError}
            aria-label="Dismiss error"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
      <Composer
        onSend={onSend}
        onOpenParameters={onOpenParameters}
        disabled={sendDisabled}
        disabledReason={sendDisabledReason}
        busy={streaming}
      />
    </div>
  );
}