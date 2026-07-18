import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CareerDirectory from "../CareerDirectory";

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

describe("CareerDirectory", () => {
  it("filters by alias and shows an empty state", () => {
    render(<CareerDirectory nodes={nodes} />);
    const search = screen.getByRole("searchbox", {
      name: "Search canonical career nodes",
    });
    expect(search).toHaveAttribute("id", "career-search");
    fireEvent.change(search, { target: { value: "computer applications" } });
    expect(screen.getByRole("link", { name: /BCA/ })).toHaveAttribute(
      "href",
      "/careers/degree/bca",
    );
    fireEvent.change(search, { target: { value: "unmapped phrase" } });
    expect(screen.getByText("No canonical nodes match this search.")).toBeVisible();
  });

  it("filters by node type", () => {
    render(<CareerDirectory nodes={nodes} />);
    fireEvent.click(screen.getByRole("button", { name: "Job Role" }));
    expect(screen.getByRole("link", { name: /Product Manager/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /BCA/ })).not.toBeInTheDocument();
  });
});
