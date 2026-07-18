import { describe, expect, it } from "vitest";
import { V2Graph } from "../graph-core";
import type { V2GraphSnapshot } from "../types";

const prov = {
  model: "test",
  prompt_version: "v2.0",
  generated_at: "2026-07-17",
  source_urls: [],
};

const snapshot: V2GraphSnapshot = {
  schema_version: 1,
  root_id: "school_stage:class-10",
  source_digest: "test",
  generated_at: "2026-07-17T00:00:00Z",
  nodes: [
    {
      id: "school_stage:class-10",
      type: "school_stage",
      slug: "class-10",
      title: "Class 10",
      aliases: [],
      description: "Root",
      is_terminal: false,
      needs_review: false,
      prov,
    },
    {
      id: "degree:bca",
      type: "degree",
      slug: "bca",
      title: "BCA",
      aliases: ["Bachelor of Computer Applications"],
      description: "BCA",
      is_terminal: false,
      needs_review: false,
      prov,
    },
    {
      id: "degree:mba",
      type: "degree",
      slug: "mba",
      title: "MBA",
      aliases: [],
      description: "MBA",
      is_terminal: false,
      needs_review: false,
      prov,
    },
  ],
  edges: [
    {
      id: "school_stage:class-10->degree:bca",
      from_id: "school_stage:class-10",
      to_id: "degree:bca",
      edge_type: "progression",
      is_common_route: true,
      prov,
    },
    {
      id: "degree:bca->degree:mba",
      from_id: "degree:bca",
      to_id: "degree:mba",
      edge_type: "progression",
      is_common_route: true,
      prov,
    },
  ],
};

describe("V2Graph", () => {
  const graph = new V2Graph(snapshot);

  it("resolves stable routes", () => {
    expect(graph.getNodeByRoute("degree", "mba")?.id).toBe("degree:mba");
  });

  it("resolves exact IDs and detects an existing child title", () => {
    expect(graph.getNodeById("degree:bca")?.title).toBe("BCA");
    expect(graph.hasChildTitle("school_stage:class-10", "bca")).toBe(true);
    expect(graph.getNodeById("10th Class/Science")).toBeUndefined();
  });

  it("indexes incoming and outgoing relationships", () => {
    expect(graph.incoming("degree:mba").map((edge) => edge.from_id)).toEqual([
      "degree:bca",
    ]);
    expect(graph.outgoing("degree:bca").map((edge) => edge.to_id)).toEqual([
      "degree:mba",
    ]);
  });

  it("builds lean directory summaries", () => {
    const mba = graph.directoryNodes().find((item) => item.id === "degree:mba");
    expect(mba).toMatchObject({
      href: "/v2/careers/degree/mba",
      incomingCount: 1,
      outgoingCount: 0,
    });
  });
});
