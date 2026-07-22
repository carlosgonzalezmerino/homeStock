import { describe, it, expect } from "vitest";
import type {
  ProductOut,
  InventoryOut,
  InventoryWithProductOut,
  ShoppingListItemOut,
  InventoryCreate,
  InventoryPatch,
  ProductCreate,
} from "@/types";

describe("api types mirror the backend schema", () => {
  it("ProductOut carries ean/name/source + optional nutrition", () => {
    const p: ProductOut = {
      ean: "8410000000000",
      name: "Leche entera",
      brand: null,
      description: null,
      image_url: null,
      category: null,
      quantity_desc: null,
      source: "off",
      kcal_per_100g: 64,
    };
    expect(p.source).toBe("off");
    expect(p.kcal_per_100g).toBe(64);
  });

  it("InventoryWithProductOut nests inventory + product + low", () => {
    const inv: InventoryOut = {
      id: 1,
      ean: "8410000000000",
      quantity: 2,
      threshold: 1,
      unit: "units",
      location: null,
    };
    const product: ProductOut = { ean: "8410000000000", name: "Leche", source: "off" };
    const row: InventoryWithProductOut = { inventory: inv, product, low: false };
    expect(row.low).toBe(false);
    expect(row.inventory.quantity).toBe(2);
  });

  it("create/patch/product-create shapes accept minimal fields", () => {
    const create: InventoryCreate = { ean: "x", quantity: 1, threshold: 1 };
    const patch: InventoryPatch = { quantity: 0 };
    const prod: ProductCreate = { ean: "x", name: "Manual" };
    const item: ShoppingListItemOut = {
      ean: "x",
      name: "Leche",
      quantity: 0,
      threshold: 1,
      unit: "units",
    };
    expect(create.quantity).toBe(1);
    expect(patch.quantity).toBe(0);
    expect(prod.name).toBe("Manual");
    expect(item.quantity).toBe(0);
  });
});
