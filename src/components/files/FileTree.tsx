import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { FileTreeNode } from "./FileTreeNode";
import type { DemoFile } from "../../data/demoFiles";

interface FileTreeProps {
  nodes: DemoFile[];
  activePath: string | null;
  expanded: Set<string>;
  forceExpand?: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenuFile?: (path: string, x: number, y: number) => void;
  pendingPaths?: Set<string>;
}

interface VisibleNode {
  node: DemoFile;
  depth: number;
}

export default function FileTree({
  nodes,
  activePath,
  expanded,
  forceExpand = false,
  onToggle,
  onSelect,
  onContextMenuFile,
  pendingPaths,
}: FileTreeProps) {
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  const visible = useMemo<VisibleNode[]>(() => {
    const out: VisibleNode[] = [];
    const walk = (list: DemoFile[], depth: number) => {
      for (const node of list) {
        out.push({ node, depth });
        if (node.children && (expanded.has(node.path) || forceExpand)) {
          walk(node.children, depth + 1);
        }
      }
    };
    walk(nodes, 0);
    return out;
  }, [nodes, expanded, forceExpand]);

  const focusNode = (path: string) => {
    setFocusedPath(path);
    nodeRefs.current.get(path)?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (visible.length === 0) return;
    const idx = visible.findIndex((v) => v.node.path === focusedPath);
    const at = idx >= 0 ? idx : 0;
    const current = visible[at];

    switch (e.key) {
      case "ArrowDown":
        focusNode(visible[Math.min(visible.length - 1, at + 1)].node.path);
        e.preventDefault();
        break;
      case "ArrowUp":
        focusNode(visible[Math.max(0, at - 1)].node.path);
        e.preventDefault();
        break;
      case "ArrowRight":
        if (current.node.children && !expanded.has(current.node.path) && !forceExpand) {
          onToggle(current.node.path);
        } else if (current.node.children && at + 1 < visible.length) {
          focusNode(visible[at + 1].node.path);
        }
        e.preventDefault();
        break;
      case "ArrowLeft": {
        if (current.node.children && expanded.has(current.node.path) && !forceExpand) {
          onToggle(current.node.path);
        } else {
          const parts = current.node.path.split("/");
          if (parts.length > 1) {
            focusNode(parts.slice(0, -1).join("/"));
          }
        }
        e.preventDefault();
        break;
      }
      case "Enter":
        e.preventDefault();
        if (current.node.children) onToggle(current.node.path);
        else onSelect(current.node.path);
        break;
      case "Home":
        focusNode(visible[0].node.path);
        e.preventDefault();
        break;
      case "End":
        focusNode(visible[visible.length - 1].node.path);
        e.preventDefault();
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="tree"
      aria-label="Project files"
      onKeyDown={handleKeyDown}
      className="flex-1 overflow-auto px-2 pb-2"
    >
      {visible.length === 0 ? (
        <p className="px-1 py-2 text-xs text-zinc-500">No matching files.</p>
      ) : (
        visible.map(({ node, depth }) => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={depth}
            active={node.path === activePath}
            expanded={expanded.has(node.path)}
            tabIndex={node.path === focusedPath ? 0 : -1}
            innerRef={(el) => {
              if (el) nodeRefs.current.set(node.path, el);
              else nodeRefs.current.delete(node.path);
            }}
            onFocus={() => setFocusedPath(node.path)}
            onToggle={() => onToggle(node.path)}
            onSelect={() => onSelect(node.path)}
            onContextMenu={onContextMenuFile}
            pending={pendingPaths?.has(node.path)}
          />
        ))
      )}
    </div>
  );
}
