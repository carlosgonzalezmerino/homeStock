import { describe, it, expect, vi, afterEach } from "vitest";
import { extractEan, isValidEan } from "./ean";
import { generateCustomEan, CUSTOM_EAN_PREFIX, CUSTOM_EAN_RANDOM_LENGTH } from "./customEan";
import { computeStockStatus, isPantryLocation, locationLabel } from "./stock";
import { describeError } from "./errors";
import { parseOptionalDecimal } from "./parse";
import { computeFillPercentage } from "@/components/LevelBar";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractEan", () => {
  it("test_extractEan_gs1UrlWithLeadingZero_returnsEan13", () => {
    expect(extractEan("https://qrtrack.mercadona.es/01/08410376003139/10/X")).toBe("8410376003139");
  });

  it("test_extractEan_gs1UrlWithoutLeadingZero_returnsGtin14Unchanged", () => {
    expect(extractEan("https://qrtrack.mercadona.es/01/18410376003139/10/X")).toBe("18410376003139");
  });

  it("test_extractEan_plainCode_returnsInputUnchanged", () => {
    expect(extractEan("8410376003139")).toBe("8410376003139");
  });
});

describe("isValidEan", () => {
  it("test_isValidEan_eightDigits_returnsTrue", () => {
    expect(isValidEan("12345678")).toBe(true);
  });

  it("test_isValidEan_thirteenDigits_returnsTrue", () => {
    expect(isValidEan("8410376003139")).toBe(true);
  });

  it("test_isValidEan_elevenDigits_returnsFalse", () => {
    expect(isValidEan("12345678901")).toBe(false);
  });

  it("test_isValidEan_textWithLetters_returnsFalse", () => {
    expect(isValidEan("84103ABC3139")).toBe(false);
  });

  it("test_isValidEan_emptyString_returnsFalse", () => {
    expect(isValidEan("")).toBe(false);
  });
});

describe("generateCustomEan", () => {
  it("test_generateCustomEan_anyCall_startsWithPrefix", () => {
    expect(generateCustomEan().startsWith(CUSTOM_EAN_PREFIX)).toBe(true);
  });

  it("test_generateCustomEan_anyCall_hasExpectedLength", () => {
    expect(generateCustomEan()).toHaveLength(CUSTOM_EAN_PREFIX.length + CUSTOM_EAN_RANDOM_LENGTH);
  });

  it("test_generateCustomEan_fixedRandomSource_usesAlphabetCharacters", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(generateCustomEan()).toBe("CUSTOM-AAAAAAAA");
  });
});

describe("computeStockStatus", () => {
  it("test_computeStockStatus_quantityZero_returnsEmpty", () => {
    expect(computeStockStatus(0, 2)).toBe("empty");
  });

  it("test_computeStockStatus_quantityEqualsThreshold_returnsOk", () => {
    expect(computeStockStatus(2, 2)).toBe("ok");
  });

  it("test_computeStockStatus_quantityBelowThreshold_returnsLow", () => {
    expect(computeStockStatus(1, 2)).toBe("low");
  });

  it("test_computeStockStatus_halfUnitWithZeroThreshold_returnsOk", () => {
    expect(computeStockStatus(0.5, 0)).toBe("ok");
  });

  it("test_computeStockStatus_quantityAboveThreshold_returnsOk", () => {
    expect(computeStockStatus(3, 2)).toBe("ok");
  });
});

describe("locationLabel", () => {
  it("test_locationLabel_freezer_returnsCongelador", () => {
    expect(locationLabel("freezer")).toBe("Congelador");
  });

  it("test_locationLabel_pantry_returnsDespensa", () => {
    expect(locationLabel("pantry")).toBe("Despensa");
  });
});

describe("isPantryLocation", () => {
  it("test_isPantryLocation_nullLocation_returnsTrue", () => {
    expect(isPantryLocation(null)).toBe(true);
  });

  it("test_isPantryLocation_undefinedLocation_returnsTrue", () => {
    expect(isPantryLocation(undefined)).toBe(true);
  });

  it("test_isPantryLocation_freezerLocation_returnsFalse", () => {
    expect(isPantryLocation("freezer")).toBe(false);
  });
});

describe("describeError", () => {
  it("test_describeError_errorInstance_returnsMessage", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
  });

  it("test_describeError_plainString_returnsString", () => {
    expect(describeError("plain")).toBe("plain");
  });
});

describe("parseOptionalDecimal", () => {
  it("test_parseOptionalDecimal_emptyText_returnsUndefined", () => {
    expect(parseOptionalDecimal("   ")).toBeUndefined();
  });

  it("test_parseOptionalDecimal_decimalText_returnsNumber", () => {
    expect(parseOptionalDecimal("3.5")).toBe(3.5);
  });
});

describe("computeFillPercentage", () => {
  it("test_computeFillPercentage_zeroMax_returnsZeroNotNaN", () => {
    expect(computeFillPercentage(0, 0)).toBe(0);
  });

  it("test_computeFillPercentage_halfFull_returnsFifty", () => {
    expect(computeFillPercentage(5, 10)).toBe(50);
  });

  it("test_computeFillPercentage_overMax_returnsHundred", () => {
    expect(computeFillPercentage(15, 10)).toBe(100);
  });

  it("test_computeFillPercentage_negativeQuantity_returnsZero", () => {
    expect(computeFillPercentage(-1, 10)).toBe(0);
  });
});
