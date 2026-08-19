import { useMemo } from "react";
import type { PendingApproval } from "../../hooks/useChatStream";
import type { LintResult } from "../../utils/lint";
import { diffLines, diffStat } from "../../utils/diff";
import { checkCommandDenylist } from "../../utils/commandGuard";

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

const BADGE_STYLES: Record<PendingApproval["name"], string> = {
  write_file: "bg-sky-500/15 text-sky-300",
  delete_file: "bg-red-500/15 text-red-300",
  run_command: "bg-amber-500/15 text-amber-300",
  install_package: "bg-cyan-500/15 text-cyan-300",
  preview_start: "bg-violet-500/15 text-violet-300",
};

const BADGE_LABELS: Record<PendingApproval["name"], string> = {
  write_file: "Write",
  delete_file: "Delete",
  run_command: "Run",
  install_package: "Install",
  preview_start: "Preview",
};

function ApprovalDiff({ added, removed }: { added: number; removed: number }) {
  return (
    <>
      <span className="shrink-0 text-[11px] tabular-nums text-emerald-400">+{added}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-red-400">-{removed}</span>
    </>
  );
}

function LintSummary({ lint }: { lint: LintResult }) {
  if (!lint.ok) {
    return (
      <p className="border-b border-zinc-800/70 px-3 py-2 text-[11px] text-zinc-500">
        Lint check unavailable
      </p>
    );
  }
  const visible = lint.issues.slice(0, 5);
  return (
    <div className="border-b border-zinc-800/70 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px]">
        <span className={lint.errors > 0 ? "font-medium text-red-400" : "text-emerald-400"}>
          {lint.errors} error{lint.errors === 1 ? "" : "s"}
        </span>
        <span className="text-zinc-600">·</span>
        <span className={lint.warnings > 0 ? "text-amber-400" : "text-zinc-500"}>
          {lint.warnings} warning{lint.warnings === 1 ? "" : "s"}
        </span>
      </div>
      {visible.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {visible.map((issue, i) => (
            <li key={i} className="font-mono text-[11px] leading-snug">
              <span className={issue.severity === 2 ? "text-red-400" : "text-amber-400"}>
                {issue.severity === 2 ? "E" : "W"} {issue.line}:{issue.column}
              </span>{" "}
              <span className="text-zinc-300">{issue.message}</span>
              {issue.ruleId && <span className="text-zinc-600"> ({issue.ruleId})</span>}
            </li>
          ))}
        </ul>
      )}
      {lint.issues.length > 5 && (
        <p className="mt-1 text-[11px] text-zinc-600">…and {lint.issues.length - 5} more</p>
      )}
    </div>
  );
}

export default function ApprovalCard({ approval, onApprove, onReject }: ApprovalCardProps) {
  const isDiff = approval.name === "write_file" || approval.name === "delete_file";
  const lines = useMemo(
    () => (isDiff ? diffLines(approval.oldContent, approval.newContent) : []),
    [approval.oldContent, approval.newContent, isDiff]
  );
  const { added, removed } = useMemo(
    () => (isDiff ? diffStat(lines) : { added: 0, removed: 0 }),
    [lines, isDiff]
  );
  const denylist = useMemo(
    () => (approval.command ? checkCommandDenylist(approval.command) : { blocked: false, reason: "" }),
    [approval.command]
  );

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/80">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${BADGE_STYLES[approval.name]}`}
        >
          {BADGE_LABELS[approval.name]}
        </span>
        <code className="truncate font-mono text-[11px] text-zinc-200">{approval.path || approval.command}</code>
        {isDiff && <ApprovalDiff added={added} removed={removed} />}
      </div>
      {approval.rationale.trim() && (
        <p className="border-b border-zinc-800/70 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
          {approval.rationale}
        </p>
      )}
      {approval.name === "write_file" && approval.lint && <LintSummary lint={approval.lint} />}
      {isDiff ? (
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
      ) : (
        <div className="px-3 py-2">
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <code className="block whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-zinc-100">
              {approval.command}
            </code>
          </div>
          {denylist.blocked && (
            <p className="mt-2 text-[11px] leading-relaxed text-red-400">
              This command matches the safety denylist: {denylist.reason}. It will not be run.
            </p>
          )}
        </div>
      )}
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
