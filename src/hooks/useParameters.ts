import { useState } from "react";
import { usePersistentState } from "./usePersistentState";
import type { ProviderId } from "../data/providers";

const MODEL_KEY = "crackerbox.parameters.model";
const PROVIDER_KEY = "crackerbox.parameters.provider";

export function useParameters() {
  const [selected, setSelected] = usePersistentState<{ value: string }>(MODEL_KEY, {
    value: "",
  });
  const [provider, setProvider] = usePersistentState<{ value: ProviderId }>(PROVIDER_KEY, {
    value: "openrouter",
  });
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [freeOnly, setFreeOnly] = useState(false);

  const setSelectedModelId = (id: string) => setSelected({ value: id });

  return {
    selectedModelId: selected.value,
    setSelectedModelId,
    providerId: provider.value,
    setProviderId: (id: ProviderId) => {
      setProvider({ value: id });
      setSelected({ value: "" });
    },
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