import type { DemoFile } from "../../data/demoFiles";

interface FileTreeNodeProps {
  node: DemoFile;
  depth: number;
  active: boolean;
  expanded: boolean;
  tabIndex: number;
  innerRef: (el: HTMLDivElement | null) => void;
  onFocus: () => void;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu?: (path: string, x: number, y: number) => void;
}

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 2.5h6l3 3V13a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 3 13V2.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9 2.5V6h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function FileTreeNode({
  node,
  depth,
  active,
  expanded,
  tabIndex,
  innerRef,
  onFocus,
  onToggle,
  onSelect,
  onContextMenu,
}: FileTreeNodeProps) {
  const isFolder = node.type === "folder";
  return (
    <div
      ref={innerRef}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={isFolder ? expanded : undefined}
      aria-selected={active}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={isFolder ? onToggle : onSelect}
      onContextMenu={(e) => {
        if (isFolder || !onContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(node.path, e.clientX, e.clientY);
      }}
      className={`flex cursor-pointer select-none items-center gap-1.5 rounded-md py-1 pr-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-sky-400 ${
        active
          ? "bg-zinc-800 font-medium text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
      }`}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500">
        {isFolder ? <CaretIcon open={expanded} /> : <FileIcon />}
      </span>
      <span className="truncate">{node.name}</span>
      {active && <span className="sr-only">(active)</span>}
    </div>
  );
}
