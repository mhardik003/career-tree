import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  V2Edge,
  V2Node,
  V2NodePageView,
  V2NodeType,
} from "@/lib/v2/types";
import V2FocusView from "../V2FocusView";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const suggestChildCardProps = vi.hoisted(() => vi.fn());

// The real SuggestChildCard no longer surfaces the raw node id in the DOM
// (it's display-only text now), so the only way to assert exactly which id
// this view hands the card — the current node vs. the selected parent, the
// distinction FIX 2 guards — is to mock the child and inspect its props.
vi.mock("../SuggestChildCard", () => ({
  default: (props: { parentNodeId: string; parentTitle: string }) => {
    suggestChildCardProps(props);
    return (
      <button
        type="button"
        aria-label={`Suggest a further option after ${props.parentTitle}`}
      >
        Suggest a further option
      </button>
    );
  },
}));

const prov = {
  model: "test",
  prompt_version: "v2.0",
  generated_at: "2026-07-17",
  source_urls: [],
};

function node(id: string, type: V2NodeType, title: string): V2Node {
  return {
    id,
    type,
    slug: id.split(":")[1],
    title,
    aliases: [],
    description: `${title} description`,
    is_terminal: false,
    needs_review: false,
    prov,
  };
}

function edge(from: string, to: string): V2Edge {
  return {
    id: `${from}->${to}`,
    from_id: from,
    to_id: to,
    edge_type: "progression",
    is_common_route: true,
    prov,
  };
}

const class10 = node("school_stage:class-10", "school_stage", "Class 10");
const bca = node("degree:bca", "degree", "BCA");
const developer = node("job_role:developer", "job_role", "Developer");
const llb = node("degree:llb", "degree", "LLB");
const mba = node("degree:mba", "degree", "MBA");
const product = node(
  "job_role:product-manager",
  "job_role",
  "Product Manager",
);
const bcaToMba = edge(bca.id, mba.id);

const view: V2NodePageView = {
  node: mba,
  selectedParentId: developer.id,
  backHref: "/explore/job_role/developer",
  parents: [bca, developer, llb].map((parent) => ({
    node: parent,
    edge: edge(parent.id, mba.id),
    contextHref: `/explore/degree/mba?from=${encodeURIComponent(parent.id)}`,
  })),
  children: [
    {
      node: product,
      edge: edge(mba.id, product.id),
      href: "/explore/job_role/product-manager?from=degree%3Amba",
    },
  ],
  routes: [
    {
      nodeIds: [class10.id, bca.id, mba.id],
      edges: [edge(class10.id, bca.id), bcaToMba],
      titles: [class10.title, bca.title, mba.title],
      nicheEdges: 0,
      lateralEdges: 0,
    },
  ],
};

describe("V2FocusView", () => {
  it("renders canonical children and updates only parent route context", () => {
    render(<V2FocusView view={view} />);
    expect(
      screen.getByRole("link", { name: "View full guide" }),
    ).toHaveAttribute(
      "href",
      "/careers/degree/mba?from=job_role%3Adeveloper",
    );
    expect(
      screen.queryByText(/View complete routes from Class 10/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Other ways to reach/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Parent 2 of 3/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open parent Developer" }),
    ).toHaveAttribute("href", "/explore/job_role/developer");
    expect(
      screen.getByRole("heading", { level: 1, name: "MBA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Product Manager/ }),
    ).toHaveAttribute(
      "href",
      "/explore/job_role/product-manager?from=degree%3Amba",
    );
    fireEvent.click(screen.getByRole("button", { name: "Select parent BCA" }));
    expect(replace).toHaveBeenCalledWith(
      "/explore/degree/mba?from=degree%3Abca",
      { scroll: false },
    );
    expect(
      screen.getByRole("link", { name: /Product Manager/ }),
    ).toBeInTheDocument();
  });

  it("offers the suggestion card after the last mapped child", () => {
    render(<V2FocusView view={view} />);
    const lastChild = screen.getByRole("link", { name: /Product Manager/ });
    const suggest = screen.getByRole("button", {
      name: "Suggest a further option after MBA",
    });
    expect(
      lastChild.compareDocumentPosition(suggest) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Ordering alone would still pass if the card were hoisted outside the
    // grid entirely — pin it down by requiring the same parent element.
    expect(suggest.parentElement).toBe(lastChild.parentElement);
  });

  it("hands the suggestion card the current node's id, not the selected parent's", () => {
    render(<V2FocusView view={view} />);
    expect(suggestChildCardProps).toHaveBeenCalledWith(
      expect.objectContaining({ parentNodeId: mba.id }),
    );
    expect(suggestChildCardProps).not.toHaveBeenCalledWith(
      expect.objectContaining({ parentNodeId: developer.id }),
    );
  });

  it("keeps the destination identity on a terminal node and still invites an option", () => {
    render(<V2FocusView view={{ ...view, children: [] }} />);
    expect(
      screen.getByRole("heading", { name: "Career destination" }),
    ).toBeInTheDocument();
    const suggest = screen.getByRole("button", {
      name: "Suggest a further option after MBA",
    });
    expect(suggest).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Career destination" }).parentElement,
    ).not.toContainElement(suggest);
  });
});
