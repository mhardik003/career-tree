import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { V2Edge, V2Route } from "@/lib/v2/types";
import RouteMapFromQuery, { RouteMap } from "../RouteMap";

const navigation = vi.hoisted(() => ({ from: null as string | null }));
const flowApi = vi.hoisted(() => ({ fitView: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "from" ? navigation.from : null),
  }),
}));

// The mock renders each node through the real nodeTypes entry, so RouteNode's
// Link/aria/data-attribute contract is what the assertions exercise.
type MockNodeProps = { id: string; data: object };
type MockFlowProps = {
  nodes: Array<{ id: string; type: string; data: object }>;
  edges: unknown[];
  nodeTypes: Record<string, ComponentType<MockNodeProps>>;
  panOnDrag: boolean;
  children?: ReactNode;
};
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, edges, nodeTypes, panOnDrag, children }: MockFlowProps) => (
    <div
      data-testid="flow"
      data-edges={edges.length}
      data-pan-on-drag={String(panOnDrag)}
    >
      {nodes.map((node) => {
        const NodeType = nodeTypes[node.type];
        return <NodeType key={node.id} id={node.id} data={node.data} />;
      })}
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Handle: () => null,
  Controls: () => <div data-testid="controls" />,
  Background: () => null,
  BackgroundVariant: { Lines: "lines" },
  Position: { Top: "top", Bottom: "bottom" },
  MarkerType: { Arrow: "arrow", ArrowClosed: "arrowclosed" },
  useReactFlow: () => flowApi,
}));

const prov = {
  model: "test",
  prompt_version: "v2.0",
  generated_at: "2026-07-17",
  source_urls: [],
};

function edge(fromId: string, toId: string): V2Edge {
  return {
    id: `${fromId}->${toId}`,
    from_id: fromId,
    to_id: toId,
    edge_type: "progression",
    is_common_route: true,
    prov,
  };
}

function route(nodeIds: string[], titles: string[]): V2Route {
  return {
    nodeIds,
    titles,
    edges: nodeIds.slice(1).map((toId, index) => edge(nodeIds[index], toId)),
    nicheEdges: 0,
    lateralEdges: 0,
  };
}

const viaBca = route(
  [
    "school_stage:class-10",
    "stream:commerce",
    "degree:bca",
    "degree:mba",
  ],
  ["Class 10", "Commerce", "BCA", "MBA"],
);

const viaBtech = route(
  [
    "school_stage:class-10",
    "stream:science-pcm",
    "degree:b-tech",
    "degree:mba",
  ],
  ["Class 10", "Science PCM", "B.Tech", "MBA"],
);

const defaultProps = {
  defaultRoutes: [viaBca, viaBtech],
  parentRoutes: { "degree:b-tech": viaBtech },
  targetId: "degree:mba",
  targetTitle: "MBA",
};

describe("RouteMap", () => {
  beforeEach(() => {
    navigation.from = null;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it("shows a merged route map by default with contextual explorer links", () => {
    render(<RouteMap {...defaultProps} requestedParentId={null} />);

    expect(
      screen.getByRole("heading", { name: "Routes from Class 10" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Career routes from Class 10" }),
    ).toBeVisible();
    expect(screen.getByTestId("flow")).toHaveAttribute(
      "data-pan-on-drag",
      "false",
    );
    expect(screen.queryByText(/Class 10 →/)).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", {
        name: "Explore MBA via BCA, progression route",
      }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", {
        name: "Explore BCA via Commerce, progression route",
      }),
    ).toHaveAttribute(
      "href",
      "/explore/degree/bca?from=stream%3Acommerce",
    );
  });

  it("uses a valid query parent as the selected route", () => {
    navigation.from = "degree:b-tech";
    render(<RouteMapFromQuery {...defaultProps} />);

    expect(
      screen.getByRole("link", {
        name: "Explore B.Tech via Science PCM, progression route",
      }),
    ).toHaveAttribute("data-selected", "true");
    expect(
      screen.getByRole("link", {
        name: "Explore MBA via B.Tech, progression route",
      }),
    ).toHaveAttribute(
      "href",
      "/explore/degree/mba?from=degree%3Ab-tech",
    );
  });

  it("provides an accessible interactive full-screen view", () => {
    const ids = [
      "school_stage:class-10",
      "stream:science-pcm",
      "exam:entrance",
      "degree:bachelors",
      "training:internship",
      "job_role:junior",
      "job_role:senior",
      "degree:mba",
    ];
    const titles = [
      "Class 10",
      "Science PCM",
      "Entrance Exam",
      "Bachelor's Degree",
      "Internship",
      "Junior Role",
      "Senior Role",
      "MBA",
    ];
    render(
      <RouteMap
        defaultRoutes={[route(ids, titles)]}
        parentRoutes={{}}
        targetId="degree:mba"
        targetTitle="MBA"
        requestedParentId={null}
      />,
    );

    // The fitted inline pane shows the whole map — no inline jump buttons.
    expect(
      screen.queryByRole("button", { name: "Jump to Class 10" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("flow")).toHaveAttribute(
      "data-pan-on-drag",
      "false",
    );

    const expand = screen.getByRole("button", { name: "Expand route map" });
    fireEvent.click(expand);
    const dialog = screen.getByRole("dialog", {
      name: "Routes from Class 10",
    });
    expect(dialog).toBeVisible();
    const flows = screen.getAllByTestId("flow");
    expect(flows).toHaveLength(2);
    expect(flows[1]).toHaveAttribute("data-pan-on-drag", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Jump to MBA in expanded map" }),
    );
    expect(flowApi.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: "degree:mba" }] }),
    );

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable.at(-1)!;
    lastFocusable.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(firstFocusable).toHaveFocus();
    firstFocusable.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastFocusable).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Close route map" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(expand).toHaveFocus();

    fireEvent.click(expand);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a stable empty state", () => {
    render(
      <RouteMap
        defaultRoutes={[]}
        parentRoutes={{}}
        targetId="degree:mba"
        targetTitle="MBA"
        requestedParentId={null}
      />,
    );

    expect(screen.getByText("No complete route mapped yet.")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Career routes from Class 10" }),
    ).not.toBeInTheDocument();
  });
});
