import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import type { ProductOut, ShoppingListItemOut } from "@/types";
import { ShoppingList } from "./ShoppingList";

/** A list line, with the fields a test does not care about filled in. */
function line(overrides: Partial<ShoppingListItemOut> = {}): ShoppingListItemOut {
  return {
    ean: "1111111111111",
    name: "Leche",
    quantity: 1,
    checked: false,
    in_stock: 2,
    unit: "units",
    image_url: null,
    ...overrides,
  };
}

/** The catalogue the search looks into. */
const CATALOGUE: ProductOut[] = [
  { ean: "3333333333333", name: "Aceite de oliva", brand: "Hacendado", source: "manual" },
  { ean: "4444444444444", name: "Aceite de girasol", source: "manual" },
];

/** What the in-memory backend received, to assert against. */
interface Received {
  posts: Array<Record<string, unknown>>;
  patches: Array<{ ean: string; body: Record<string, unknown> }>;
  deletes: string[];
  purchases: number;
}

/**
 * Serves a stateful shopping list: add, change, remove and purchase behave like the real one.
 *
 * @param initial - The lines on the list at the start.
 * @param options - `failPatch` and `failPurchase` make those calls answer 500.
 * @returns What the backend received.
 */
function mockBackend(initial: ShoppingListItemOut[], options: { failPatch?: boolean; failPurchase?: boolean } = {}) {
  const lines = [...initial];
  const received: Received = { posts: [], patches: [], deletes: [], purchases: 0 };
  server.use(
    http.get("/api/shopping-list", () => HttpResponse.json(lines)),
    http.post("/api/shopping-list/purchase", () => {
      received.purchases += 1;
      if (options.failPurchase) return HttpResponse.json({}, { status: 500 });
      const picked = lines.filter((entry) => entry.checked).length;
      lines.splice(0, lines.length, ...lines.filter((entry) => !entry.checked));
      return HttpResponse.json({ added: picked, created: 0 });
    }),
    http.post("/api/shopping-list", async ({ request }) => {
      const body = (await request.json()) as { ean: string };
      received.posts.push(body);
      const product = CATALOGUE.find((entry) => entry.ean === body.ean) as ProductOut;
      const created = line({ ean: body.ean, name: product.name, in_stock: null });
      lines.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch("/api/shopping-list/:ean", async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      received.patches.push({ ean: String(params.ean), body });
      if (options.failPatch) return HttpResponse.json({}, { status: 500 });
      const index = lines.findIndex((entry) => entry.ean === params.ean);
      lines[index] = { ...lines[index], ...body };
      return HttpResponse.json(lines[index]);
    }),
    http.delete("/api/shopping-list/:ean", ({ params }) => {
      received.deletes.push(String(params.ean));
      lines.splice(0, lines.length, ...lines.filter((entry) => entry.ean !== params.ean));
      return new HttpResponse(null, { status: 204 });
    }),
    http.get("/api/products", ({ request }) => {
      const query = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
      return HttpResponse.json(CATALOGUE.filter((entry) => entry.name.toLowerCase().includes(query)));
    }),
  );
  return received;
}

/** Renders the list with the detail screen its rows open. */
function renderList() {
  return renderInApp(
    <Routes>
      <Route path="/lista" element={<ShoppingList />} />
      <Route path="/despensa/:ean" element={<div>MANAGE_DETAIL</div>} />
      <Route path="/custom-entry" element={<div>CUSTOM_ENTRY</div>} />
    </Routes>,
    ["/lista"],
  );
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("ShoppingList — empty and loading", () => {
  it("test_shoppingList_empty_saysTheListIsEmptyNotThatNothingIsMissing", async () => {
    mockBackend([]);
    renderList();
    expect(await screen.findByText(/Tu lista está vacía/)).toBeInTheDocument();
    expect(screen.queryByText("No falta nada")).not.toBeInTheDocument();
  });

  it("test_shoppingList_loadError_showsRetry", async () => {
    server.use(http.get("/api/shopping-list", () => HttpResponse.json({}, { status: 500 })));
    renderList();
    expect(await screen.findByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});

describe("ShoppingList — lines", () => {
  it("test_shoppingList_line_showsNameAmountAndStockAtHome", async () => {
    mockBackend([line({ quantity: 3, in_stock: 2 })]);
    renderList();
    expect(await screen.findByText("Leche")).toBeInTheDocument();
    expect(screen.getByText("En casa: 2 units")).toBeInTheDocument();
    expect(screen.getByLabelText("cantidad")).toHaveValue("3");
  });

  it("test_shoppingList_productNotInThePantry_saysSo", async () => {
    mockBackend([line({ in_stock: null })]);
    renderList();
    expect(await screen.findByText("No está en la despensa")).toBeInTheDocument();
  });

  it("test_shoppingList_clickName_opensTheProductDetail", async () => {
    mockBackend([line()]);
    renderList();
    fireEvent.click(await screen.findByText("Leche"));
    expect(await screen.findByText("MANAGE_DETAIL")).toBeInTheDocument();
  });

  it("test_shoppingList_everyControlHasAnAccessibleNameWithTheProduct", async () => {
    mockBackend([line()]);
    renderList();
    expect(await screen.findByRole("checkbox", { name: "Leche" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar Leche" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir Leche" })).toBeInTheDocument();
  });
});

describe("ShoppingList — adding from the catalogue", () => {
  it("test_shoppingList_searchAndChooseAResult_addsThatProductAndClearsTheBox", async () => {
    const received = mockBackend([]);
    renderList();
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "aceite" } });
    fireEvent.click(await screen.findByRole("button", { name: /Aceite de oliva/ }));
    await waitFor(() => expect(received.posts).toEqual([{ ean: "3333333333333" }]));
    expect(await screen.findByText("Aceite de oliva")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("test_shoppingList_searchResults_showTheBrandWhenThereIsOne", async () => {
    mockBackend([]);
    renderList();
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "aceite" } });
    expect(await screen.findByText("Hacendado")).toBeInTheDocument();
  });

  it("test_shoppingList_searchWithNoMatch_saysSoAndOffersToCreateAProduct", async () => {
    mockBackend([]);
    renderList();
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "zzzz" } });
    expect(await screen.findByText("Nada en tu catálogo con ese nombre")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Crear un producto" }));
    expect(await screen.findByText("CUSTOM_ENTRY")).toBeInTheDocument();
  });

  it("test_shoppingList_searchShorterThanTwoLetters_doesNotAskTheCatalogue", async () => {
    mockBackend([]);
    let catalogueRequests = 0;
    server.use(
      http.get("/api/products", () => {
        catalogueRequests += 1;
        return HttpResponse.json(CATALOGUE);
      }),
    );
    renderList();
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "a" } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400)); // longer than the quiet period
    });
    expect(catalogueRequests).toBe(0);
    expect(screen.queryByRole("button", { name: /Aceite/ })).not.toBeInTheDocument();
  });
});

describe("ShoppingList — picking up and changing amounts", () => {
  it("test_shoppingList_check_sendsThePatchAndStrikesTheLineThroughAtTheEnd", async () => {
    const received = mockBackend([line(), line({ ean: "2222222222222", name: "Pan" })]);
    renderList();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Leche" }));
    await waitFor(() => expect(received.patches).toEqual([{ ean: "1111111111111", body: { checked: true } }]));
    await waitFor(() => {
      const names = screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"));
      expect(names).toEqual(["Pan", "Leche"]);
    });
    expect(screen.getByText("Leche")).toHaveClass("line-through");
  });

  it("test_shoppingList_check_showsAtOnceWithoutWaitingForTheServer", async () => {
    mockBackend([line()]);
    server.use(
      http.patch("/api/shopping-list/:ean", async () => {
        await delay(400);
        return HttpResponse.json(line({ checked: true }));
      }),
    );
    renderList();
    const box = await screen.findByRole("checkbox", { name: "Leche" });
    fireEvent.click(box);
    await waitFor(() => expect(box).toBeChecked());
  });

  it("test_shoppingList_checkFails_undoesTheMarkAndSaysSo", async () => {
    mockBackend([line()], { failPatch: true });
    renderList();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Leche" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar el cambio");
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Leche" })).not.toBeChecked());
  });

  it("test_shoppingList_checkFails_goesBackAtOnceWithoutWaitingForTheReload", async () => {
    mockBackend([line()], { failPatch: true });
    // After the failure the list is read again; hold that answer back so that only the
    // immediate rollback can explain the mark going away.
    let reads = 0;
    server.use(
      http.get("/api/shopping-list", async () => {
        reads += 1;
        if (reads > 1) await delay(5000);
        return HttpResponse.json([line()]);
      }),
    );
    renderList();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Leche" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("checkbox", { name: "Leche" })).not.toBeChecked();
    expect(reads).toBeGreaterThan(1); // the reload really was started and is still pending
  });

  it("test_shoppingList_plus_raisesTheAmountToBuy", async () => {
    const received = mockBackend([line({ quantity: 2 })]);
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "＋" }));
    await waitFor(() => expect(received.patches).toEqual([{ ean: "1111111111111", body: { quantity: 3 } }]));
    await waitFor(() => expect(screen.getByLabelText("cantidad")).toHaveValue("3"));
  });

  it("test_shoppingList_minusAtOne_removesTheLine", async () => {
    const received = mockBackend([line({ quantity: 1 })]);
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "−" }));
    await waitFor(() => expect(received.deletes).toEqual(["1111111111111"]));
    expect(await screen.findByText(/Tu lista está vacía/)).toBeInTheDocument();
  });

  it("test_shoppingList_minusAboveOne_onlyLowersTheAmount", async () => {
    const received = mockBackend([line({ quantity: 3 })]);
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "−" }));
    await waitFor(() => expect(received.patches[0]?.body).toEqual({ quantity: 2 }));
    expect(received.deletes).toEqual([]);
  });

  it("test_shoppingList_removeButton_takesTheProductOffTheList", async () => {
    const received = mockBackend([line()]);
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Quitar Leche" }));
    await waitFor(() => expect(received.deletes).toEqual(["1111111111111"]));
    expect(await screen.findByText(/Tu lista está vacía/)).toBeInTheDocument();
  });
});

describe("ShoppingList — registering the purchase", () => {
  it("test_shoppingList_purchaseButton_isDisabledWithNothingPickedUp", async () => {
    mockBackend([line()]);
    renderList();
    expect(await screen.findByRole("button", { name: "Añadir al stock (0)" })).toBeDisabled();
  });

  it("test_shoppingList_purchaseButton_showsHowManyArePickedUp", async () => {
    mockBackend([line({ checked: true }), line({ ean: "2", name: "Pan", checked: true }), line({ ean: "3", name: "Sal" })]);
    renderList();
    expect(await screen.findByRole("button", { name: "Añadir al stock (2)" })).toBeEnabled();
  });

  it("test_shoppingList_purchase_callsTheServerOnceAndClearsThePickedLines", async () => {
    const received = mockBackend([line({ checked: true }), line({ ean: "2222222222222", name: "Pan" })]);
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Añadir al stock (1)" }));
    expect(await screen.findByText("✓ Compra añadida")).toBeInTheDocument();
    expect(received.purchases).toBe(1);
    await waitFor(() => expect(screen.queryByText("Leche")).not.toBeInTheDocument());
    expect(screen.getByText("Pan")).toBeInTheDocument();
  });

  it("test_shoppingList_purchaseFails_keepsTheListAndSaysSo", async () => {
    mockBackend([line({ checked: true })], { failPurchase: true });
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Añadir al stock (1)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La lista sigue como estaba");
    expect(screen.getByText("Leche")).toBeInTheDocument();
    expect(screen.queryByText("✓ Compra añadida")).not.toBeInTheDocument();
  });

  it("test_shoppingList_purchase_marksTheInventoryAsStale", async () => {
    mockBackend([line({ checked: true })]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const inventoryKey = ["inventory", { low: undefined }];
    client.setQueryData(inventoryKey, []);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/lista"]}>
          <ShoppingList />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(client.getQueryState(inventoryKey)?.isInvalidated).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "Añadir al stock (1)" }));
    await screen.findByText("✓ Compra añadida");
    expect(client.getQueryState(inventoryKey)?.isInvalidated).toBe(true);
  });
});
