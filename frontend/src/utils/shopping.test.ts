import { describe, it, expect } from "vitest";
import { sortByChecked } from "./shopping";

describe("sortByChecked", () => {
  it("test_sortByChecked_pickedUpLinesGoToTheEnd", () => {
    const lines = [
      { ean: "a", checked: true },
      { ean: "b", checked: false },
      { ean: "c", checked: false },
    ];
    expect(sortByChecked(lines).map((line) => line.ean)).toEqual(["b", "c", "a"]);
  });

  it("test_sortByChecked_eachGroupKeepsItsOwnOrder", () => {
    const lines = [
      { ean: "a", checked: true },
      { ean: "b", checked: true },
      { ean: "c", checked: false },
      { ean: "d", checked: false },
    ];
    expect(sortByChecked(lines).map((line) => line.ean)).toEqual(["c", "d", "a", "b"]);
  });

  it("test_sortByChecked_nothingChecked_keepsTheOrder", () => {
    const lines = [{ ean: "a", checked: false }, { ean: "b", checked: false }];
    expect(sortByChecked(lines)).toEqual(lines);
  });

  it("test_sortByChecked_emptyList_returnsAnEmptyList", () => {
    expect(sortByChecked([])).toEqual([]);
  });

  it("test_sortByChecked_neverMutatesTheInput", () => {
    const lines = [{ ean: "a", checked: true }, { ean: "b", checked: false }];
    const copy = [...lines];
    sortByChecked(lines);
    expect(lines).toEqual(copy);
  });
});
