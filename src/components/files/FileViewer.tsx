import type { DemoFile } from "../../data/demoFiles";
import type { PendingEdit } from "../../hooks/useEdits";
import DiffView from "../diff/DiffView";

interface FileViewerProps {
  file?: DemoFile;
  onClose: () => void;
  pendingEdit?: PendingEdit;
  onApprove?: () => void;
  onReject?: () => void;
}

export default function FileViewer({
  file,
  onClose,
  pendingEdit,
  onApprove,
  onReject,
}: FileViewerProps) {
  if (file && pendingEdit && pendingEdit.path === file.path && onApprove && onReject) {
    return <DiffView edit={pendingEdit} onApprove={onApprove} onReject={onReject} onClose={onClose} />;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {file ? (
        <>
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
            <span className="truncate text-xs font-medium text-zinc-300">{file.path}</span>
            <span className="ml-auto shrink-0 text-[11px] text-zinc-600">read-only preview</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close file preview"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto p-4 text-[13px] leading-relaxed text-zinc-300">
            {file.content ?? ""}
          </pre>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <h1 className="text-lg font-semibold text-zinc-100">Cracker Box</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Select a file in the tree to preview it. Chat, controls, and diff-aware edits land next.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
