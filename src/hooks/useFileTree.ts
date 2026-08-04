import { useMemo, useState } from "react";
import type { DemoFile } from "../data/demoFiles";

function findNode(nodes: DemoFile[], path: string): DemoFile | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

export function useFileTree(files: DemoFile[]) {
  const [activePath, setActivePath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const toggleExpanded = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const expandTo = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i++) {
        next.add(parts.slice(0, i).join("/"));
      }
      return next;
    });

  const selectFile = (path: string) => {
    if (activePath === path) {
      setActivePath(null);
      return;
    }
    expandTo(path);
    setActivePath(path);
  };

  const deselectFile = () => setActivePath(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    const walk = (list: DemoFile[]): DemoFile[] =>
      list.flatMap((node) => {
        if (node.type === "folder") {
          const children = walk(node.children ?? []);
          if (children.length > 0) return [{ ...node, children }];
          if (node.name.toLowerCase().includes(q)) return [{ ...node, children: [] }];
          return [];
        }
        return node.name.toLowerCase().includes(q) ? [node] : [];
      });
    return walk(files);
  }, [files, query]);

  return {
    activePath,
    activeFile: activePath ? findNode(files, activePath) : undefined,
    selectFile,
    deselectFile,
    expanded,
    toggleExpanded,
    query,
    setQuery,
    filtered,
  };
}
