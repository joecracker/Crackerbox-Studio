import { useState } from "react";
import { usePersistentState } from "./usePersistentState";

const MODEL_KEY = "crackerbox.parameters.model";

export function useParameters() {
  const [selected, setSelected] = usePersistentState<{ value: string }>(MODEL_KEY, {
    value: "",
  });
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [freeOnly, setFreeOnly] = useState(false);

  const setSelectedModelId = (id: string) => setSelected({ value: id });

  return {
    selectedModelId: selected.value,
    setSelectedModelId,
    systemPrompt,
    setSystemPrompt,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    freeOnly,
    setFreeOnly,
  };
}

export type ParametersState = ReturnType<typeof useParameters>;