import type { Guardrails } from "../../hooks/useGuardrails";
import type { GuardrailMode } from "../../utils/approvalPolicy";

interface GuardrailSettingsProps {
  guardrails: Guardrails;
}

const MODES: Array<{ id: GuardrailMode; label: string; description: string }> = [
  {
    id: "tiered",
    label: "Tiered guardrails",
    description:
      "File edits you explicitly asked for apply immediately, and tiny safe edits (4 lines or fewer, never config or dependency files) also apply instantly with the diff shown. Deletes, commands, package installs, new files, and bigger changes still require approval.",
  },
  {
    id: "all",
    label: "Approve everything",
    description:
      "Every write_file, delete_file, run_command, and install_package asks for your approval before it runs. The classic, safest behavior.",
  },
];

export default function GuardrailSettings({ guardrails }: GuardrailSettingsProps) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Guardrails
      </p>
      <p className="mb-3 text-xs leading-relaxed text-zinc-400">
        Which actions require your approval before they touch your project files.
      </p>
      <div className="flex flex-col gap-1.5">
        {MODES.map((m) => {
          const selected = guardrails.mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => guardrails.setMode(m.id)}
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
                {m.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">
                {m.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}