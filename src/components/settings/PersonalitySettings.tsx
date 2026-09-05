import { useState } from "react";
import { TONE_PRESETS, VERBOSITY_LEVELS } from "../../data/personalities";
import type { PersonalitySettings } from "../../hooks/usePersonality";

interface PersonalitySettingsProps {
  personality: PersonalitySettings;
  baseSystemPrompt: string;
}

export default function PersonalitySettings({
  personality,
  baseSystemPrompt,
}: PersonalitySettingsProps) {
  const {
    tone,
    verbosity,
    customInstructions,
    setTone,
    setVerbosity,
    setCustomInstructions,
    composePrompt,
  } = personality;
  const composed = composePrompt(baseSystemPrompt);
  const [copied, setCopied] = useState(false);

  const copyPrompt = () => {
    void navigator.clipboard.writeText(composed).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div>
      <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Settings
      </div>
      <div className="px-3 pb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Personality
        </p>
        <p className="mb-3 text-xs leading-relaxed text-zinc-400">
          How the assistant should sound and how much it should say. These compose into the system
          prompt used for generation.
        </p>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Tone
            </span>
            <span className="text-[11px] text-zinc-600">
              {TONE_PRESETS.find((t) => t.id === tone)?.label ?? "…"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {TONE_PRESETS.map((t) => {
              const selected = tone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  aria-pressed={selected}
                  className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                    selected
                      ? "border-sky-500 bg-sky-500/10"
                      : "border-zinc-800 bg-zinc-950 hover:bg-zinc-800/70"
                  }`}
                >
                  <span
                    className={`block text-xs font-medium ${
                      selected ? "text-sky-300" : "text-zinc-200"
                    }`}
                  >
                    {t.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">
                    {t.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Verbosity
            </span>
            <span className="text-[11px] text-zinc-600">
              {VERBOSITY_LEVELS.find((v) => v.id === verbosity)?.label ?? "…"}
            </span>
          </div>
          <div className="flex rounded-md border border-zinc-800 p-0.5">
            {VERBOSITY_LEVELS.map((v) => {
              const selected = verbosity === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVerbosity(v.id)}
                  aria-pressed={selected}
                  className={`flex-1 rounded px-2 py-1.5 text-xs transition-colors ${
                    selected
                      ? "bg-zinc-800 font-medium text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
            {VERBOSITY_LEVELS.find((v) => v.id === verbosity)?.description}
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="custom-instructions"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            Custom instructions
          </label>
          <textarea
            id="custom-instructions"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={4}
            placeholder="Anything the assistant should always keep in mind…"
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Effective system prompt
            </span>
            <button
              type="button"
              onClick={copyPrompt}
              className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950 p-2.5 text-[11px] leading-relaxed text-zinc-400">
            {composed}
          </pre>
        </div>
      </div>
    </div>
  );
}
