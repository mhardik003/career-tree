import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchCareerButton from "../SearchCareerButton";

describe("SearchCareerButton", () => {
  it("scrolls to and focuses the canonical career search", () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<><SearchCareerButton /><input id="career-search" /></>);

    fireEvent.click(screen.getByRole("button", { name: "Search for a career" }));

    expect(document.activeElement).toBe(document.getElementById("career-search"));
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
