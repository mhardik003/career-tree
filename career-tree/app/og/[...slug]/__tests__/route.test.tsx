import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  node: {
    id: "degree:bca",
    type: "degree",
    slug: "bca",
    title: "BCA",
    description: "An undergraduate computing degree.",
    is_terminal: false,
  },
}));

vi.mock("@/lib/v2/data", () => ({
  v2Graph: {
    getNodeByRoute: (type: string, slug: string) =>
      type === "degree" && slug === "bca" ? mocks.node : undefined,
  },
}));
vi.mock("@/lib/treeUtils", () => ({
  findNodeBySlug: () => ({
    status: "found",
    data: {
      node_title: "BCA",
      description: "An undergraduate computing degree.",
      difficulty_rating: 5,
      is_terminal: false,
    },
    parent: null,
  }),
}));
vi.mock("@/lib/og", () => ({
  OG_SIZE: { width: 1200, height: 630 },
  OG_GREEN: "#16a34a",
  OG_GRAY: "#6b7280",
  OG_CACHE_HEADERS: { "Cache-Control": "test" },
  loadOgFonts: async () => [],
}));
vi.mock("next/og", () => ({
  ImageResponse: class {
    body: React.ReactNode;
    status: number;
    constructor(body: React.ReactNode, options: { status?: number }) {
      this.body = body;
      this.status = options.status ?? 200;
    }
  },
}));

import { GET } from "../route";

describe("canonical node OG route", () => {
  it("renders title, type, description, and canonical badge", async () => {
    const response = await GET(new Request("http://localhost/og/degree/bca"), {
      params: Promise.resolve({ slug: ["degree", "bca"] }),
    }) as unknown as { body: React.ReactNode; status: number };

    expect(response.status).toBe(200);
    render(<>{response.body}</>);
    expect(screen.getByText("BCA")).toBeVisible();
    expect(screen.getByText("degree")).toBeVisible();
    expect(screen.getByText("An undergraduate computing degree.")).toBeVisible();
    expect(screen.getByText("CANONICAL NODE")).toBeVisible();
  });

  it("returns 404 for invalid shapes and unknown nodes", async () => {
    const invalid = await GET(new Request("http://localhost/og/degree"), {
      params: Promise.resolve({ slug: ["degree"] }),
    });
    const unknown = await GET(new Request("http://localhost/og/degree/nope"), {
      params: Promise.resolve({ slug: ["degree", "nope"] }),
    });

    expect(invalid.status).toBe(404);
    expect(unknown.status).toBe(404);
  });
});
