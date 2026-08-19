import { usePersistentState } from "./usePersistentState";
import { findTone, findVerbosity } from "../data/personalities";

export interface PersonalityState {
  tone: string;
  verbosity: string;
  customInstructions: string;
}

const PERSONALITY_KEY = "crackerbox.personality";
const DEFAULT_PERSONALITY: PersonalityState = {
  tone: "professional",
  verbosity: "balanced",
  customInstructions:
    "You are working with a creative director, not a professional coder. " +
    "Explain everything in plain, simple language — avoid jargon. " +
    "Work one step at a time and wait for approval before moving to the next step. " +
    "Before making any change that could be risky or hard to undo, explain what you are about to do first.",
};

const DEFAULT_BASE = "You are a helpful assistant.";

export function usePersonality() {
  const [personality, setPersonality] = usePersistentState<PersonalityState>(
    PERSONALITY_KEY,
    DEFAULT_PERSONALITY
  );

  const setTone = (tone: string) => setPersonality((prev) => ({ ...prev, tone }));
  const setVerbosity = (verbosity: string) => setPersonality((prev) => ({ ...prev, verbosity }));
  const setCustomInstructions = (customInstructions: string) =>
    setPersonality((prev) => ({ ...prev, customInstructions }));

  const composePrompt = (baseSystemPrompt: string): string => {
    const tone = findTone(personality.tone);
    const verbosity = findVerbosity(personality.verbosity);
    const parts: string[] = [baseSystemPrompt.trim() || DEFAULT_BASE];
    if (tone) parts.push(`${tone.label} tone: ${tone.snippet}`);
    if (verbosity) {
      parts.push(`Verbosity (${verbosity.label.toLowerCase()}): ${verbosity.snippet}`);
    }
    const instructions = personality.customInstructions.trim();
    if (instructions) parts.push(`User instructions:\n${instructions}`);
    return parts.join("\n\n");
  };

  return {
    ...personality,
    setTone,
    setVerbosity,
    setCustomInstructions,
    composePrompt,
  };
}

export type PersonalitySettings = ReturnType<typeof usePersonality>;
