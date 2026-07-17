import type { V2DirectoryNode, V2NodeType } from "./types";

export type DirectoryTypeFilter = "all" | V2NodeType;

export function filterDirectory(
  nodes: V2DirectoryNode[],
  query: string,
  type: DirectoryTypeFilter,
): V2DirectoryNode[] {
  const needle = query.trim().toLocaleLowerCase();
  return nodes.filter((node) => {
    if (type !== "all" && node.type !== type) return false;
    if (!needle) return true;
    return [node.title, ...node.aliases].some((value) =>
      value.toLocaleLowerCase().includes(needle),
    );
  });
}
