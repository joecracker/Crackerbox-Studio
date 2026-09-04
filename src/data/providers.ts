// Model providers Cracker Box can talk to. Each provider is an OpenAI-compatible
// chat-completions gateway keyed by a vault token service.

export type ProviderId = "openrouter" | "opencode" | "google";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  tokenService: "openrouter" | "opencode" | "google";
  baseUrl: string;
  modelsUrl: string;
  chatUrl: string;
  creditsUrl: string | null;
  help: string;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    keyLabel: "OpenRouter API key (chat)",
    keyPlaceholder: "sk-or-v1-…",
    tokenService: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    chatUrl: "https://openrouter.ai/api/v1/chat/completions",
    creditsUrl: "https://openrouter.ai/api/v1/credits",
    help: "The OpenRouter key powers chat. Pick any model across many providers.",
  },
  opencode: {
    id: "opencode",
    label: "OpenCode Zen",
    keyLabel: "OpenCode Zen API key (chat)",
    keyPlaceholder: "oc-…",
    tokenService: "opencode",
    baseUrl: "https://opencode.ai/zen/v1",
    modelsUrl: "https://opencode.ai/zen/v1/models",
    chatUrl: "https://opencode.ai/zen/v1/chat/completions",
    creditsUrl: "https://opencode.ai/zen/v1/credits",
    help: "OpenCode Zen's tested models, including free models like Big Pickle and Muse Spark Contributor. Get a key at opencode.ai/auth.",
  },
  google: {
    id: "google",
    label: "Google AI Studio",
    keyLabel: "Google AI Studio API key (chat)",
    keyPlaceholder: "AIza…",
    tokenService: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelsUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    chatUrl: "https://generativelanguage.googleapis.com/v1beta/chat/completions",
    creditsUrl: null,
    help: "Google's Gemini models through the OpenAI-compatible chat-completions endpoint on Google AI Studio. Get a key at aistudio.google.com.",
  },
};

export const PROVIDER_LIST: ProviderConfig[] = [
  PROVIDERS.openrouter,
  PROVIDERS.opencode,
  PROVIDERS.google,
];

export function providerConfig(id: ProviderId | string | null | undefined): ProviderConfig {
  if (id && id in PROVIDERS) return PROVIDERS[id as ProviderId];
  return PROVIDERS.openrouter;
}