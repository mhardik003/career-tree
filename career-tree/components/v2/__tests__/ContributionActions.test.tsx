import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { V2Node } from "@/lib/v2/types";
import ContributionActions from "../ContributionActions";

const node: V2Node = {
  id: "degree:bca",
  type: "degree",
  slug: "bca",
  title: "BCA",
  aliases: [],
  description: "Computing degree",
  is_terminal: false,
  needs_review: false,
  prov: { model: "fixture", prompt_version: "v2", generated_at: "2026-07-19", source_urls: [] },
};

describe("ContributionActions", () => {
  it("opens one focused contribution dialog at a time", () => {
    render(<ContributionActions node={node} />);

    fireEvent.click(screen.getByRole("button", { name: "Suggest a next option" }));
    expect(screen.getByRole("dialog", { name: "Suggest a next option after BCA" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Suggest an edit to BCA" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close suggestion dialog" }));

    fireEvent.click(screen.getByRole("button", { name: "Suggest an edit" }));
    expect(screen.getByRole("dialog", { name: "Suggest an edit to BCA" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Suggest a next option after BCA" })).not.toBeInTheDocument();
  });
});
