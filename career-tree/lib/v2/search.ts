import type { V2DirectoryNode, V2NodeType } from "./types";

export type DirectoryTypeFilter = "all" | V2NodeType;

// TODO(ISSUE-11c): at ~10x nodes (~2 MB+ directory payload) move this filter
// server-side — an API route querying the core graph per debounced query —
// instead of shipping every directory entry to the client and scanning O(N)
// here. Deferred until the dataset actually approaches that size.
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
