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

  return { mode: state.mode, setMode };
}

export type Guardrails = ReturnType<typeof useGuardrails>;
