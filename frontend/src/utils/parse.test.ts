import { describe, it, expect } from "vitest";
import {
  parseDecimal,
  parseQuantity,
  QUANTITY_RANGE_MESSAGE,
  REQUIRED_MESSAGE,
  validateOptionalQuantity,
  validateRequiredQuantity,
} from "./parse";

describe("parseDecimal", () => {
  it.each([
    ["0,5", 0.5],
    ["0.5", 0.5],
    ["0", 0],
    ["2", 2],
    ["1,25", 1.25],
    [" 3 ", 3],
  ])("test_parseDecimal_validText_%s_returnsNumber", (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["abc", "letters"],
    ["-1", "negative"],
    ["1,234", "three decimals"],
    ["1,5,5", "two separators"],
  ])("test_parseDecimal_invalidText_%s_returnsNull", (text) => {
    expect(parseDecimal(text)).toBeNull();
  });
});

describe("parseQuantity", () => {
  it("test_parseQuantity_validText_returnsNumber", () => {
    expect(parseQuantity("0,5", 1)).toBe(0.5);
  });

  it("test_parseQuantity_invalidText_returnsFallback", () => {
    expect(parseQuantity("abc", 4)).toBe(4);
  });
});

describe("validateRequiredQuantity", () => {
  it("test_validateRequiredQuantity_emptyText_returnsRequired", () => {
    expect(validateRequiredQuantity("  ")).toBe(REQUIRED_MESSAGE);
  });

  it("test_validateRequiredQuantity_zero_returnsNull", () => {
    expect(validateRequiredQuantity("0")).toBeNull();
  });

  it("test_validateRequiredQuantity_negative_returnsRangeMessage", () => {
    expect(validateRequiredQuantity("-1")).toBe(QUANTITY_RANGE_MESSAGE);
  });
});

describe("validateOptionalQuantity", () => {
  it("test_validateOptionalQuantity_emptyText_returnsNull", () => {
    expect(validateOptionalQuantity("")).toBeNull();
  });

  it("test_validateOptionalQuantity_letters_returnsRangeMessage", () => {
    expect(validateOptionalQuantity("abc")).toBe(QUANTITY_RANGE_MESSAGE);
  });
});
