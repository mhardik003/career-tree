import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { V2NodePageView } from "@/lib/v2/types";
import V2NodePageClient from "../V2NodePageClient";

const navigation = vi.hoisted(() => ({ from: null as string | null }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "from" ? navigation.from : null),
  }),
}));

vi.mock("../V2FocusView", () => ({
  default: ({ view }: { view: V2NodePageView }) => (
    <p>Selected: {view.selectedParentId ?? "none"}</p>
  ),
}));

const canonicalView = {
  selectedParentId: "degree:default",
} as V2NodePageView;
const bcaView = { selectedParentId: "degree:bca" } as V2NodePageView;

describe("V2NodePageClient", () => {
  beforeEach(() => {
    navigation.from = null;
  });

  it("selects a precomputed valid parent context from the query string", () => {
    navigation.from = "degree:bca";
    render(
      <V2NodePageClient
        canonicalView={canonicalView}
        parentViews={{ "degree:bca": bcaView }}
      />,
    );
    expect(screen.getByText("Selected: degree:bca")).toBeInTheDocument();
  });

  it("falls back to the canonical context for an invalid parent", () => {
    navigation.from = "degree:missing";
    render(
      <V2NodePageClient
        canonicalView={canonicalView}
        parentViews={{ "degree:bca": bcaView }}
      />,
    );
    expect(screen.getByText("Selected: degree:default")).toBeInTheDocument();
  });

  it.each(["__proto__", "constructor", "toString"])(
    "falls back for inherited object key %s",
    (inheritedKey) => {
      navigation.from = inheritedKey;
      render(
        <V2NodePageClient
          canonicalView={canonicalView}
          parentViews={{ "degree:bca": bcaView }}
        />,
      );
      expect(screen.getByText("Selected: degree:default")).toBeInTheDocument();
    },
  );
});
