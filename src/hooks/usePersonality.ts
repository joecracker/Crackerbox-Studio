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
    "Complete the whole task you accept — work through it step by step without stopping " +
    "to ask permission; the app handles approvals automatically. " +
    "Before making any change that could be risky or hard to undo, briefly explain what you are about to do. " +
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

  // One-time migrations: (1) remove the old "wait for approval" directive that
  // made models stop after every step, and (2) apply built-in conciseness. Both
  // only touch the stored value once. Diagnosed: "wait for approval before
  // moving to the next step" froze agents in circles for hours despite auto mode.
  useEffect(() => {
    setPersonality((prev) => {
      const hadApprovalDirective = /wait for approval|before moving to the next step/i.test(
        prev.customInstructions
      );
      let text = prev.customInstructions
        .replace(/work one step at a time and wait for approval before moving to the next step\.?/gi, "")
        .replace(/wait for approval[^.\n]*\.?/gi, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (hadApprovalDirective) {
        text = `${text ? `${text}\n\n` : ""}Complete the whole task you accept — work through it step by step without stopping to ask permission; the app handles approvals automatically.`.trim();
      }
      const hasConcise = text.includes(CONCISE_HINT);
      if (!hasConcise) {
        const migrationLine =
          "When you find or report multiple items (issues, matches, files, results), give each one a short one-line summary with its name and only the key detail — do not write paragraphs per item. Only go into detail on a single item when the user asks about it specifically.";
        text = `${text ? `${text}\n` : ""}${migrationLine}`.trim();
      }
      if (text === prev.customInstructions) return prev;
      return {
        tone: prev.tone,
        verbosity: prev.verbosity === "detailed" ? prev.verbosity : "concise",
        customInstructions: text,
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
