import { useCallback } from "react";
import { usePersistentState } from "./usePersistentState";

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: string;
  status: "running" | "done" | "error" | "approval" | "rejected" | "blocked";
  result?: string;
  oldContent?: string;
  newContent?: string;
  autoApproved?: boolean;
}

export type ChatToolCallPartial = Partial<
  Pick<ChatToolCall, "status" | "result" | "oldContent" | "newContent" | "autoApproved">
>;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments: ChatAttachment[];
  createdAt: number;
  toolCalls?: ChatToolCall[];
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

  const setAssistantToolCalls = useCallback(
    (id: string, calls: ChatToolCall[]) => {
      updateProject((list) =>
        list.map((m) => (m.id === id && m.role === "assistant" ? { ...m, toolCalls: calls } : m))
      );
    },
    [updateProject]
  );

  const patchAssistantToolCall = useCallback(
    (id: string, callId: string, patch: ChatToolCallPartial) => {
      updateProject((list) =>
        list.map((m) =>
          m.id === id && m.role === "assistant"
            ? {
                ...m,
                toolCalls: (m.toolCalls ?? []).map((c) =>
                  c.id === callId ? { ...c, ...patch } : c
                ),
              }
            : m
        )
      );
    },
    [updateProject]
  );

  return {
    messages,
    send,
    appendAssistant,
    patchAssistant,
    removeAssistant,
    setAssistantToolCalls,
    patchAssistantToolCall,
  };
}