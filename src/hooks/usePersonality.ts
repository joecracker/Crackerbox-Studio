import { useEffect } from "react";
import { usePersistentState } from "./usePersistentState";
import { findTone, findVerbosity } from "../data/personalities";

export interface PersonalityState {
  tone: string;
  verbosity: string;
  customInstructions: string;
}

const PERSONALITY_KEY = "crackerbox.personality";
const CONCISE_HINT = "When you find or report multiple items";
const DEFAULT_PERSONALITY: PersonalityState = {
  tone: "friendly",
  verbosity: "concise",
  customInstructions:
    "You are working with a creative director, not a professional coder. " +
    "Explain everything in plain, simple language — avoid jargon. " +
    "Work one step at a time and wait for approval before moving to the next step. " +
    "Before making any change that could be risky or hard to undo, explain what you are about to do first. " +
    "When you find or report multiple items (issues, matches, files, results), give each one a short " +
    "one-line summary with its name and only the key detail — do not write paragraphs per item. " +
    "Only go into detail on a single item when the user asks about it specifically.",
};

const DEFAULT_BASE = "You are a helpful assistant.";

export function usePersonality() {
  const [personality, setPersonality] = usePersistentState<PersonalityState>(
    PERSONALITY_KEY,
    DEFAULT_PERSONALITY
  );

  // One-time migration: apply the new built-in conciseness to settings saved
  // before it existed (older saved settings kept "balanced" verbosity and had
  // no concise-report instruction). Only touches the stored value once.
  useEffect(() => {
    setPersonality((prev) => {
      if (prev.customInstructions.includes(CONCISE_HINT)) return prev;
      const migrationLine =
        "When you find or report multiple items (issues, matches, files, results), give each one a short one-line summary with its name and only the key detail — do not write paragraphs per item. Only go into detail on a single item when the user asks about it specifically.";
      return {
        tone: prev.tone,
        verbosity: prev.verbosity === "detailed" ? prev.verbosity : "concise",
        customInstructions: `${prev.customInstructions.trim()}\n${migrationLine}`.trim(),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPersonality]);

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
