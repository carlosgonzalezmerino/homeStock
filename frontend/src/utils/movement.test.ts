import { describe, it, expect } from "vitest";
import { reasonForChange } from "./movement";

describe("reasonForChange", () => {
  it("test_reasonForChange_quantityGoesDown_returnsConsume", () => {
    expect(reasonForChange(3, 2)).toBe("consume");
  });

  it("test_reasonForChange_quantityGoesUp_returnsPurchase", () => {
    expect(reasonForChange(2, 3)).toBe("purchase");
  });

  it("test_reasonForChange_fractionalDecrease_returnsConsume", () => {
    expect(reasonForChange(1, 0.5)).toBe("consume");
  });

  it("test_reasonForChange_sameQuantity_returnsPurchase", () => {
    // The backend writes no movement for an unchanged quantity, so the label never matters.
    expect(reasonForChange(2, 2)).toBe("purchase");
  });
});
