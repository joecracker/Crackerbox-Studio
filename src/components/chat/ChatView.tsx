import type { ChatMessage } from "../../hooks/useChatHistory";
import Composer from "./Composer";
import MessageList from "./MessageList";

interface ChatViewProps {
  projectName: string;
  messages: ChatMessage[];
  onSend: (text: string, attachments: ChatMessage["attachments"]) => void;
  onOpenParameters: () => void;
}

export default function ChatView({
  projectName,
  messages,
  onSend,
  onOpenParameters,
}: ChatViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="truncate text-xs font-medium text-zinc-300">{projectName}</span>
        <span className="ml-auto shrink-0 text-[11px] text-zinc-600">chat</span>
      </div>
      <MessageList messages={messages} />
      <Composer onSend={onSend} onOpenParameters={onOpenParameters} />
    </div>
  );
}
