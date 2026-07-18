import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  V2Edge,
  V2Node,
  V2NodePageView,
  V2NodeType,
  V2NodeFacts,
} from "@/lib/v2/types";
import V2BlogView from "../V2BlogView";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
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
const mba = node("degree:mba", "degree", "MBA");
const product = node(
  "job_role:product-manager",
  "job_role",
  "Product Manager",
);

const view: V2NodePageView = {
  node: mba,
  selectedParentId: bca.id,
  backHref: "/explore/degree/bca?from=school_stage%3Aclass-10",
  parents: [
    {
      node: bca,
      edge: edge(bca.id, mba.id),
      contextHref: "/explore/degree/mba?from=degree%3Abca",
    },
  ],
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
      edges: [edge(class10.id, bca.id), edge(bca.id, mba.id)],
      titles: [class10.title, bca.title, mba.title],
      nicheEdges: 0,
      lateralEdges: 0,
    },
  ],
};

describe("V2BlogView", () => {
  it("renders available canonical information without empty sections", () => {
    render(
      <V2BlogView
        view={view}
        parentRoutes={{ "degree:bca": view.routes[0] }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: view.node.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore paths from here" }),
    ).toHaveAttribute("href", "/explore/degree/mba");
    expect(
      screen.getByRole("heading", { name: "Routes from Class 10" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Career routes from Class 10" }),
    ).toBeVisible();
    expect(document.querySelector("details")).toBeNull();
    expect(
      screen.getByRole("link", { name: /Product Manager/ }),
    ).toHaveAttribute("href", "/careers/job_role/product-manager");
    expect(
      screen.queryByRole("heading", { name: "Aliases" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sources" }),
    ).not.toBeInTheDocument();
  });

  it("keeps claim-local citations and deduplicates the final source index", () => {
    const shared = "https://example.edu/shared";
    const facts: V2NodeFacts = {
      schema_version: 1,
      last_reviewed: "2026-07-19",
      quick_facts: [{
        label: "Duration",
        value: "Two years",
        source_urls: ["https://example.edu/duration"],
      }],
      sections: [
        {
          key: "eligibility",
          heading: "Eligibility",
          paragraphs: ["Applicants need an undergraduate degree."],
          bullets: [],
          source_urls: [shared],
        },
        {
          key: "curriculum",
          heading: "Curriculum",
          paragraphs: ["The programme covers management foundations."],
          bullets: [],
          source_urls: [shared],
        },
      ],
      useful_links: [{
        label: "Programme finder",
        url: "https://example.edu/programmes",
        kind: "official",
      }],
      prov: {
        model: "gpt-5.6-terra",
        prompt_version: "v2-enrichment-1",
        generated_at: "2026-07-19",
      },
    };
    const citedView: V2NodePageView = {
      ...view,
      node: {
        ...view.node,
        facts,
        prov: { ...view.node.prov, source_urls: [shared] },
      },
    };

    const { container } = render(
      <V2BlogView
        view={citedView}
        parentRoutes={{ "degree:bca": citedView.routes[0] }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Eligibility" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sources" })).toBeVisible();
    expect(container.querySelectorAll(`a[href="${shared}"]`)).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: shared })).toHaveLength(1);
  });
});
