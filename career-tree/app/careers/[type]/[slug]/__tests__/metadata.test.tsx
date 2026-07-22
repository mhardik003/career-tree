import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const shared = "https://example.edu/shared";
  const node = {
    id: "degree:bca",
    type: "degree",
    slug: "bca",
    title: "BCA",
    aliases: ["Bachelor of Computer Applications"],
    description: "Computing guide <with trusted data>",
    is_terminal: false,
    needs_review: false,
    facts: {
      schema_version: 1,
      last_reviewed: "2026-07-19",
      quick_facts: [{ label: "Duration", value: "Three years", source_urls: [shared] }],
      sections: [{
        key: "curriculum",
        heading: "Curriculum",
        paragraphs: ["Programming foundations."],
        bullets: [],
        source_urls: [shared, "https://example.edu/curriculum"],
      }],
      useful_links: [{ label: "Official", url: "https://example.edu/official", kind: "official" }],
      prov: { model: "gpt-5.6-terra", prompt_version: "v2-enrichment-1", generated_at: "2026-07-19" },
    },
    prov: {
      model: "gpt-5.6-terra",
      prompt_version: "v2-openai-1",
      generated_at: "2026-07-19",
      source_urls: [shared],
    },
  };
  return { node };
});

vi.mock("@/lib/v2/data", () => ({
  v2Graph: {
    nodes: [mocks.node],
    getNodeByRoute: (type: string, slug: string) =>
      type === "degree" && slug === "bca" ? mocks.node : undefined,
  },
}));

vi.mock("@/lib/v2/routes", () => ({
  buildNodePageView: () => ({ node: mocks.node, parents: [], routes: [], children: [] }),
}));

// facts.ts imports "server-only" and reads from disk; the fixture node above
// already carries its facts, so the composed full node is the node itself.
vi.mock("@/lib/v2/facts", () => ({
  getFullNode: async (nodeId: string) =>
    nodeId === "degree:bca" ? mocks.node : null,
}));

vi.mock("@/lib/v2/route-map", () => ({ findRouteThroughParent: vi.fn() }));
vi.mock("@/components/v2/V2BlogView", () => ({ default: () => <div>Guide body</div> }));

import CareerGuidePage, { generateMetadata } from "../page";

const props = { params: Promise.resolve({ type: "degree", slug: "bca" }) };

describe("production career guide metadata", () => {
  it("uses one indexable canonical URL without query context", async () => {
    const metadata = await generateMetadata(props);

    expect(metadata.title).toBe("BCA — Career Guide");
    expect(metadata.alternates).toEqual({ canonical: "/careers/degree/bca" });
    expect(metadata.keywords).toContain("Bachelor of Computer Applications");
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url: "/careers/degree/bca",
      images: [{ url: "/og/degree/bca" }],
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("renders safe Article JSON-LD with deduplicated citations", async () => {
    const { container } = render(await CareerGuidePage(props));
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain("\\u003c");
    const article = JSON.parse(script?.textContent ?? "{}");
    // Schema.org URLs are absolute so Google can resolve them standalone.
    expect(article).toMatchObject({
      "@type": "Article",
      headline: "BCA",
      dateModified: "2026-07-19",
      url: "https://careerstree.in/careers/degree/bca",
      mainEntityOfPage: "https://careerstree.in/careers/degree/bca",
      image: "https://careerstree.in/og/degree/bca",
      publisher: { "@id": "https://careerstree.in/#organization" },
      about: { name: "BCA", additionalType: "degree" },
    });
    expect(article.citation).toEqual([
      "https://example.edu/shared",
      "https://example.edu/curriculum",
      "https://example.edu/official",
    ]);
  });
});
