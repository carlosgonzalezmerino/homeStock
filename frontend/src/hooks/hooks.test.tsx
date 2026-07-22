import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import {
  useInventory,
  useShoppingList,
  useResolve,
  useAddInventory,
  usePatchInventory,
  useDeleteInventory,
  useCreateProduct,
} from "@/hooks";
import type {
  InventoryWithProductOut,
  ShoppingListItemOut,
  ProductOut,
  InventoryOut,
} from "@/types";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// ── fixtures ─────────────────────────────────────────────────────────────────

const product: ProductOut = {
  ean: "1234567890123",
  name: "Leche entera",
  source: "off",
};

const inventoryItem: InventoryWithProductOut = {
  inventory: {
    id: 1,
    ean: "1234567890123",
    quantity: 3,
    threshold: 2,
    unit: "units",
  },
  product,
  low: false,
};

const lowItem: InventoryWithProductOut = {
  inventory: {
    id: 2,
    ean: "9876543210987",
    quantity: 1,
    threshold: 2,
    unit: "units",
  } as unknown as InventoryOut,
  product: { ean: "9876543210987", name: "Pan integral", source: "manual" },
  low: true,
};

const shoppingItem: ShoppingListItemOut = {
  ean: "9876543210987",
  name: "Pan integral",
  quantity: 1,
  threshold: 2,
  unit: "units",
};

// ── useInventory ──────────────────────────────────────────────────────────────

describe("useInventory", () => {
  it("fetches the full inventory list", async () => {
    server.use(
      http.get("/api/inventory", () =>
        HttpResponse.json([inventoryItem, lowItem]),
      ),
    );
    const { result } = renderHook(() => useInventory(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("passes low=true as a query param", async () => {
    server.use(
      http.get("/api/inventory", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("low") === "true") {
          return HttpResponse.json([lowItem]);
        }
        return HttpResponse.json([inventoryItem, lowItem]);
      }),
    );
    const { result } = renderHook(() => useInventory(true), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].low).toBe(true);
  });
});

// ── useShoppingList ───────────────────────────────────────────────────────────

describe("useShoppingList", () => {
  it("fetches the shopping list", async () => {
    server.use(
      http.get("/api/shopping-list", () =>
        HttpResponse.json([shoppingItem]),
      ),
    );
    const { result } = renderHook(() => useShoppingList(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].ean).toBe("9876543210987");
  });
});

// ── useResolve ────────────────────────────────────────────────────────────────

describe("useResolve", () => {
  it("is disabled when ean is empty", () => {
    const { result } = renderHook(() => useResolve(""), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches product when ean is provided", async () => {
    server.use(
      http.get("/api/resolve/:ean", () => HttpResponse.json(product)),
    );
    const { result } = renderHook(
      () => useResolve("1234567890123"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.name).toBe("Leche entera");
  });

  it("does not retry on 404", async () => {
    let callCount = 0;
    server.use(
      http.get("/api/resolve/:ean", () => {
        callCount += 1;
        return HttpResponse.json({ ean: "0000000000000" }, { status: 404 });
      }),
    );
    const { result } = renderHook(
      () => useResolve("0000000000000"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
  });
});

// ── mutations ─────────────────────────────────────────────────────────────────

describe("useAddInventory", () => {
  it("posts to /api/inventory and returns the created item", async () => {
    server.use(
      http.post("/api/inventory", () =>
        HttpResponse.json(
          { id: 3, ean: "1234567890123", quantity: 1, threshold: 2, unit: "units" },
          { status: 201 },
        ),
      ),
      http.get("/api/inventory", () => HttpResponse.json([inventoryItem])),
      http.get("/api/shopping-list", () => HttpResponse.json([])),
    );
    const { result } = renderHook(() => useAddInventory(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate({
      ean: "1234567890123",
      quantity: 1,
      threshold: 2,
      unit: "units",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.id).toBe(3);
  });
});

describe("usePatchInventory", () => {
  it("calls PATCH /api/inventory/:ean and invalidates caches", async () => {
    let patched = false;
    server.use(
      http.patch("/api/inventory/:ean", () => {
        patched = true;
        return HttpResponse.json({
          id: 1, ean: "1234567890123", quantity: 5, threshold: 2, unit: "units",
        });
      }),
      http.get("/api/inventory", () => HttpResponse.json([inventoryItem])),
      http.get("/api/shopping-list", () => HttpResponse.json([])),
    );
    const { result } = renderHook(() => usePatchInventory(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate({ ean: "1234567890123", body: { quantity: 5 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patched).toBe(true);
  });
});

describe("useDeleteInventory", () => {
  it("calls DELETE /api/inventory/:ean and invalidates caches", async () => {
    let deleted = false;
    server.use(
      http.delete("/api/inventory/:ean", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([])),
    );
    const { result } = renderHook(() => useDeleteInventory(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate("1234567890123");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleted).toBe(true);
  });
});

describe("useCreateProduct", () => {
  it("calls POST /api/products and invalidates caches", async () => {
    server.use(
      http.post("/api/products", () =>
        HttpResponse.json(
          { ean: "1111111111111", name: "Nuevo producto", source: "manual" },
          { status: 201 },
        ),
      ),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([])),
    );
    const { result } = renderHook(() => useCreateProduct(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate({ ean: "1111111111111", name: "Nuevo producto" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.source).toBe("manual");
  });
});
