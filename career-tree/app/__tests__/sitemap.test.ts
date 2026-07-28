import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/v2/data", () => {
  // The root has no incoming edge and the leaf no outgoing one, so each is
  // kept by only one side of the degree check; exam:orphan has neither.
  const edges = [{ from_id: "school_stage:class-10", to_id: "degree:bca" }];
  return {
    v2Graph: {
      generatedAt: "2026-07-21T11:48:44.254220Z",
      nodes: [
        {
          id: "school_stage:class-10",
          type: "school_stage",
          slug: "class-10",
          prov: { generated_at: "2026-07-19" },
        },
        // No prov date: must fall back to the graph build stamp, not emit junk.
        { id: "degree:bca", type: "degree", slug: "bca", prov: {} },
        // Unexpanded seed: no edges either way, so it must not be sitemapped.
        { id: "exam:orphan", type: "exam", slug: "orphan", prov: {} },
      ],
      incoming: (id: string) => edges.filter((edge) => edge.to_id === id),
      outgoing: (id: string) => edges.filter((edge) => edge.from_id === id),
    },
  };
});
import sitemap from "../sitemap";

describe("sitemap", () => {
  it("publishes static pages and every canonical guide only", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/$/),
      expect.stringMatching(/\/map$/),
      expect.stringMatching(/\/search$/),
      expect.stringMatching(/\/about$/),
      expect.stringMatching(/\/careers\/school_stage\/class-10$/),
      expect.stringMatching(/\/careers\/degree\/bca$/),
    ]));
    expect(urls.some((url) => url.includes("/explore/"))).toBe(false);
    expect(urls.some((url) => url.split("/").includes("v2"))).toBe(false);
  });

  it("omits nodes with no edges in either direction", () => {
    const urls = sitemap().map((entry) => entry.url);

    // A dead-end seed renders as a page with no route in or out; keeping it
    // out of the sitemap stops it being crawled as thin content.
    expect(urls.some((url) => url.endsWith("/careers/exam/orphan"))).toBe(false);
    // One edge is enough, from either side.
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/careers\/school_stage\/class-10$/),
      expect.stringMatching(/\/careers\/degree\/bca$/),
    ]));
  });

  it("stamps every entry with a valid lastModified", () => {
    const entries = sitemap();

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(Number.isNaN(new Date(entry.lastModified!).valueOf())).toBe(false);
    }
  });

  it("prefers the node's own provenance date over the build stamp", () => {
    const byUrl = new Map(sitemap().map((entry) => [entry.url, entry.lastModified]));

    const dated = byUrl.get("https://careerstree.in/careers/school_stage/class-10");
    expect(new Date(dated!).toISOString()).toBe("2026-07-19T00:00:00.000Z");

    // prov carries no date, so this one inherits the graph build stamp.
    const fallback = byUrl.get("https://careerstree.in/careers/degree/bca");
    expect(new Date(fallback!).toISOString()).toBe("2026-07-21T11:48:44.254Z");
  });
});
