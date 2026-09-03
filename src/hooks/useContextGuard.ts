import { useCallback, useMemo, useState } from "react";
import type { ChatSession } from "./useChatHistory";
import { sessionTokenCount } from "./useChatHistory";
import type { Model } from "../data/models";
import { summarizeConversation } from "../utils/summarize";

export const SOFT_THRESHOLD = 0.6;
export const HARD_THRESHOLD = 0.85;

interface HandoffOptions {
  session: ChatSession | null;
  projectName: string;
  models: Model[];
  currentModelId: string;
  apiKey: string | null;
  chatUrl: string;
  onSummarized: (sessionId: string, summary: string) => void;
  onCreateSession: (title?: string) => string;
  onSelectSession: (id: string) => void;
}

interface ContextGuardState {
  tokenCount: number;
  contextLength: number | null;
  percent: number | null;
  level: "ok" | "soft" | "hard" | "unknown";
  handingOff: boolean;
  handoffError: string | null;
  handoffModel: string | null;
  startHandoff: () => Promise<boolean>;
  clearHandoffError: () => void;
}

export function useContextGuard({
  session,
  projectName,
  models,
  currentModelId,
  apiKey,
  chatUrl,
  onSummarized,
  onCreateSession,
  onSelectSession,
}: HandoffOptions): ContextGuardState {
  const [handingOff, setHandingOff] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffModel, setHandoffModel] = useState<string | null>(null);

  const tokenCount = session ? sessionTokenCount(session) : 0;
  const contextLength = session?.contextLength ?? null;

  const percent = useMemo(() => {
    if (!contextLength || contextLength <= 0) return null;
    return tokenCount / contextLength;
  }, [tokenCount, contextLength]);

  const level: ContextGuardState["level"] = useMemo(() => {
    if (percent === null) return "unknown";
    if (percent >= HARD_THRESHOLD) return "hard";
    if (percent >= SOFT_THRESHOLD) return "soft";
    return "ok";
  }, [percent]);

  const startHandoff = useCallback(async (): Promise<boolean> => {
    if (!session || handingOff) return false;
    if (!apiKey) {
      setHandoffError("OpenRouter key required — unlock the vault in Deploy.");
      return false;
    }
    if (session.messages.length === 0) {
      setHandoffError("This session has no messages to summarize.");
      return false;
    }
    setHandingOff(true);
    setHandoffError(null);
    setHandoffModel(null);
    try {
      const result = await summarizeConversation({
        projectName,
        messages: session.messages,
        apiKey,
        chatUrl,
        models,
        currentModelId,
      });
      if (!result.ok || !result.summary) {
        setHandoffError(result.error ?? "Summarization failed.");
        setHandoffModel(result.model);
        return false;
      }
      onSummarized(session.id, result.summary);
      const newId = onCreateSession();
      onSelectSession(newId);
      setHandoffModel(result.model);
      return true;
    } catch (e) {
      setHandoffError(e instanceof Error ? e.message : "Handoff failed.");
      return false;
    } finally {
      setHandingOff(false);
    }
  }, [
    session,
    handingOff,
    apiKey,
    projectName,
    models,
    currentModelId,
    onSummarized,
    onCreateSession,
    onSelectSession,
  ]);

  const clearHandoffError = useCallback(() => setHandoffError(null), []);

  return {
    tokenCount,
    contextLength,
    percent,
    level,
    handingOff,
    handoffError,
    handoffModel,
    startHandoff,
    clearHandoffError,
  };
}