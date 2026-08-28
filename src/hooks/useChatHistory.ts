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

export interface SessionUsage {
  prompt: number;
  completion: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  usage: SessionUsage;
  modelId: string | null;
  contextLength: number | null;
  summary: string | null;
}

export interface ProjectSessions {
  sessions: ChatSession[];
  activeSessionId: string | null;
}

type PersistedShape = Record<string, ProjectSessions>;

const CHAT_KEY = "crackerbox.chat";

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultSessionTitle(messages: ChatMessage[] = []): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser || !firstUser.text.trim()) return "New chat";
  const text = firstUser.text.trim().replace(/\s+/g, " ");
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export function sessionTokenCount(session: ChatSession): number {
  return (session.usage.prompt ?? 0) + (session.usage.completion ?? 0);
}

export function freshSession(messages: ChatMessage[] = []): ChatSession {
  return {
    id: createId(),
    title: defaultSessionTitle(messages),
    createdAt: messages[0]?.createdAt ?? Date.now(),
    messages,
    usage: { prompt: 0, completion: 0 },
    modelId: null,
    contextLength: null,
    summary: null,
  };
}

export function isProjectSessionsShape(value: unknown): value is ProjectSessions {
  if (typeof value !== "object" || value === null) return false;
  return Array.isArray((value as ProjectSessions).sessions);
}

export function migrateShape(value: unknown): PersistedShape {
  if (typeof value !== "object" || value === null) return {};
  const out: PersistedShape = {};
  for (const [projectId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (isProjectSessionsShape(raw)) {
      out[projectId] = raw;
    } else if (Array.isArray(raw)) {
      const messages = raw as ChatMessage[];
      const session = freshSession(messages);
      out[projectId] = { sessions: [session], activeSessionId: session.id };
    }
  }
  return out;
}

export function useChatHistory(activeProjectId: string) {
  const [rawByProject, setRawByProject] = usePersistentState<PersistedShape>(CHAT_KEY, {});

  const byProject = migrateShape(rawByProject) as PersistedShape;

  const project =
    byProject[activeProjectId] ??
    {
      sessions: [freshSession()],
      activeSessionId: null as string | null,
    } satisfies ProjectSessions;

  const setProject = useCallback(
    (updater: (project: ProjectSessions) => ProjectSessions) => {
      setRawByProject((prev) => {
        const migrated = migrateShape(prev) as PersistedShape;
        const current = updater(migrated[activeProjectId] ?? project);
        return { ...migrated, [activeProjectId]: current };
      });
    },
    [activeProjectId, project, setRawByProject]
  );

  const sessions = project.sessions;
  const activeSession =
    sessions.find((s) => s.id === project.activeSessionId) ?? sessions[0] ?? null;
  const messages = activeSession?.messages ?? [];

  const mutateSession = useCallback(
    (updater: (session: ChatSession) => ChatSession) => {
      setProject((p) => {
        const target = p.sessions.find((s) => s.id === p.activeSessionId) ?? p.sessions[0];
        if (!target) return p;
        return {
          ...p,
          sessions: p.sessions.map((s) => (s.id === target.id ? updater(s) : s)),
        };
      });
    },
    [setProject]
  );

  const updateProject = useCallback(
    (updater: (list: ChatMessage[]) => ChatMessage[]) => {
      mutateSession((s) => {
        const next = updater(s.messages);
        return {
          ...s,
          messages: next,
          title: s.title === "New chat" ? defaultSessionTitle(next) : s.title,
        };
      });
    },
    [mutateSession]
  );

  const createSession = useCallback(
    (title?: string): string => {
      const id = createId();
      setProject((p) => {
        const session: ChatSession = {
          id,
          title: title || "New chat",
          createdAt: Date.now(),
          messages: [],
          usage: { prompt: 0, completion: 0 },
          modelId: null,
          contextLength: null,
          summary: null,
        };
        return { ...p, sessions: [...p.sessions, session], activeSessionId: id };
      });
      return id;
    },
    [setProject]
  );

  const selectSession = useCallback(
    (id: string) => {
      setProject((p) => ({ ...p, activeSessionId: id }));
    },
    [setProject]
  );

  const renameSession = useCallback(
    (id: string, title: string) => {
      setProject((p) => ({
        ...p,
        sessions: p.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
      }));
    },
    [setProject]
  );

  const deleteSession = useCallback(
    (id: string) => {
      setProject((p) => {
        const remaining = p.sessions.filter((s) => s.id !== id);
        if (remaining.length === 0) {
          const fresh = freshSession();
          return { sessions: [fresh], activeSessionId: fresh.id };
        }
        const nextActive =
          p.activeSessionId === id ? remaining[remaining.length - 1].id : p.activeSessionId;
        return { sessions: remaining, activeSessionId: nextActive };
      });
    },
    [setProject]
  );

  const setSessionSummary = useCallback(
    (id: string, summary: string) => {
      setProject((p) => ({
        ...p,
        sessions: p.sessions.map((s) => (s.id === id ? { ...s, summary } : s)),
      }));
    },
    [setProject]
  );

  const setSessionModel = useCallback(
    (id: string, modelId: string, contextLength: number | null) => {
      setProject((p) => ({
        ...p,
        sessions: p.sessions.map((s) =>
          s.id === id ? { ...s, modelId, contextLength } : s
        ),
      }));
    },
    [setProject]
  );

  const addUsage = useCallback(
    (prompt: number, completion: number) => {
      mutateSession((s) => ({
        ...s,
        usage: {
          prompt: (s.usage.prompt ?? 0) + prompt,
          completion: (s.usage.completion ?? 0) + completion,
        },
      }));
    },
    [mutateSession]
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
    sessions,
    activeSession,
    activeSessionId: activeSession?.id ?? null,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    setSessionSummary,
    setSessionModel,
    addUsage,
    send,
    appendAssistant,
    patchAssistant,
    removeAssistant,
    setAssistantToolCalls,
    patchAssistantToolCall,
  };
}
