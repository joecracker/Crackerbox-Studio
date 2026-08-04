import { useMemo } from "react";
import type { PendingEdit } from "../../hooks/useEdits";
import { diffLines, diffStat } from "../../utils/diff";

interface DiffViewProps {
  edit: PendingEdit;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

const ROW_CLASSES: Record<string, string> = {
  eq: "text-zinc-400",
  add: "bg-emerald-500/15 text-emerald-300",
  del: "bg-red-500/15 text-red-300",
};

const MARKER_CLASSES: Record<string, string> = {
  eq: "text-zinc-600",
  add: "text-emerald-400",
  del: "text-red-400",
};

export default function DiffView({ edit, onApprove, onReject, onClose }: DiffViewProps) {
  const lines = useMemo(() => diffLines(edit.oldContent, edit.newContent), [edit]);
  const { added, removed } = useMemo(() => diffStat(lines), [lines]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="truncate text-xs font-medium text-zinc-300">{edit.path}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-emerald-400">+{added}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-red-400">-{removed}</span>
        <span className="ml-auto shrink-0 text-[11px] text-zinc-500">reviewing proposed change</span>
        <button
          type="button"
          onClick={onReject}
          className="shrink-0 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onApprove}
          className="shrink-0 rounded border border-emerald-700 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close file preview"
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="w-max min-w-full font-mono text-[12px] leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className={`flex ${ROW_CLASSES[line.type]}`}>
              <span
                className={`w-4 shrink-0 select-none text-center ${MARKER_CLASSES[line.type]}`}
              >
                {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
              </span>
              <span className="w-8 shrink-0 select-none pr-1 text-right text-zinc-600">
                {line.oldNo ?? ""}
              </span>
              <span className="w-8 shrink-0 select-none pr-1 text-right text-zinc-600">
                {line.newNo ?? ""}
              </span>
              <span className="whitespace-pre px-1">{line.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
