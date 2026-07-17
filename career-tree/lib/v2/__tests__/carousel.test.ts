import { describe, expect, it } from "vitest";
import { carouselWindow, moveSelection } from "../carousel";

describe("carouselWindow", () => {
  it("centers the selected parent with two circular neighbors per side", () => {
    expect(carouselWindow(["a", "b", "c", "d", "e", "f"], "a", 5)).toEqual([
      { id: "e", offset: -2 },
      { id: "f", offset: -1 },
      { id: "a", offset: 0 },
      { id: "b", offset: 1 },
      { id: "c", offset: 2 },
    ]);
  });

  it("never clones parents when fewer than five exist", () => {
    expect(
      carouselWindow(["a", "b", "c"], "b", 5)
        .map((item) => item.id)
        .sort(),
    ).toEqual(["a", "b", "c"]);
  });

  it("wraps arrow movement", () => {
    expect(moveSelection(["a", "b", "c"], "a", -1)).toBe("c");
    expect(moveSelection(["a", "b", "c"], "c", 1)).toBe("a");
  });
});
