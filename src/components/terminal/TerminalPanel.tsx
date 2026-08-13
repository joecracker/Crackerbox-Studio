import { useEffect, useRef, useState } from "react";
import type { DemoFile } from "../../data/demoFiles";
import { runCommand } from "../../utils/terminal";

interface TerminalLine {
  id: number;
  kind: "banner" | "input" | "output" | "error";
  text: string;
}

interface TerminalPanelProps {
  projectName: string;
  files: DemoFile[];
  height: number;
  onHeightChange: (height: number) => void;
  onClose: () => void;
}

const BANNER: TerminalLine[] = [
  { id: 1, kind: "banner", text: "Cracker Box terminal" },
  { id: 2, kind: "banner", text: "Client-side shell — works on this project's virtual file tree." },
  { id: 3, kind: "banner", text: 'Type "help" for commands, or Ctrl+L to clear.' },
];

let nextLineId = 100;

export default function TerminalPanel({
  projectName,
  files,
  height,
  onHeightChange,
  onClose,
}: TerminalPanelProps) {
  const [lines, setLines] = useState<TerminalLine[]>(BANNER);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const push = (line: Omit<TerminalLine, "id">) => {
    setLines((prev) => [...prev, { ...line, id: ++nextLineId }]);
  };

  const clearTerminal = () => {
    setLines(BANNER);
  };

  const submit = () => {
    const value = input.trim();
    setInput("");
    setHistoryIndex(null);
    if (!value) return;

    setHistory((prev) => [...prev, value]);
    push({ kind: "input", text: `$ ${value}` });

    const lower = value.toLowerCase();
    if (lower === "clear") {
      clearTerminal();
      return;
    }
    if (lower === "history") {
      const hist = historyRef.current;
      if (hist.length === 0) push({ kind: "output", text: "no commands yet" });
      else hist.forEach((c) => push({ kind: "output", text: `  ${c}` }));
      return;
    }

    const result = runCommand(value, { projectName, files });
    if (result.lines.length === 0) return;
    result.lines.forEach((text) =>
      push({ kind: result.error ? "error" : "output", text })
    );
  };

  const navigate = (dir: -1 | 1) => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    if (historyIndex === null) {
      const i = dir === -1 ? hist.length - 1 : 0;
      setHistoryIndex(i);
      setInput(hist[i]);
      return;
    }
    const next = historyIndex + dir;
    if (next < 0 || next >= hist.length) {
      setHistoryIndex(null);
      setInput("");
      return;
    }
    setHistoryIndex(next);
    setInput(hist[next]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigate(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navigate(1);
    } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      clearTerminal();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInput("");
      setHistoryIndex(null);
    }
  };

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;
    const onMove = (ev: PointerEvent) => {
      const next = startHeight + (startY - ev.clientY);
      onHeightChange(Math.max(120, Math.min(600, Math.round(next))));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <section
      aria-label="Terminal"
      className="flex shrink-0 flex-col border-t border-zinc-800 bg-zinc-950"
      style={{ height }}
      onClick={() => inputRef.current?.focus()}
    >
      <div
        onPointerDown={startResize}
        role="separator"
        aria-label="Resize terminal"
        title="Drag to resize"
        className="h-1.5 shrink-0 cursor-row-resize touch-none border-b border-zinc-900 bg-zinc-800/40 transition-colors hover:bg-sky-600/50"
      />
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Terminal
        </span>
        <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
          client-side
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close terminal"
          title="Close terminal (Ctrl+`)"
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div
        ref={outputRef}
        data-native-context-menu=""
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed"
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={
              line.kind === "input"
                ? "text-zinc-100"
                : line.kind === "error"
                  ? "text-red-400"
                  : line.kind === "banner"
                    ? "text-sky-400/80"
                    : "text-zinc-400"
            }
          >
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-zinc-800 px-3 py-1.5 font-mono text-xs">
        <span className="select-none text-sky-400">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setHistoryIndex(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="type a command… (help)"
          autoComplete="off"
          spellCheck={false}
          aria-label="Terminal input"
          className="min-w-0 flex-1 bg-transparent text-zinc-100 caret-sky-400 outline-none placeholder:text-zinc-600"
        />
      </div>
    </section>
  );
}