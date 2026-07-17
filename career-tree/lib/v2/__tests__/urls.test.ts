import { describe, expect, it } from "vitest";
import { exploreHref, nodeHref, nodeIdFromRoute, splitNodeId } from "../urls";

describe("v2 URLs", () => {
  it("round-trips an immutable node id", () => {
    expect(splitNodeId("degree:mba")).toEqual({ type: "degree", slug: "mba" });
    expect(nodeIdFromRoute("degree", "mba")).toBe("degree:mba");
  });

  it("builds canonical blog and contextual explorer URLs", () => {
    expect(nodeHref("degree:mba")).toBe("/v2/careers/degree/mba");
    expect(exploreHref("degree:mba")).toBe("/v2/explore/degree/mba");
    expect(exploreHref("degree:mba", "degree:bca")).toBe(
      "/v2/explore/degree/mba?from=degree%3Abca",
    );
  });

  it("rejects malformed ids", () => {
    expect(() => splitNodeId("mba")).toThrow("Invalid v2 node id");
  });
});
