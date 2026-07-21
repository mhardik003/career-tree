import { act, fireEvent, render, screen } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { V2GlobalMap } from "@/lib/v2/global-map";
import MapView from "../MapView";

const push = vi.fn();
type TestFlowNode = { id: string; data: { label: string } };
type TestFlowProps = {
  nodes: TestFlowNode[];
  edges: unknown[];
  onNodeClick: (event: MouseEvent, node: TestFlowNode) => void;
  children: ReactNode;
};
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, edges, onNodeClick, children }: TestFlowProps) => (
    <div data-testid="flow" data-edges={edges.length}>
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={(event) => onNodeClick(event, node)}>
          {node.data.label}
        </button>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
  BackgroundVariant: { Lines: "lines" },
}));

const model: V2GlobalMap = {
  nodes: [
    {
      id: "degree:bca",
      title: "BCA",
      aliases: ["Bachelor of Computer Applications"],
      type: "degree",
      href: "/careers/degree/bca",
      isTerminal: false,
      rootDistance: 2,
      position: { x: 0, y: 0 },
    },
    {
      id: "degree:mba",
      title: "MBA",
      aliases: ["Master of Business Administration"],
      type: "degree",
      href: "/careers/degree/mba",
      isTerminal: false,
      rootDistance: 3,
      position: { x: 200, y: 100 },
    },
  ],
  edges: [{
    id: "degree:bca->degree:mba",
    source: "degree:bca",
    target: "degree:mba",
    edgeType: "progression",
    isCommonRoute: true,
  }],
  types: ["degree"],
};

describe("V2 MapView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters canonical nodes after the debounce and navigates to their guide", () => {
    render(<MapView model={model} />);
    expect(screen.getByRole("searchbox", { name: "Search map nodes" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Filter map by node type" })).toBeVisible();
    expect(screen.getByTestId("controls")).toBeVisible();
    expect(screen.getByTestId("minimap")).toBeVisible();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "business administration" } });
    // The refilter is debounced: BCA is still on the map until it elapses.
    expect(screen.getByRole("button", { name: "BCA" })).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole("button", { name: "BCA" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "MBA" }));
    expect(push).toHaveBeenCalledWith("/careers/degree/mba");
    expect(screen.getByTestId("flow")).toHaveAttribute("data-edges", "0");
  });
});
