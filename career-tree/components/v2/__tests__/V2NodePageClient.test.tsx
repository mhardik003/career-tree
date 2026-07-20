import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { V2NodePageView, V2ParentContext } from "@/lib/v2/types";
import V2NodePageClient from "../V2NodePageClient";

const navigation = vi.hoisted(() => ({ from: null as string | null }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "from" ? navigation.from : null),
  }),
}));

vi.mock("../V2FocusView", () => ({
  default: ({ view }: { view: V2NodePageView }) => (
    <p>
      Selected: {view.selectedParentId ?? "none"} back: {view.backHref}
    </p>
  ),
}));

const canonicalView = {
  selectedParentId: "degree:default",
  backHref: "/explore/degree/default",
  routes: [],
} as unknown as V2NodePageView;
const bcaContext: V2ParentContext = {
  routes: [],
  selectedParentId: "degree:bca",
  backHref: "/explore/degree/bca",
};

describe("V2NodePageClient", () => {
  beforeEach(() => {
    navigation.from = null;
  });

  it("overlays a precomputed valid parent context from the query string", () => {
    navigation.from = "degree:bca";
    render(
      <V2NodePageClient
        canonicalView={canonicalView}
        parentContexts={{ "degree:bca": bcaContext }}
      />,
    );
    expect(
      screen.getByText("Selected: degree:bca back: /explore/degree/bca"),
    ).toBeInTheDocument();
  });

  it("falls back to the canonical context for an invalid parent", () => {
    navigation.from = "degree:missing";
    render(
      <V2NodePageClient
        canonicalView={canonicalView}
        parentContexts={{ "degree:bca": bcaContext }}
      />,
    );
    expect(
      screen.getByText("Selected: degree:default back: /explore/degree/default"),
    ).toBeInTheDocument();
  });

  it.each(["__proto__", "constructor", "toString"])(
    "falls back for inherited object key %s",
    (inheritedKey) => {
      navigation.from = inheritedKey;
      render(
        <V2NodePageClient
          canonicalView={canonicalView}
          parentContexts={{ "degree:bca": bcaContext }}
        />,
      );
      expect(
        screen.getByText(
          "Selected: degree:default back: /explore/degree/default",
        ),
      ).toBeInTheDocument();
    },
  );
});
