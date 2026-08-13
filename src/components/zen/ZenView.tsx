import { useEffect, useRef } from "react";
import PreviewCanvas from "../preview/PreviewCanvas";

interface ZenViewProps {
  onExit: () => void;
  srcDoc?: string | null;
  busy?: boolean;
}

export default function ZenView({ onExit, srcDoc = null, busy = false }: ZenViewProps) {
  const exitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    exitRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <button
        ref={exitRef}
        type="button"
        onClick={onExit}
        className="absolute right-3 top-3 z-10 flex h-8 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5V6M10 2h2.5A1.5 1.5 0 0 1 14 3.5V6M6 14H3.5A1.5 1.5 0 0 1 2 12.5V10M10 14h2.5a1.5 1.5 0 0 0 1.5-1.5V10"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        Exit zen
      </button>
      <div className="flex flex-1 flex-col overflow-auto">
        <PreviewCanvas srcDoc={srcDoc} busy={busy} />
      </div>
    </div>
  );
}
