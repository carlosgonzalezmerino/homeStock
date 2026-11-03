import { describe, it, expect } from "vitest";
import { sortByChecked, suggestedPurchase } from "./shopping";

describe("suggestedPurchase", () => {
  it("test_suggestedPurchase_emptyWithThreshold_buysExactlyTheGap", () => {
    expect(suggestedPurchase(0, 2)).toBe(2);
  });

  it("test_suggestedPurchase_oneBelowThreshold_buysExactlyTheGap", () => {
    expect(suggestedPurchase(1, 2)).toBe(1);
  });

  it("test_suggestedPurchase_emptyWithZeroThreshold_buysOneUnit", () => {
    expect(suggestedPurchase(0, 0)).toBe(1);
  });

  it("test_suggestedPurchase_emptyWithHalfThreshold_buysHalfAUnit", () => {
    expect(suggestedPurchase(0, 0.5)).toBe(0.5);
  });

  it("test_suggestedPurchase_quantityAboveThreshold_neverReturnsNegative", () => {
    expect(suggestedPurchase(5, 2)).toBeGreaterThanOrEqual(0);
  });
});

describe("sortByChecked", () => {
  const a = { ean: "1", name: "A" };
  const b = { ean: "2", name: "B" };
  const c = { ean: "3", name: "C" };

  it("test_sortByChecked_nothingChecked_keepsOriginalOrder", () => {
    expect(sortByChecked([a, b, c], new Set())).toEqual([a, b, c]);
  });

  it("test_sortByChecked_middleItemChecked_movesItToTheEnd", () => {
    expect(sortByChecked([a, b, c], new Set(["2"]))).toEqual([a, c, b]);
  });

  it("test_sortByChecked_doesNotMutateTheInput", () => {
    const items = [a, b, c];
    sortByChecked(items, new Set(["1"]));
    expect(items).toEqual([a, b, c]);
  });
});
