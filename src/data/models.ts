export interface Model {
  id: string;
  name: string;
  provider: string;
  isFree: boolean;
  contextLength: number;
  promptPrice: number;
  completionPrice: number;
  inputModalities: string[];
  outputModalities: string[];
}

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
  pricing: {
    prompt?: string;
    completion?: string;
  };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

function toNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDisplayProvider(id: string): string {
  const slug = id.split("/")[0].replace(/^[^a-zA-Z0-9]+/, "");
  if (!slug) return "Other";
  return slug
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeModel(raw: OpenRouterModel): Model {
  const promptPrice = toNumber(raw.pricing.prompt);
  const completionPrice = toNumber(raw.pricing.completion);
  return {
    id: raw.id,
    name: raw.name,
    provider: toDisplayProvider(raw.id),
    isFree: promptPrice === 0 && completionPrice === 0,
    contextLength: raw.context_length ?? 0,
    promptPrice,
    completionPrice,
    inputModalities: raw.architecture?.input_modalities ?? [],
    outputModalities: raw.architecture?.output_modalities ?? [],
  };
}

export function sortModels(models: Model[]): Model[] {
  return [...models].sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    if (b.contextLength !== a.contextLength) return b.contextLength - a.contextLength;
    return a.name.localeCompare(b.name);
  });
}

export function supportsVision(model: Model): boolean {
  return model.inputModalities.length === 0 || model.inputModalities.includes("image");
}

export function describeModalities(model: Model): string {
  const input = model.inputModalities.length > 0 ? model.inputModalities.join(", ") : "text";
  const output = model.outputModalities.length > 0 ? model.outputModalities.join(", ") : "text";
  const lines = [
    `Input: ${input}`,
    `Output: ${output}`,
    `Context: ${model.contextLength.toLocaleString()} tokens`,
  ];
  if (model.isFree) {
    lines.push("Free");
  } else {
    const perMillion = (n: number) => `$${(n * 1_000_000).toFixed(2)}/M`;
    lines.push(`${perMillion(model.promptPrice)} in · ${perMillion(model.completionPrice)} out`);
  }
  return lines.join("\n");
}