import { describe, expect, it } from "vitest";
import { exploreHref, nodeHref, nodeIdFromRoute, splitNodeId } from "../urls";

describe("v2 URLs", () => {
  it("round-trips an immutable node id", () => {
    expect(splitNodeId("degree:mba")).toEqual({ type: "degree", slug: "mba" });
    expect(nodeIdFromRoute("degree", "mba")).toBe("degree:mba");
  });

  it("builds canonical blog and contextual explorer URLs", () => {
    expect(nodeHref("degree:mba")).toBe("/careers/degree/mba");
    expect(nodeHref("degree:mba", "degree:bca")).toBe(
      "/careers/degree/mba?from=degree%3Abca",
    );
    expect(exploreHref("degree:mba")).toBe("/explore/degree/mba");
    expect(exploreHref("degree:mba", "degree:bca")).toBe(
      "/explore/degree/mba?from=degree%3Abca",
    );
  });

  it("rejects malformed ids", () => {
    expect(() => splitNodeId("mba")).toThrow("Invalid v2 node id");
  });
});
