import { useState } from "react";

export function useParameters() {
  const [selectedModelId, setSelectedModelId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [freeOnly, setFreeOnly] = useState(false);

  return {
    selectedModelId,
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
