import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { V2Edge, V2Route } from "@/lib/v2/types";
import RouteMapFromQuery, { RouteMap } from "../RouteMap";

const navigation = vi.hoisted(() => ({ from: null as string | null }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "from" ? navigation.from : null),
  }),
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
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
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

  it("provides jump controls and an accessible full-screen view for long maps", () => {
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

    expect(
      screen.getByRole("button", { name: "Jump to Class 10" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Jump to MBA" })).toBeVisible();
    const viewport = screen.getByRole("region", {
      name: "Career routes from Class 10",
    });
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 900 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    fireEvent.scroll(viewport);
    expect(screen.getByText("Scroll to continue ↓")).toBeVisible();
    viewport.scrollTop = 500;
    fireEvent.scroll(viewport);
    expect(screen.queryByText("Scroll to continue ↓")).not.toBeInTheDocument();
    const expand = screen.getByRole("button", { name: "Expand route map" });
    fireEvent.click(expand);
    const dialog = screen.getByRole("dialog", {
      name: "Routes from Class 10",
    });
    expect(dialog).toBeVisible();
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
