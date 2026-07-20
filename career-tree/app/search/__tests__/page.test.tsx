import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/v2/data", () => ({
  v2Graph: {
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

import SearchPage from "../page";

describe("search page", () => {
  it("renders the canonical directory with search and a way back home", () => {
    render(<SearchPage />);

    expect(screen.getByRole("heading", {
      level: 1,
      name: "Find a stage, degree, exam or career",
    })).toBeVisible();
    expect(screen.getByRole("searchbox", {
      name: "Search canonical career nodes",
    })).toBeVisible();
    expect(screen.getByRole("link", { name: /BCA/ }))
      .toHaveAttribute("href", "/careers/degree/bca");
    expect(screen.getByRole("link", { name: /Back home/ }))
      .toHaveAttribute("href", "/");
  });
});
