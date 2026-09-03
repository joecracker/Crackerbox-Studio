import type { DemoFile } from "../../data/demoFiles";
import FileTree from "./FileTree";
import SessionCredits from "./SessionCredits";
import type { RealFolderControls } from "../../hooks/useRealFolder";
import type { OpenRouterCredits } from "../../hooks/useOpenRouterCredits";

interface FileTreePanelProps {
  activePath: string | null;
  expanded: Set<string>;
  query: string;
  nodes: DemoFile[];
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onQueryChange: (query: string) => void;
  onContextMenuFile?: (path: string, x: number, y: number) => void;
  pendingPaths?: Set<string>;
  realFolder?: RealFolderControls;
  sessionCredits?: {
    tokenCount: number;
    contextLength: number | null;
    contextPercent: number | null;
    contextLevel: "ok" | "soft" | "hard" | "unknown";
    credits: OpenRouterCredits;
    creditsLoading: boolean;
    creditsError: string | null;
    onRefreshCredits: () => void;
  };
}

// Render the file tree content only (no <aside> chrome) so it can sit inside
// the unified navigation drawer as its "Files" tab.
export default function FileTreePanel({
  activePath,
  expanded,
  query,
  nodes,
  onSelect,
  onToggle,
  onQueryChange,
  onContextMenuFile,
  pendingPaths,
  realFolder,
  sessionCredits,
}: FileTreePanelProps) {
  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {realFolder && (
        <div className="shrink-0 space-y-1.5 border-b border-zinc-800 px-2 py-2">
          {realFolder.folderName && (
            <div className="flex items-center gap-1.5 px-1">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.2l1.3 1.5h5.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
              <span className="min-w-0 flex-1 truncate text-[11px] text-sky-300">{realFolder.folderName}</span>
              <button
                type="button"
                onClick={realFolder.unlink}
                title="Unlink folder"
                aria-label="Unlink folder"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
              >
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void realFolder.link()}
              disabled={realFolder.loading}
              title="Open a real folder from your computer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-sky-600 hover:text-sky-300 disabled:opacity-50"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.2l1.3 1.5h5.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
              {realFolder.loading ? "Opening…" : realFolder.folderName ? "Reopen folder" : "Open folder"}
            </button>
            {realFolder.folderName && (
              <button
                type="button"
                onClick={() => void realFolder.save()}
                disabled={realFolder.saving}
                title="Save all files back to the linked folder on your computer"
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-600/10 px-2 py-1 text-[11px] text-emerald-300 transition-colors hover:bg-emerald-600/20 disabled:opacity-50"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M4 2h6l2 2v10H4V2Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path d="M6 2v3h4V2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                {realFolder.saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
          {realFolder.error && (
            <p className="px-1 text-[10px] text-red-400">{realFolder.error}</p>
          )}
        </div>
      )}
      <div className="shrink-0 px-2 py-2">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onQueryChange("");
            }
          }}
          placeholder="Search files"
          aria-label="Search files"
          className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FileTree
          nodes={nodes}
          activePath={activePath}
          expanded={expanded}
          forceExpand={query.trim().length > 0}
          onToggle={onToggle}
          onSelect={onSelect}
          onContextMenuFile={onContextMenuFile}
          pendingPaths={pendingPaths}
        />
      </div>
      {sessionCredits ? (
        <div className="shrink-0">
          <SessionCredits
            tokenCount={sessionCredits.tokenCount}
            contextLength={sessionCredits.contextLength}
            contextPercent={sessionCredits.contextPercent}
            contextLevel={sessionCredits.contextLevel}
            credits={sessionCredits.credits}
            creditsLoading={sessionCredits.creditsLoading}
            creditsError={sessionCredits.creditsError}
            onRefreshCredits={sessionCredits.onRefreshCredits}
          />
        </div>
      ) : (
        <div className="shrink-0 truncate border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
          {activePath ? activePath : "No file selected"}
        </div>
      )}
    </div>
  );
}