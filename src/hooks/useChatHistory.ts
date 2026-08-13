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

  const updateProject = useCallback(
    (updater: (list: ChatMessage[]) => ChatMessage[]) => {
      setByProject((prev) => ({
        ...prev,
        [activeProjectId]: updater(prev[activeProjectId] ?? []),
      }));
    },
    [activeProjectId, setByProject]
  );

  const send = useCallback(
    (text: string, attachments: ChatAttachment[]) => {
      const message: ChatMessage = {
        id: createId(),
        role: "user",
        text,
        attachments,
        createdAt: Date.now(),
      };
      updateProject((list) => [...list, message]);
    },
    [updateProject]
  );

  const appendAssistant = useCallback((): string => {
    const id = createId();
    updateProject((list) => [
      ...list,
      { id, role: "assistant", text: "", attachments: [], createdAt: Date.now() },
    ]);
    return id;
  }, [updateProject]);

  const patchAssistant = useCallback(
    (id: string, updater: (text: string) => string) => {
      updateProject((list) =>
        list.map((m) =>
          m.id === id && m.role === "assistant" ? { ...m, text: updater(m.text) } : m
        )
      );
    },
    [updateProject]
  );

  const removeAssistant = useCallback(
    (id: string) => {
      updateProject((list) => list.filter((m) => m.id !== id));
    },
    [updateProject]
  );

  return { messages, send, appendAssistant, patchAssistant, removeAssistant };
}