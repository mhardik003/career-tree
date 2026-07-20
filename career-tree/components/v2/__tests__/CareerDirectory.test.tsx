import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { V2DirectoryNode } from "@/lib/v2/types";
import CareerDirectory, { MAX_RENDERED_RESULTS } from "../CareerDirectory";

const nodes = [
  {
    id: "degree:bca",
    type: "degree" as const,
    title: "BCA",
    aliases: ["Bachelor of Computer Applications"],
    description: "Computing degree",
    href: "/careers/degree/bca",
    incomingCount: 2,
    outgoingCount: 4,
  },
  {
    id: "job_role:product-manager",
    type: "job_role" as const,
    title: "Product Manager",
    aliases: [],
    description: "Product role",
    href: "/careers/job_role/product-manager",
    incomingCount: 4,
    outgoingCount: 0,
  },
];

function flushDebounce() {
  act(() => {
    vi.advanceTimersByTime(200);
  });
}

describe("CareerDirectory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters by alias after the debounce window and shows an empty state", () => {
    render(<CareerDirectory nodes={nodes} />);
    const search = screen.getByRole("searchbox", {
      name: "Search canonical career nodes",
    });
    expect(search).toHaveAttribute("id", "career-search");
    fireEvent.change(search, { target: { value: "computer applications" } });
    // The input is controlled and instant; the filter itself is debounced,
    // so the unmatched node is still listed until the window elapses.
    expect(search).toHaveValue("computer applications");
    expect(screen.getByRole("link", { name: /Product Manager/ })).toBeVisible();
    flushDebounce();
    expect(screen.getByRole("link", { name: /BCA/ })).toHaveAttribute(
      "href",
      "/careers/degree/bca",
    );
    expect(
      screen.queryByRole("link", { name: /Product Manager/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "unmapped phrase" } });
    flushDebounce();
    expect(screen.getByText("No canonical nodes match this search.")).toBeVisible();
  });

  it("filters by node type immediately, without waiting for the debounce", () => {
    render(<CareerDirectory nodes={nodes} />);
    fireEvent.click(screen.getByRole("button", { name: "Job Role" }));
    expect(screen.getByRole("link", { name: /Product Manager/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /BCA/ })).not.toBeInTheDocument();
  });

  it("caps rendered results and reports the hidden count", () => {
    const many: V2DirectoryNode[] = Array.from(
      { length: MAX_RENDERED_RESULTS + 50 },
      (_, index) => ({
        id: `degree:degree-${index}`,
        type: "degree" as const,
        title: `Degree ${index}`,
        aliases: [],
        description: "",
        href: `/careers/degree/degree-${index}`,
        incomingCount: 0,
        outgoingCount: 0,
      }),
    );
    render(<CareerDirectory nodes={many} />);
    expect(screen.getAllByRole("link")).toHaveLength(MAX_RENDERED_RESULTS);
    expect(
      screen.getByText(
        new RegExp(
          `${MAX_RENDERED_RESULTS + 50} matching nodes · showing first ${MAX_RENDERED_RESULTS}`,
        ),
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/50 more matches not shown — refine your search/),
    ).toBeVisible();
  });

  it("hides the cap notice once the search narrows the results", () => {
    const many: V2DirectoryNode[] = Array.from(
      { length: MAX_RENDERED_RESULTS + 1 },
      (_, index) => ({
        id: `degree:degree-${index}`,
        type: "degree" as const,
        title: `Degree ${index}`,
        aliases: [],
        description: "",
        href: `/careers/degree/degree-${index}`,
        incomingCount: 0,
        outgoingCount: 0,
      }),
    );
    render(<CareerDirectory nodes={many} />);
    expect(screen.getByText(/1 more matches not shown/)).toBeVisible();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search canonical career nodes" }),
      { target: { value: "Degree 100" } },
    );
    flushDebounce();
    expect(screen.queryByText(/more matches not shown/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
