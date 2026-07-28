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
  },
}));

import Home from "../page";

describe("production home page", () => {
  it("places Class 10 exploration before career search", async () => {
    const filters: Array<[string, string]> = [];
    mocks.from.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn((column: string, value: string) => {
          filters.push([column, value]);
          return Promise.resolve({
            count: table === "suggestions" ? 4 : 2,
            error: null,
          });
        }),
      }),
    }));

    render(await Home());

    // Both counters must filter to approved: an unfiltered count would let
    // anyone posting to /api/suggest drive a number on the public homepage.
    expect(filters).toEqual([
      ["status", "approved"],
      ["status", "approved"],
    ]);

    const primary = screen.getByRole("link", {
      name: /Start exploring from Class 10/i,
    });
    const secondary = screen.getByRole("link", {
      name: "Search for a career",
    });
    expect(primary).toHaveAttribute("href", "/explore/school_stage/class-10");
    expect(secondary).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      primary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });
});
