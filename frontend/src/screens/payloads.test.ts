import { describe, it, expect } from "vitest";
import { buildInventoryPayload, buildProductPayload, type ManualFormValues } from "./ManualEntry";
import { normalizeTypedEan } from "./Scan";
import { localIsoDate } from "@/utils/date";

/** Form values with every optional field empty, used as a base for the tests. */
const EMPTY_VALUES: ManualFormValues = {
  ean: "8410376003139",
  name: "Leche",
  brand: "",
  quantity: "3",
  threshold: "1",
  unit: "",
  location: "freezer",
  drawer: null,
  frozen_at: "",
  kcal_per_100g: "",
  proteins_per_100g: "3.2",
  carbs_per_100g: "",
  fat_per_100g: "",
};

describe("buildProductPayload", () => {
  it("test_buildProductPayload_emptyBrand_omitsBrandField", () => {
    expect(buildProductPayload(EMPTY_VALUES)).not.toHaveProperty("brand");
  });

  it("test_buildProductPayload_filledBrand_includesBrand", () => {
    expect(buildProductPayload({ ...EMPTY_VALUES, brand: "Hacendado" }).brand).toBe("Hacendado");
  });

  it("test_buildProductPayload_nutritionFields_parsesDecimalsOrLeavesUndefined", () => {
    const payload = buildProductPayload(EMPTY_VALUES);
    expect(payload.proteins_per_100g).toBe(3.2);
    expect(payload.kcal_per_100g).toBeUndefined();
  });
});

describe("buildInventoryPayload", () => {
  it("test_buildInventoryPayload_emptyUnit_usesDefaultUnit", () => {
    expect(buildInventoryPayload(EMPTY_VALUES).unit).toBe("units");
  });

  it("test_buildInventoryPayload_numericStrings_convertsToIntegers", () => {
    const payload = buildInventoryPayload(EMPTY_VALUES);
    expect(payload.quantity).toBe(3);
    expect(payload.threshold).toBe(1);
  });

  it("test_buildInventoryPayload_nonNumericQuantity_usesDefaultQuantity", () => {
    expect(buildInventoryPayload({ ...EMPTY_VALUES, quantity: "" }).quantity).toBe(1);
  });

  it("test_buildInventoryPayload_location_keepsSelectedLocation", () => {
    expect(buildInventoryPayload(EMPTY_VALUES).location).toBe("freezer");
  });
});

describe("buildInventoryPayload — freezer fields", () => {
  it("test_buildInventoryPayload_freezerWithDrawerAndDate_sendsBoth", () => {
    const payload = buildInventoryPayload({ ...EMPTY_VALUES, drawer: 3, frozen_at: "2026-10-01" });
    expect(payload).toMatchObject({ location: "freezer", drawer: 3, frozen_at: "2026-10-01" });
  });

  it("test_buildInventoryPayload_freezerWithoutDate_usesToday", () => {
    expect(buildInventoryPayload(EMPTY_VALUES)).toMatchObject({ frozen_at: localIsoDate() });
  });

  it("test_buildInventoryPayload_pantry_omitsFreezerFields", () => {
    const payload = buildInventoryPayload({ ...EMPTY_VALUES, location: "pantry", drawer: 2, frozen_at: "2026-10-01" });
    expect(payload).not.toHaveProperty("drawer");
    expect(payload).not.toHaveProperty("frozen_at");
  });

  it("test_buildInventoryPayload_decimalQuantityAndZeroThreshold_areKept", () => {
    const payload = buildInventoryPayload({ ...EMPTY_VALUES, quantity: "0,5", threshold: "0" });
    expect(payload).toMatchObject({ quantity: 0.5, threshold: 0 });
  });
});

describe("normalizeTypedEan", () => {
  it("test_normalizeTypedEan_validCodeWithSpaces_returnsTrimmedCode", () => {
    expect(normalizeTypedEan("  8410376003139 ")).toBe("8410376003139");
  });

  it("test_normalizeTypedEan_gs1Url_returnsEanFromUrl", () => {
    expect(normalizeTypedEan("https://qrtrack.mercadona.es/01/08410376003139/10/X")).toBe("8410376003139");
  });

  it("test_normalizeTypedEan_invalidText_returnsNull", () => {
    expect(normalizeTypedEan("hola")).toBeNull();
  });
});
