import { describe, expect, it } from "vitest";
import { filterDirectory } from "../search";
import type { V2DirectoryNode } from "../types";

const nodes: V2DirectoryNode[] = [
  {
    id: "degree:bca",
    type: "degree",
    title: "BCA",
    aliases: ["Bachelor of Computer Applications"],
    description: "",
    href: "/careers/degree/bca",
    incomingCount: 1,
    outgoingCount: 2,
  },
  {
    id: "job_role:product-manager",
    type: "job_role",
    title: "Product Manager",
    aliases: [],
    description: "",
    href: "/careers/job_role/product-manager",
    incomingCount: 4,
    outgoingCount: 0,
  },
];

describe("filterDirectory", () => {
  it("matches titles and aliases case-insensitively", () => {
    expect(
      filterDirectory(nodes, "computer applications", "all").map(
        (item) => item.id,
      ),
    ).toEqual(["degree:bca"]);
  });

  it("applies a node-type filter", () => {
    expect(
      filterDirectory(nodes, "", "job_role").map((item) => item.id),
    ).toEqual(["job_role:product-manager"]);
  });
});
