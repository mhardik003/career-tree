import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SuggestionDialog from "../SuggestionDialog";

const fetchMock = vi.fn();

function renderDialog(onClose = vi.fn()) {
  render(
    <SuggestionDialog
      isOpen
      onClose={onClose}
      parentNodeId="degree:bca"
      parentTitle="BCA"
    />,
  );
  return onClose;
}

function fillForm() {
  fireEvent.change(screen.getByLabelText("Option title"), {
    target: { value: "Cloud Engineering Certification" },
  });
  fireEvent.change(screen.getByLabelText("Option description"), {
    target: { value: "A focused certification route for cloud infrastructure." },
  });
}

describe("SuggestionDialog", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  it("submits the stable-ID suggestion payload and shows success", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    renderDialog();
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Submit suggestion" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentNodeId: "degree:bca",
        title: "Cloud Engineering Certification",
        description: "A focused certification route for cloud infrastructure.",
      }),
    });
    expect(await screen.findByText("Suggestion received")).toBeVisible();
  });

  it("retains typed content after a server failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderDialog();
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Submit suggestion" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByLabelText("Option title")).toHaveValue("Cloud Engineering Certification");
    expect(screen.getByLabelText("Option description")).toHaveValue(
      "A focused certification route for cloud infrastructure.",
    );
  });

  it("shows rate-limit copy and supports Escape and backdrop close", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const onClose = renderDialog();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit suggestion" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("wait a minute");

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("suggestion-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
