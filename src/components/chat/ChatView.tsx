import type { ChatMessage } from "../../hooks/useChatHistory";
import type { PendingApproval } from "../../hooks/useChatStream";
import Composer from "./Composer";
import MessageList from "./MessageList";
import ApprovalCard from "./ApprovalCard";

interface ChatViewProps {
  projectName: string;
  messages: ChatMessage[];
  activeSessionId: string | null;
  onCreateSession: () => void;
  onSend: (text: string, attachments: ChatMessage["attachments"]) => void;
  onOpenParameters: () => void;
  streaming: boolean;
  sendDisabled: boolean;
  sendDisabledReason: string | null;
  streamError: string | null;
  onDismissStreamError: () => void;
  modelLabel: string | null;
  visionSupported: boolean;
  approval: PendingApproval | null;
  onApprove: () => void;
  onReject: () => void;
  onApprovalReply: (text: string) => "resolved" | "ambiguous";
  onStop?: () => void;
  runtimeAvailable: boolean;
  runtimeError: string | null;
}

export default function ChatView({
  projectName,
  messages,
  activeSessionId,
  onCreateSession,
  onSend,
  onOpenParameters,
  streaming,
  sendDisabled,
  sendDisabledReason,
  streamError,
  onDismissStreamError,
  modelLabel,
  visionSupported,
  approval,
  onApprove,
  onReject,
  onApprovalReply,
  onStop,
  runtimeAvailable,
  runtimeError,
}: ChatViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="truncate text-xs font-medium text-zinc-300">{projectName}</span>
        <span className="ml-auto truncate text-[11px] text-zinc-600">chat</span>
        <button
          type="button"
          onClick={onCreateSession}
          title="Start a new chat"
          className="flex shrink-0 items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-sky-600 hover:text-sky-300"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New chat
        </button>
      </div>
      <MessageList key={activeSessionId ?? "session"} messages={messages} streaming={streaming} />
      {!runtimeAvailable && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2">
          <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-300">
            File writes are disabled in this browser — WebContainers isn&apos;t available here.
            {runtimeError ? ` ${runtimeError}` : ""}
          </p>
        </div>
      )}
      {approval && (
        <div className="mx-4 mb-2 shrink-0">
          <ApprovalCard approval={approval} onApprove={onApprove} onReject={onReject} />
        </div>
      )}
      {streamError && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-2">
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-amber-400"
          >
            <path
              d="M8 1.8 15 13.8H1L8 1.8Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M8 6v3M8 11.2v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-200/90">
            {streamError}
          </p>
          <button
            type="button"
            onClick={onDismissStreamError}
            aria-label="Dismiss error"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-amber-400/60 transition-colors hover:bg-zinc-700/60 hover:text-amber-200"
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
        modelLabel={modelLabel}
        visionSupported={visionSupported}
        approvalPending={approval !== null}
        onApprovalReply={onApprovalReply}
        onStop={onStop}
      />
    </div>
  );
}