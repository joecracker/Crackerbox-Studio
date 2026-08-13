import { useMemo } from "react";
import type { PendingApproval } from "../../hooks/useChatStream";
import { diffLines, diffStat } from "../../utils/diff";

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

interface ApprovalCardProps {
  approval: PendingApproval;
  onApprove: () => void;
  onReject: () => void;
}

export default function ApprovalCard({ approval, onApprove, onReject }: ApprovalCardProps) {
  const isDelete = approval.name === "delete_file";
  const lines = useMemo(
    () => diffLines(approval.oldContent, approval.newContent),
    [approval.oldContent, approval.newContent]
  );
  const { added, removed } = useMemo(() => diffStat(lines), [lines]);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/80">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isDelete ? "bg-red-500/15 text-red-300" : "bg-sky-500/15 text-sky-300"
          }`}
        >
          {isDelete ? "Delete" : "Write"}
        </span>
        <code className="truncate font-mono text-[11px] text-zinc-200">{approval.path}</code>
        <span className="shrink-0 text-[11px] tabular-nums text-emerald-400">+{added}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-red-400">-{removed}</span>
      </div>
      {approval.rationale.trim() && (
        <p className="border-b border-zinc-800/70 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
          {approval.rationale}
        </p>
      )}
      <div className="max-h-56 overflow-y-auto px-3 py-2">
        <code className="block w-max min-w-full font-mono text-[11px] leading-relaxed">
          {lines.map((line, i) => (
            <span key={i} className={`flex ${ROW_CLASSES[line.type]}`}>
              <span className={`w-4 shrink-0 select-none text-center ${MARKER_CLASSES[line.type]}`}>
                {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
              </span>
              <span className="w-7 shrink-0 select-none pr-1 text-right text-zinc-600">
                {line.oldNo ?? ""}
              </span>
              <span className="w-7 shrink-0 select-none pr-1 text-right text-zinc-600">
                {line.newNo ?? ""}
              </span>
              <span className="whitespace-pre px-1">{line.text}</span>
            </span>
          ))}
        </code>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <button
          type="button"
          onClick={onReject}
          className="rounded border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onApprove}
          className="rounded border border-emerald-700 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Approve
        </button>
      </div>
    </div>
  );
}
