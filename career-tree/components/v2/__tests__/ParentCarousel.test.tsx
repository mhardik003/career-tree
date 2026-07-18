import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { V2ParentView } from "@/lib/v2/types";
import ParentCarousel from "../ParentCarousel";

const prov = {
  model: "test",
  prompt_version: "v2.0",
  generated_at: "2026-07-17",
  source_urls: [],
};

const parents: V2ParentView[] = ["a", "b", "c"].map((slug) => ({
  node: {
    id: `degree:${slug}`,
    type: "degree",
    slug,
    title: slug.toUpperCase(),
    aliases: [],
    description: "",
    is_terminal: false,
    needs_review: false,
    prov,
  },
  edge: {
    id: `degree:${slug}->degree:mba`,
    from_id: `degree:${slug}`,
    to_id: "degree:mba",
    edge_type: "progression",
    is_common_route: true,
    prov,
  },
  contextHref: `/careers/degree/mba?from=degree%3A${slug}`,
}));

describe("ParentCarousel", () => {
  it("wraps selection without rendering a separate label block", () => {
    const onSelect = vi.fn();
    render(
      <ParentCarousel
        currentTitle="MBA"
        parents={parents}
        selectedId="degree:a"
        selectedParentHref="/careers/degree/a"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("link", { name: "Open parent A" })).toHaveAttribute(
      "href",
      "/careers/degree/a",
    );
    expect(screen.queryByText(/Other ways to reach/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Parent 1 of 3/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Selected parent A, 1 of 3",
    );
    expect(
      screen.getByRole("group", { name: "Ways to reach MBA" }),
    ).toHaveClass("focus-visible:ring-2");
    expect(screen.getByTestId("parent-carousel-track")).toHaveClass(
      "grid-cols-3",
      "lg:grid-cols-5",
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous parent" }));
    expect(onSelect).toHaveBeenCalledWith(parents[2]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Selected parent C, 3 of 3",
    );
  });

  it("selects a visible parent and handles ArrowRight", () => {
    const onSelect = vi.fn();
    render(
      <ParentCarousel
        currentTitle="MBA"
        parents={parents}
        selectedId="degree:a"
        selectedParentHref="/careers/degree/a"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select parent B" }));
    expect(onSelect).toHaveBeenCalledWith(parents[1]);
    fireEvent.keyDown(
      screen.getByRole("group", { name: "Ways to reach MBA" }),
      { key: "ArrowRight" },
    );
    expect(onSelect).toHaveBeenLastCalledWith(parents[2]);
  });
});
