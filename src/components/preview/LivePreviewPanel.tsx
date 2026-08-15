import PanelResizer from "../layout/PanelResizer";
import PreviewCanvas from "./PreviewCanvas";
import ApprovalCard from "../chat/ApprovalCard";
import { usePreviewToolbar } from "../../hooks/usePreviewToolbar";
import type { PreviewStatus } from "../../hooks/usePreviewRuntime";
import type { PendingApproval } from "../../hooks/useChatStream";

interface LivePreviewPanelProps {
  width: number;
  minWidth: number;
  maxWidth: number;
  onResize: (width: number) => void;
  srcDoc: string | null;
  previewUrl: string | null;
  previewStatus: PreviewStatus;
  liveEpoch?: number;
  busy: boolean;
  onRestart?: () => void;
  approval?: PendingApproval | null;
  onApprove?: () => void;
  onReject?: () => void;
}

function StatusPill({ status, srcDoc }: { status: PreviewStatus; srcDoc: string | null }) {
  if (status === "live") {
    return (
      <span className="rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
        live
      </span>
    );
  }
  if (status === "installing" || status === "starting") {
    return (
      <span className="rounded-sm bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
        starting…
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
        failed
      </span>
    );
  }
  return (
    <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
      {srcDoc ? "static" : "idle"}
    </span>
  );
}

export default function LivePreviewPanel({
  width,
  minWidth,
  maxWidth,
  onResize,
  srcDoc,
  previewUrl,
  previewStatus,
  liveEpoch,
  busy,
  onRestart,
  approval,
  onApprove,
  onReject,
}: LivePreviewPanelProps) {
  const toolbar = usePreviewToolbar();
  const show = toolbar.visible;

  return (
    <>
      <PanelResizer
        width={width}
        minWidth={minWidth}
        maxWidth={maxWidth}
        onResize={onResize}
        invert
        label="Resize live preview"
      />
      <section
        aria-label="Live preview"
        className="relative flex min-w-0 flex-col border-l border-zinc-800 bg-zinc-950"
        style={{ width }}
        onPointerEnter={toolbar.handlePointerEnter}
        onPointerMove={toolbar.handlePointerEnter}
        onPointerLeave={toolbar.handlePointerLeave}
      >
        <header
          className={`shrink-0 overflow-hidden border-b border-zinc-800 transition-[height] duration-150 ease-out ${
            show ? "h-9" : "h-1"
          }`}
        >
          <div
            className={`flex h-9 items-center gap-2 px-3 transition-opacity duration-100 ${
              show ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Live Preview
            </span>
            <StatusPill status={previewStatus} srcDoc={srcDoc} />
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => toolbar.setAutoHide(!toolbar.autoHide)}
              title={
                toolbar.autoHide
                  ? "Auto-hide on — click to always show"
                  : "Auto-hide off — click to auto-hide"
              }
              aria-label="Toggle auto-hide toolbar"
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-zinc-800 ${
                toolbar.autoHide ? "text-sky-400" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {toolbar.autoHide ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M1.5 8s2.3-4.5 6.5-4.5S14.5 8 14.5 8s-2.3 4.5-6.5 4.5S1.5 8 1.5 8Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M1.5 8s2.3-4.5 6.5-4.5S14.5 8 14.5 8s-2.3 4.5-6.5 4.5S1.5 8 1.5 8Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => toolbar.setPinned(!toolbar.pinned)}
              disabled={!toolbar.autoHide}
              title={
                toolbar.pinned
                  ? "Unpin toolbar"
                  : "Pin toolbar (stays visible)"
              }
              aria-label="Pin toolbar"
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 ${
                toolbar.pinned ? "text-sky-400" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
        </header>
        <PreviewCanvas
          srcDoc={srcDoc}
          previewUrl={previewUrl}
          previewStatus={previewStatus}
          liveEpoch={liveEpoch}
          busy={busy}
          onRestart={onRestart}
        />
        {approval && onApprove && onReject && (
          <div className="absolute inset-x-0 top-9 z-30 flex justify-center px-4">
            <div className="w-full max-w-md">
              <ApprovalCard approval={approval} onApprove={onApprove} onReject={onReject} />
            </div>
          </div>
        )}
      </section>
    </>
  );
}