import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ from: mocks.from }),
}));

vi.mock("@/lib/v2/data", () => ({
  v2Graph: {
    rootId: "school_stage:class-10",
    directoryNodes: () => [{
      id: "degree:bca",
      type: "degree",
      title: "BCA",
      aliases: ["Bachelor of Computer Applications"],
      description: "Computing degree",
      href: "/careers/degree/bca",
      incomingCount: 2,
      outgoingCount: 4,
    }],
  },
}));

import Home from "../page";

describe("production home page", () => {
  it("places Class 10 exploration before career search", async () => {
    mocks.from.mockImplementation((table: string) => ({
      select: vi.fn().mockResolvedValue({
        count: table === "suggestions" ? 4 : 2,
        error: null,
      }),
    }));

    render(await Home());

    const primary = screen.getByRole("link", {
      name: /Start exploring from Class 10/i,
    });
    const secondary = screen.getByRole("button", {
      name: "Search for a career",
    });
    expect(primary).toHaveAttribute("href", "/explore/school_stage/class-10");
    expect(secondary).toBeVisible();
    expect(screen.getByRole("searchbox", {
      name: "Search canonical career nodes",
    })).toBeVisible();
    expect(
      primary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });
});
