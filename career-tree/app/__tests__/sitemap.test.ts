import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/v2/data", () => ({
  v2Graph: {
    nodes: [
      { id: "school_stage:class-10", type: "school_stage", slug: "class-10" },
      { id: "degree:bca", type: "degree", slug: "bca" },
    ],
  },
}));
import sitemap from "../sitemap";

describe("sitemap", () => {
  it("publishes static pages and every canonical guide only", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/$/),
      expect.stringMatching(/\/map$/),
      expect.stringMatching(/\/about$/),
      expect.stringMatching(/\/careers\/school_stage\/class-10$/),
      expect.stringMatching(/\/careers\/degree\/bca$/),
    ]));
    expect(urls.some((url) => url.includes("/explore/"))).toBe(false);
    expect(urls.some((url) => url.split("/").includes("v2"))).toBe(false);
  });
});
