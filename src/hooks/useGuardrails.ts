import { useEffect } from "react";
import { usePersistentState } from "./usePersistentState";
import type { GuardrailMode } from "../utils/approvalPolicy";

const GUARDRAILS_KEY = "crackerbox.guardrails";

export interface GuardrailsState {
  mode: GuardrailMode;
}

export function useGuardrails() {
  const [state, setState] = usePersistentState<GuardrailsState>(GUARDRAILS_KEY, {
    mode: "auto",
  });

  const setMode = (mode: GuardrailMode) => setState((prev) => ({ ...prev, mode }));

  // One-time migration: older builds persisted "tiered" as the default. Nudge
  // saved settings to "auto" once so commands/file writes run with no prompts
  // (the user's intended behavior). The Settings UI can still change it.
  useEffect(() => {
    setState((prev) => {
      if (prev.mode !== "tiered") return prev;
      return { ...prev, mode: "auto" };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState]);

  return { mode: state.mode, setMode };
}

export type Guardrails = ReturnType<typeof useGuardrails>;
