import { useState } from "react";
import type { ChatSession } from "../../hooks/useChatHistory";
import { sessionTokenCount } from "../../hooks/useChatHistory";

interface SessionSwitcherProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SessionSwitcher({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SessionSwitcherProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5">
      {sessions.map((s) => {
        const active = s.id === activeSessionId;
        const tokens = sessionTokenCount(s);
        const menuOpen = menuFor === s.id;
        return (
          <div key={s.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              title={s.summary ? `Summarized session — ${s.title}` : s.title}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                active
                  ? "border-sky-600 bg-sky-500/10 text-sky-300"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <span className="max-w-40 truncate font-medium">{s.title}</span>
              {s.summary && (
                <span
                  className="rounded-sm bg-violet-500/15 px-1 py-px text-[9px] font-medium text-violet-400"
                  title="This session has been summarized into a fresh chat"
                >
                  archive
                </span>
              )}
              {tokens > 0 && <span className="shrink-0 text-[10px] text-zinc-500">{tokens.toLocaleString()} tok</span>}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(menuOpen ? null : s.id);
              }}
              aria-label={`Session options for ${s.title}`}
              title="Session options"
              className={`ml-0.5 rounded-md border px-1 py-1 text-[10px] transition-colors ${
                menuOpen
                  ? "border-sky-600 text-sky-300"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="3.5" r="1.2" fill="currentColor" />
                <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                <circle cx="8" cy="12.5" r="1.2" fill="currentColor" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(null);
                  }}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuFor(null);
                      onRename(s.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-200 transition-colors hover:bg-zinc-800"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuFor(null);
                      onDelete(s.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-red-400 transition-colors hover:bg-zinc-800"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onCreate}
        className="flex shrink-0 items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-sky-600 hover:text-sky-300"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        New chat
      </button>
    </div>
  );
}
