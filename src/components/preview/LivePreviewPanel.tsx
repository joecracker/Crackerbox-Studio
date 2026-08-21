import { useState } from "react";
import PanelResizer from "../layout/PanelResizer";
import PreviewCanvas from "./PreviewCanvas";
import ApprovalCard from "../chat/ApprovalCard";
import { usePreviewToolbar } from "../../hooks/usePreviewToolbar";
import type { PreviewBrowser, PreviewBrowserMode } from "../../hooks/usePreviewBrowser";
import { GITHUB_HOME, GITHUB_REPO } from "../../hooks/usePreviewBrowser";
import type { PreviewStatus } from "../../hooks/usePreviewRuntime";
import type { PendingApproval } from "../../hooks/useChatStream";
import type { DetectedPreviewError } from "../../utils/devError";

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
  browser: PreviewBrowser;
  approval?: PendingApproval | null;
  onApprove?: () => void;
  onReject?: () => void;
  detectedError?: DetectedPreviewError | null;
  onFixError?: () => void;
  onDismissError?: () => void;
  preferStatic?: boolean;
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

const QUICK_LINKS: Array<{ id: string; label: string; url: string }> = [
  { id: "github", label: "GitHub", url: GITHUB_HOME },
  { id: "repo", label: "Repo", url: GITHUB_REPO },
];

function AddressBar({
  mode,
  url,
  onOpen,
  onShowApp,
}: {
  mode: PreviewBrowserMode;
  url: string;
  onOpen: (url: string) => void;
  onShowApp: () => void;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => onOpen(draft || url);

  return (
    <div className="flex items-center gap-1.5 px-3">
      <button
        type="button"
        onClick={onShowApp}
        aria-pressed={mode === "app"}
        title="Show your app preview"
        className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${
          mode === "app"
            ? "border-sky-500 bg-sky-500/15 text-sky-300"
            : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
        }`}
      >
        App
      </button>
      {QUICK_LINKS.map((link) => (
        <button
          key={link.id}
          type="button"
          onClick={() => onOpen(link.url)}
          title={`Open ${link.label}`}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          {link.label}
        </button>
      ))}
      <input
        value={mode === "app" ? url : draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Type a URL…"
        spellCheck={false}
        className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 font-mono text-[11px] text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-sky-500"
      />
      <button
        type="button"
        onClick={submit}
        title="Go to URL"
        className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
      >
        Go
      </button>
      {mode === "web" && url && (
        <button
          type="button"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          title="Open in a new browser tab"
          className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          ↗
        </button>
      )}
    </div>
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
  browser,
  approval,
  onApprove,
  onReject,
  detectedError,
  onFixError,
  onDismissError,
  preferStatic = false,
}: LivePreviewPanelProps) {
  const toolbar = usePreviewToolbar();
  const show = toolbar.visible;
  const webMode = browser.mode === "web";

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
            show ? "h-[74px]" : "h-1"
          }`}
        >
          <div
            className={`flex h-[74px] flex-col gap-1 py-1 transition-opacity duration-100 ${
              show ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div className="flex h-9 items-center gap-2 px-3">
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
            <AddressBar
              mode={browser.mode}
              url={browser.url}
              onOpen={browser.openUrl}
              onShowApp={browser.showApp}
            />
          </div>
        </header>
        {detectedError && (onFixError || onDismissError) && (
          <div className="shrink-0 border-t border-red-900/60 bg-red-950/40 px-3 py-2">
            <div className="flex items-start gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-red-400"
              >
                <path
                  d="M8 1.8 15 13.8H1L8 1.8Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
                <path d="M8 6v3M8 11.2v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-red-300">
                  The app hit a problem: {detectedError.title}
                </p>
                {detectedError.file && (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-red-400/80">
                    {detectedError.file}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] leading-relaxed text-red-200/70">
                  {detectedError.summary}
                </p>
              </div>
              <div className="flex shrink-0 items-start gap-2">
                {onFixError && (
                  <button
                    type="button"
                    onClick={onFixError}
                    disabled={busy}
                    title={busy ? "Waiting for the assistant…" : "Ask the assistant to fix it"}
                    className="rounded border border-red-700 bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Fix it
                  </button>
                )}
                {onDismissError && (
                  <button
                    type="button"
                    onClick={onDismissError}
                    aria-label="Dismiss error"
                    className="flex h-6 w-6 items-center justify-center rounded text-red-300/70 transition-colors hover:bg-red-900/40 hover:text-red-200"
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {webMode && browser.url ? (
          <iframe
            title="Web browser"
            sandbox="allow-scripts allow-same-origin allow-popups"
            src={browser.url}
            className="min-h-0 w-full flex-1 border-0 bg-white"
          />
        ) : (
          <PreviewCanvas
            srcDoc={srcDoc}
            previewUrl={previewUrl}
            previewStatus={previewStatus}
            liveEpoch={liveEpoch}
            busy={busy}
            onRestart={onRestart}
            preferStatic={preferStatic}
          />
        )}
        {approval && onApprove && onReject && (
          <div className="absolute inset-x-0 top-[74px] z-30 flex justify-center px-4">
            <div className="w-full max-w-md">
              <ApprovalCard approval={approval} onApprove={onApprove} onReject={onReject} />
            </div>
          </div>
        )}
      </section>
    </>
  );
}