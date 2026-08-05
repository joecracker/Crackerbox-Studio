import { useCallback } from "react";
import { usePersistentState } from "./usePersistentState";

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments: ChatAttachment[];
  createdAt: number;
}

const CHAT_KEY = "crackerbox.chat";

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useChatHistory(activeProjectId: string) {
  const [byProject, setByProject] = usePersistentState<Record<string, ChatMessage[]>>(
    CHAT_KEY,
    {}
  );

  const messages = byProject[activeProjectId] ?? [];

  const send = useCallback(
    (text: string, attachments: ChatAttachment[]) => {
      const message: ChatMessage = {
        id: createId(),
        role: "user",
        text,
        attachments,
        createdAt: Date.now(),
      };
      setByProject((prev) => ({
        ...prev,
        [activeProjectId]: [...(prev[activeProjectId] ?? []), message],
      }));
    },
    [activeProjectId, setByProject]
  );

  return { messages, send };
}
