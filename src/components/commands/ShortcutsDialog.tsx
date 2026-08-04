import { useEffect, useRef } from "react";

export interface ShortcutItem {
  label: string;
  combo: string;
}

interface ShortcutsDialogProps {
  shortcuts: ShortcutItem[];
  onClose: () => void;
}

export default function ShortcutsDialog({ shortcuts, onClose }: ShortcutsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
      >
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <h2
            id="shortcuts-title"
            className="text-sm font-semibold uppercase tracking-wider text-zinc-300"
          >
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {shortcuts.map((s) => (
            <li key={s.combo} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm text-zinc-300">{s.label}</span>
              <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                {s.combo}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
