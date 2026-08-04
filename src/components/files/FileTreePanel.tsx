import type { DemoFile } from "../../data/demoFiles";
import FileTree from "./FileTree";

interface FileTreePanelProps {
  width: number;
  collapsed: boolean;
  transitioning: boolean;
  activePath: string | null;
  expanded: Set<string>;
  query: string;
  nodes: DemoFile[];
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onQueryChange: (query: string) => void;
}

export default function FileTreePanel({
  width,
  collapsed,
  transitioning,
  activePath,
  expanded,
  query,
  nodes,
  onSelect,
  onToggle,
  onQueryChange,
}: FileTreePanelProps) {
  return (
    <aside
      id="app-filetree"
      ref={(el) => {
        if (el) el.inert = collapsed;
      }}
      aria-label="File tree"
      className={collapsed ? "shrink-0" : "shrink-0 border-r border-zinc-800"}
      style={{
        width: collapsed ? 0 : width,
        overflow: "hidden",
        transition: transitioning ? "width 180ms ease" : "none",
      }}
    >
      <div style={{ width, minWidth: width }} className="flex h-full flex-col bg-zinc-950">
        <header className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Files</span>
        </header>
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
        <FileTree
          nodes={nodes}
          activePath={activePath}
          expanded={expanded}
          forceExpand={query.trim().length > 0}
          onToggle={onToggle}
          onSelect={onSelect}
        />
        <div className="mt-auto shrink-0 truncate border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
          {activePath ? activePath : "No file selected"}
        </div>
      </div>
    </aside>
  );
}
