import { describe, it, expect } from "vitest";
import { formatQuantity, roundQuantity } from "./format";
import { parseDecimal } from "./parse";

describe("formatQuantity", () => {
  it("test_formatQuantity_halfUnit_usesDecimalComma", () => {
    expect(formatQuantity(0.5)).toBe("0,5");
  });

  it("test_formatQuantity_wholeNumber_hasNoDecimals", () => {
    expect(formatQuantity(2)).toBe("2");
  });

  it("test_formatQuantity_twoDecimals_keepsBoth", () => {
    expect(formatQuantity(1.25)).toBe("1,25");
  });
});

describe("roundQuantity", () => {
  it("test_roundQuantity_floatingPointStep_removesDrift", () => {
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
  });

  it("test_roundQuantity_moreThanTwoDecimals_roundsToTwo", () => {
    expect(roundQuantity(1.234)).toBe(1.23);
  });
});

describe("formatQuantity and parseDecimal round trip", () => {
  it.each([0, 0.5, 1, 1.25, 99.99, 1000, 12345, 1234567.5])(
    "test_formatQuantity_valueShownToUser_%s_canBeParsedBack",
    (value) => {
      expect(parseDecimal(formatQuantity(value))).toBe(value);
    },
  );

  it("test_formatQuantity_largeNumber_hasNoThousandsSeparator", () => {
    expect(formatQuantity(12345)).toBe("12345");
  });
});
