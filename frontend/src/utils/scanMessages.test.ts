import { describe, it, expect } from "vitest";
import type { ScanResult } from "@/types";
import { describeScan } from "./scanMessages";

/** A scan answer with the fields a test does not care about filled in. */
function result(overrides: Partial<ScanResult>): ScanResult {
  return { status: "applied", mode: "purchase", ean: "111", name: "Leche", unit: "units", ...overrides };
}

describe("describeScan — purchase", () => {
  it("test_describeScan_purchaseApplied_saysPlusOneAndTheNewTotal", () => {
    const text = describeScan(result({ quantity_after: 4 }));
    expect(text).toMatchObject({ title: "Leche", detail: "+1 · ahora 4 units", tone: "success" });
  });

  it("test_describeScan_purchaseCreated_saysItIsNew", () => {
    expect(describeScan(result({ status: "created", quantity_after: 1 })).detail).toBe(
      "Nuevo en la despensa · 1 units",
    );
  });

  it("test_describeScan_purchaseUnknown_isAWarningThatItWillBeReviewed", () => {
    const text = describeScan(result({ status: "unknown", name: null }));
    expect(text).toMatchObject({ title: "111", detail: "Código sin identificar, queda para revisar", tone: "warning" });
  });

  it("test_describeScan_purchaseNeverLinksToTheShoppingList", () => {
    expect(describeScan(result({ quantity_after: 0 })).linksToShoppingList).toBe(false);
  });
});

describe("describeScan — consume", () => {
  const consume = { mode: "consume" as const };

  it("test_describeScan_consumeApplied_saysMinusOneAndWhatIsLeft", () => {
    const text = describeScan(result({ ...consume, quantity_after: 2 }));
    expect(text).toMatchObject({ detail: "−1 · quedan 2 units", tone: "success", linksToShoppingList: false });
  });

  it("test_describeScan_consumeToZero_saysItIsOnTheShoppingListAndLinksToIt", () => {
    const text = describeScan(result({ ...consume, quantity_after: 0 }));
    expect(text).toMatchObject({
      detail: "Se acabó · ya está en la lista de la compra",
      tone: "success",
      linksToShoppingList: true,
    });
  });

  it("test_describeScan_consumeAlreadyEmpty_isAWarning", () => {
    const text = describeScan(result({ ...consume, status: "already_empty", quantity_after: 0 }));
    expect(text).toMatchObject({ detail: "Ya estaba agotado", tone: "warning", linksToShoppingList: false });
  });

  it("test_describeScan_consumeNotTracked_isAWarning", () => {
    const text = describeScan(result({ ...consume, status: "not_tracked" }));
    expect(text).toMatchObject({ detail: "No está en tu despensa", tone: "warning" });
  });

  it("test_describeScan_consumeUnknown_isAWarning", () => {
    const text = describeScan(result({ ...consume, status: "unknown", name: null }));
    expect(text).toMatchObject({ detail: "Código sin identificar", tone: "warning" });
  });

  it("test_describeScan_fractionLeft_usesTheSharedQuantityFormat", () => {
    expect(describeScan(result({ ...consume, quantity_after: 0.5 })).detail).toBe("−1 · quedan 0,5 units");
  });
});
