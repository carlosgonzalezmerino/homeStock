import { http, HttpResponse } from "msw";
import { HTTP_CREATED, HTTP_NOT_FOUND } from "@/api/status";
import { server } from "@/test/server";
import type { InventoryOut, InventoryWithProductOut, ProductOut } from "@/types";

/** What the fake backend keeps in memory and what it has received. */
export interface FakeBackend {
  products: Map<string, ProductOut>;
  rows: InventoryOut[];
  received: { productPosts: Record<string, unknown>[]; inventoryPosts: Record<string, unknown>[]; patches: Record<string, unknown>[] };
}

/**
 * Joins a stock row with its product and computes the low-stock flag like the real backend.
 *
 * @param row - The stock row.
 * @param product - The product of that row.
 * @returns The item the list endpoint returns.
 */
function toItem(row: InventoryOut, product: ProductOut): InventoryWithProductOut {
  return { inventory: row, product, low: row.quantity === 0 || row.quantity < row.threshold };
}

/**
 * Handlers for the product endpoints: lookup by EAN and creation by hand.
 *
 * @param state - The fake backend's memory.
 * @returns The request handlers.
 */
function productHandlers(state: FakeBackend) {
  return [
    http.get("/api/resolve/:ean", ({ params }) => {
      const product = state.products.get(String(params.ean));
      return product ? HttpResponse.json(product) : HttpResponse.json({ ean: params.ean }, { status: HTTP_NOT_FOUND });
    }),
    http.post("/api/products", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      state.received.productPosts.push(body);
      const product = { ...body, source: "manual" } as unknown as ProductOut;
      state.products.set(product.ean, product);
      return HttpResponse.json(product, { status: HTTP_CREATED });
    }),
  ];
}

/**
 * Handlers for the inventory endpoints: list, add and edit.
 *
 * @param state - The fake backend's memory.
 * @returns The request handlers.
 */
function inventoryHandlers(state: FakeBackend) {
  return [
    http.get("/api/inventory", () =>
      HttpResponse.json(state.rows.map((row) => toItem(row, state.products.get(row.ean) as ProductOut))),
    ),
    http.post("/api/inventory", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      state.received.inventoryPosts.push(body);
      const row = { id: state.rows.length + 1, ...body } as InventoryOut;
      state.rows.push(row);
      return HttpResponse.json(row, { status: HTTP_CREATED });
    }),
    http.patch("/api/inventory/:ean", async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      state.received.patches.push(body);
      const index = state.rows.findIndex((row) => row.ean === params.ean);
      state.rows[index] = { ...state.rows[index], ...body };
      return HttpResponse.json(state.rows[index]);
    }),
  ];
}

/**
 * Installs a small in-memory backend, so a test can walk through several screens.
 *
 * @param initial - Products and stock rows that exist at the start.
 * @returns The memory of the fake backend, to read what was stored and received.
 */
export function installFakeBackend(initial: { products?: ProductOut[]; rows?: InventoryOut[] } = {}): FakeBackend {
  const state: FakeBackend = {
    products: new Map((initial.products ?? []).map((product) => [product.ean, product])),
    rows: [...(initial.rows ?? [])],
    received: { productPosts: [], inventoryPosts: [], patches: [] },
  };
  server.use(...productHandlers(state), ...inventoryHandlers(state));
  return state;
}
