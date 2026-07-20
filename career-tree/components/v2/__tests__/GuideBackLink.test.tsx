import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GuideBackLink from "../GuideBackLink";

const { back, push } = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push }),
}));

describe("GuideBackLink", () => {
  beforeEach(() => {
    back.mockReset();
    push.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns to the previous browser-history entry", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    render(<GuideBackLink nodeId="degree:mba" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Back to previous page" }),
    );

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the node explorer when there is no previous history entry", () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    render(<GuideBackLink nodeId="degree:mba" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Back to previous page" }),
    );

    expect(push).toHaveBeenCalledWith("/explore/degree/mba");
    expect(back).not.toHaveBeenCalled();
  });
});
