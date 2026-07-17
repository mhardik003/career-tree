import "server-only";
import snapshotJson from "@/data/v2/graph.json";
import { V2Graph } from "./graph-core";
import type { V2GraphSnapshot } from "./types";

export const v2Graph = new V2Graph(
  snapshotJson as unknown as V2GraphSnapshot,
);
