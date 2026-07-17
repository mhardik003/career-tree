import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import V2Directory from "../V2Directory";

const nodes = [
  {
    id: "degree:bca",
    type: "degree" as const,
    title: "BCA",
    aliases: ["Bachelor of Computer Applications"],
    description: "Computing degree",
    href: "/v2/careers/degree/bca",
    incomingCount: 2,
    outgoingCount: 4,
  },
  {
    id: "job_role:product-manager",
    type: "job_role" as const,
    title: "Product Manager",
    aliases: [],
    description: "Product role",
    href: "/v2/careers/job_role/product-manager",
    incomingCount: 4,
    outgoingCount: 0,
  },
];

describe("V2Directory", () => {
  it("filters by alias and shows an empty state", () => {
    render(<V2Directory nodes={nodes} />);
    expect(
      screen.getByRole("searchbox", { name: "Search canonical career nodes" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "computer applications" },
    });
    expect(screen.getByRole("link", { name: /BCA/ })).toHaveAttribute(
      "href",
      "/v2/careers/degree/bca",
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "unmapped phrase" },
    });
    expect(
      screen.getByText("No canonical nodes match this search."),
    ).toBeInTheDocument();
  });

  it("filters by node type", () => {
    render(<V2Directory nodes={nodes} />);
    fireEvent.click(screen.getByRole("button", { name: "Job Role" }));
    expect(
      screen.getByRole("link", { name: /Product Manager/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /BCA/ })).not.toBeInTheDocument();
  });
});
