import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SuggestChildCard from "../SuggestChildCard";

const TRIGGER_NAME = "Suggest a further option after MBA";

describe("SuggestChildCard", () => {
  it("opens the suggestion dialog bound to the parent node", () => {
    render(<SuggestChildCard parentNodeId="degree:mba" parentTitle="MBA" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Suggest a next option after MBA" }),
    ).toBeInTheDocument();
  });

  it("restores focus to the trigger when the dialog closes", () => {
    render(<SuggestChildCard parentNodeId="degree:mba" parentTitle="MBA" />);
    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
