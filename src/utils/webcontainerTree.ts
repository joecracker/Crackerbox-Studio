import type { FileSystemTree } from "@webcontainer/api";
import type { DemoFile } from "../data/demoFiles";

export function createFileSystemTree(nodes: DemoFile[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const node of nodes) {
    if (node.type === "file") {
      tree[node.name] = { file: { contents: node.content ?? "" } };
    } else {
      tree[node.name] = { directory: createFileSystemTree(node.children ?? []) };
    }
  }
  return tree;
}
