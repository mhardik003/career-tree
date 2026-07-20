import "server-only";
// The core snapshot (~1 MB) is graph.json minus every node's `facts` blob
// (~10.6 MB with facts). Facts are read per node from data/v2/facts/ via
// lib/v2/facts.ts, so API routes, OG rendering, and non-focused nodes never
// pay for the full fact corpus.
import snapshotJson from "@/data/v2/graph.core.json";
import { V2Graph } from "./graph-core";
import type { V2GraphCoreSnapshot } from "./types";

export const v2Graph = new V2Graph(
  snapshotJson as unknown as V2GraphCoreSnapshot,
);
