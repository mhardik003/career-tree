import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { V2NodeFacts } from "@/lib/v2/types";
import NodeFacts from "../NodeFacts";

const sharedSource = "https://example.edu/shared";

const facts: V2NodeFacts = {
  schema_version: 1,
  last_reviewed: "2026-07-19",
  quick_facts: [{
    label: "Duration",
    value: "Three years",
    source_urls: ["https://example.edu/duration"],
  }],
  sections: [
    {
      key: "eligibility",
      heading: "Eligibility",
      paragraphs: ["Applicants complete Class 12 before admission."],
      bullets: ["Institution-specific criteria may apply."],
      source_urls: [sharedSource],
    },
    {
      key: "curriculum",
      heading: "Curriculum",
      paragraphs: ["The course covers programming and information systems."],
      bullets: [],
      source_urls: [sharedSource],
    },
  ],
  useful_links: [{
    label: "Official programme directory",
    url: "https://example.edu/programmes",
    kind: "official",
  }],
  prov: {
    model: "gpt-5.6-terra",
    prompt_version: "v2-enrichment-1",
    generated_at: "2026-07-19",
  },
};

describe("NodeFacts", () => {
  it("renders ordered cited facts, sections, links, and review date", () => {
    const { container } = render(<NodeFacts facts={facts} />);

    expect(screen.getByText("Duration")).toBeVisible();
    expect(screen.getByText("Three years")).toBeVisible();
    const article = screen.getByLabelText("Career guide facts");
    const headings = within(article).getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Eligibility",
      "Curriculum",
    ]);
    expect(screen.getByText("Applicants complete Class 12 before admission.")).toBeVisible();
    expect(screen.getByText("Institution-specific criteria may apply.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Official programme directory" })).toHaveAttribute(
      "href",
      "https://example.edu/programmes",
    );
    expect(screen.getByText("19 July 2026")).toHaveAttribute(
      "datetime",
      "2026-07-19",
    );
    expect(container.querySelectorAll(`a[href="${sharedSource}"]`)).toHaveLength(2);
    for (const link of container.querySelectorAll("a[target='_blank']")) {
      expect(link).toHaveAttribute("rel", "noreferrer noopener");
    }
  });

  it("does not render empty optional groups", () => {
    render(<NodeFacts facts={{ ...facts, quick_facts: [], useful_links: [] }} />);

    expect(screen.queryByRole("heading", { name: "Quick facts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Useful links" })).not.toBeInTheDocument();
  });
});
