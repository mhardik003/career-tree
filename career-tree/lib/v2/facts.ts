import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { v2Graph } from "./data";
import type { V2Node, V2NodeFacts } from "./types";

// Per-node facts live in data/v2/facts/{type}--{slug}.json, exported by
// pipeline/export_frontend.py alongside graph.core.json. Reading them on
// demand keeps the ~10 MB fact corpus out of the server module graph — every
// process holds only the core snapshot. The filename is derived from the
// graph-resolved node (never from the raw id string), so no caller-controlled
// value ever reaches the filesystem path. Routes that call getFacts at
// request time must be listed under outputFileTracingIncludes in
// next.config.ts or the files won't be deployed to Vercel's lambdas.

export const getFacts = cache(
  async (nodeId: string): Promise<V2NodeFacts | null> => {
    const node = v2Graph.getNodeById(nodeId);
    if (!node) return null;
    let raw: string;
    try {
      raw = await readFile(
        join(process.cwd(), "data/v2/facts", `${node.type}--${node.slug}.json`),
        "utf-8",
      );
    } catch (error) {
      // A missing file means the node shipped without facts (the schema keeps
      // `facts` optional); anything else is a real runtime fault.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    return JSON.parse(raw) as V2NodeFacts;
  },
);

/** The core node with its `facts` re-attached — for focused-node rendering. */
export async function getFullNode(nodeId: string): Promise<V2Node | null> {
  const node = v2Graph.getNodeById(nodeId);
  if (!node) return null;
  const facts = await getFacts(nodeId);
  return facts ? { ...node, facts } : { ...node };
}
