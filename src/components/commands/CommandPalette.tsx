import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteCommand {
  id: string;
  label: string;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  onClose: () => void;
  commands: PaletteCommand[];
}

export default function CommandPalette({ onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const runCommand = (command: PaletteCommand) => {
    command.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const command = results[selected];
      if (command) runCommand(command);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed inset-x-0 top-[20vh] mx-auto w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-zinc-500">
            <path
              d="M2 9.5L5.5 6 8 8.5 13 3.5M2.5 5.5h11M2.5 10.5h11"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command…"
            className="h-11 w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
        <ul ref={listRef} className="max-h-[40vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-zinc-500">No matching commands</li>
          ) : (
            results.map((command, i) => (
              <li key={command.id}>
                <button
                  type="button"
                  onClick={() => runCommand(command)}
                  onMouseEnter={() => setSelected(i)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${
                    i === selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300"
                  }`}
                >
                  <span>{command.label}</span>
                  {command.shortcut && (
                    <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {command.shortcut}
                    </kbd>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
