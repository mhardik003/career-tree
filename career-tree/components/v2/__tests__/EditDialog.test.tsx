import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { V2Node } from "@/lib/v2/types";
import EditDialog from "../EditDialog";

const fetchMock = vi.fn();
const node: V2Node = {
  id: "degree:bca",
  type: "degree",
  slug: "bca",
  title: "BCA",
  aliases: ["Bachelor of Computer Applications"],
  description: "Computing degree",
  is_terminal: false,
  needs_review: false,
  prov: {
    model: "fixture",
    prompt_version: "v2",
    generated_at: "2026-07-19",
    source_urls: [],
  },
};

function renderDialog(onClose = vi.fn()) {
  render(<EditDialog isOpen onClose={onClose} node={node} />);
  return onClose;
}

function fillForm() {
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Bachelor of Computer Applications" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "An undergraduate computing degree." },
  });
  fireEvent.change(screen.getByLabelText("Aliases"), {
    target: { value: "BCA" },
  });
}

describe("EditDialog", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  it("submits only editable node fields under the stable target ID", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    renderDialog();
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Submit edit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetNodeId: "degree:bca",
        proposedData: {
          title: "Bachelor of Computer Applications",
          description: "An undergraduate computing degree.",
          aliases: ["BCA"],
        },
      }),
    });
    expect(await screen.findByText("Edit received")).toBeVisible();
  });

  it("retains typed fields after a server failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderDialog();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit edit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByLabelText("Title")).toHaveValue("Bachelor of Computer Applications");
    expect(screen.getByLabelText("Description")).toHaveValue("An undergraduate computing degree.");
    expect(screen.getByLabelText("Aliases")).toHaveValue("BCA");
  });

  it("shows rate-limit copy and supports Escape and backdrop close", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const onClose = renderDialog();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit edit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("wait a minute");

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("edit-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
