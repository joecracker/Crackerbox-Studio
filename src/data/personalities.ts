export interface TonePreset {
  id: string;
  label: string;
  description: string;
  snippet: string;
}

export interface VerbosityPreset {
  id: string;
  label: string;
  description: string;
  snippet: string;
}

export const TONE_PRESETS: TonePreset[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Polished, precise, well-structured",
    snippet:
      "Communicate with a professional, polished tone. Prefer precise, well-structured responses and avoid slang.",
  },
  {
    id: "friendly",
    label: "Friendly",
    description: "Warm and approachable",
    snippet:
      "Communicate in a warm, approachable tone. Be encouraging and conversational while staying clear and on-topic.",
  },
  {
    id: "concise",
    label: "Concise",
    description: "To the point, no filler",
    snippet: "Be direct and to the point. Skip fluff, pleasantries, and filler.",
  },
  {
    id: "playful",
    label: "Playful",
    description: "Light, witty, with personality",
    snippet:
      "Communicate with a light, playful tone. Use wit and personality, but keep responses useful and correct.",
  },
  {
    id: "direct",
    label: "Direct",
    description: "Blunt and unambiguous",
    snippet:
      "Be blunt and unambiguous. State findings and recommendations plainly without hedging.",
  },
];

export const VERBOSITY_LEVELS: VerbosityPreset[] = [
  {
    id: "concise",
    label: "Concise",
    description: "Short and minimal",
    snippet:
      "Keep responses brief. Use short paragraphs, bullets, and minimal explanation unless asked for details.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Complete without padding",
    snippet:
      "Match response length to the task — enough detail to be complete, without padding.",
  },
  {
    id: "detailed",
    label: "Detailed",
    description: "Thorough with trade-offs",
    snippet:
      "Prefer thorough responses. Include context, trade-offs, and step-by-step explanations where helpful.",
  },
];

export function findTone(id: string): TonePreset | undefined {
  return TONE_PRESETS.find((t) => t.id === id);
}

export function findVerbosity(id: string): VerbosityPreset | undefined {
  return VERBOSITY_LEVELS.find((v) => v.id === id);
}
