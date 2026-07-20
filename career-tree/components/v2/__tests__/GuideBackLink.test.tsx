import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GuideBackLink from "../GuideBackLink";

const { getSearchParam } = vi.hoisted(() => ({
  getSearchParam: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: getSearchParam }),
}));

describe("GuideBackLink", () => {
  beforeEach(() => getSearchParam.mockReset());

  it("returns to the same explorer parent context", () => {
    getSearchParam.mockReturnValue("degree:bca");
    render(
      <GuideBackLink
        nodeId="degree:mba"
        validParentIds={["degree:bca", "degree:b-tech"]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Back to career tree" }),
    ).toHaveAttribute(
      "href",
      "/explore/degree/mba?from=degree%3Abca",
    );
  });

  it.each([null, "degree:unrelated"])(
    "falls back to the node explorer for context %s",
    (from) => {
      getSearchParam.mockReturnValue(from);
      render(
        <GuideBackLink nodeId="degree:mba" validParentIds={["degree:bca"]} />,
      );

      expect(
        screen.getByRole("link", { name: "Back to career tree" }),
      ).toHaveAttribute("href", "/explore/degree/mba");
    },
  );
});
