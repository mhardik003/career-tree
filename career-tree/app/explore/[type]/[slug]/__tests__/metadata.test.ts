import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  node: {
    id: "degree:bca",
    type: "degree",
    slug: "bca",
    title: "BCA",
    aliases: [],
    description: "Computing degree",
    is_terminal: false,
    needs_review: false,
    prov: { model: "fixture", prompt_version: "v2", generated_at: "2026-07-19", source_urls: [] },
  },
}));

vi.mock("@/lib/v2/data", () => ({
  v2Graph: {
    nodes: [mocks.node],
    getNodeByRoute: (type: string, slug: string) =>
      type === "degree" && slug === "bca" ? mocks.node : undefined,
  },
}));
// facts.ts imports "server-only" and reads from disk; the page only needs
// the composed full node here.
vi.mock("@/lib/v2/facts", () => ({
  getFullNode: async (nodeId: string) =>
    nodeId === "degree:bca" ? mocks.node : null,
}));
vi.mock("@/lib/v2/routes", () => ({
  buildNodePageView: () => ({ node: mocks.node, parents: [] }),
}));
vi.mock("@/components/v2/V2FocusView", () => ({ default: () => null }));
vi.mock("@/components/v2/V2NodePageClient", () => ({ default: () => null }));

import { generateMetadata } from "../page";

describe("production contextual explorer metadata", () => {
  it("is noindex and canonicalizes to the guide", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ type: "degree", slug: "bca" }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({ canonical: "/careers/degree/bca" });
  });
});
