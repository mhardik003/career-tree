import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import SuggestChildCard from "../SuggestChildCard";

const suggestionDialogProps = vi.hoisted(() => vi.fn());

// SuggestChildCard now mounts SuggestionDialog only while open (FIX 1), so
// this mock renders unconditionally and just wires Escape -> onClose, which
// is enough for the pre-existing dialog-open and focus-restore assertions
// below while letting the new test inspect exactly what props reached it.
vi.mock("../SuggestionDialog", () => ({
  default: function MockSuggestionDialog(props: {
    isOpen: boolean;
    onClose: () => void;
    parentNodeId: string;
    parentTitle: string;
  }) {
    suggestionDialogProps(props);
    const { onClose, parentTitle } = props;
    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") onClose();
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, [onClose]);
    return (
      <div role="dialog" aria-modal="true">
        <h2>Suggest a next option after {parentTitle}</h2>
      </div>
    );
  },
}));

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

  it("passes the parent node id through to the suggestion dialog", () => {
    render(<SuggestChildCard parentNodeId="degree:mba" parentTitle="MBA" />);

    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));

    expect(suggestionDialogProps).toHaveBeenCalledWith(
      expect.objectContaining({ parentNodeId: "degree:mba" }),
    );
  });
});
