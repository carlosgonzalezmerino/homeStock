import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "@/api/client";
import { resolveProduct } from "@/api/resolve";
import {
  listInventory,
  addInventory,
  patchInventory,
  deleteInventory,
} from "@/api/inventory";
import { createProduct } from "@/api/products";
import { getShoppingList } from "@/api/shoppingList";
import { postScan, undoMovement } from "@/api/scan";
import { confirmReview, getReview } from "@/api/review";

vi.mock("@/api/client");

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const patch = vi.mocked(client.patch);
const del = vi.mocked(client.del);

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(undefined as never);
  post.mockResolvedValue(undefined as never);
  patch.mockResolvedValue(undefined as never);
  del.mockResolvedValue(undefined as never);
});

describe("endpoint modules", () => {
  it("resolveProduct hits /resolve/{ean}", async () => {
    get.mockResolvedValue({ ean: "8410000000000", name: "Leche", source: "off" } as never);
    const p = await resolveProduct("8410000000000");
    expect(get).toHaveBeenCalledWith("/resolve/8410000000000");
    expect(p).toEqual({ ean: "8410000000000", name: "Leche", source: "off" });
  });

  it("listInventory omits the query param when low is undefined", async () => {
    await listInventory();
    expect(get).toHaveBeenCalledWith("/inventory");
  });

  it("listInventory appends ?low=true / ?low=false", async () => {
    await listInventory(true);
    expect(get).toHaveBeenCalledWith("/inventory?low=true");
    await listInventory(false);
    expect(get).toHaveBeenCalledWith("/inventory?low=false");
  });

  it("addInventory posts to /inventory", async () => {
    const data = { ean: "x", quantity: 2, threshold: 1 };
    await addInventory(data);
    expect(post).toHaveBeenCalledWith("/inventory", data);
  });

  it("patchInventory patches /inventory/{ean}", async () => {
    await patchInventory("x", { quantity: 0 });
    expect(patch).toHaveBeenCalledWith("/inventory/x", { quantity: 0 }, undefined);
  });

  it("test_patchInventory_withASource_passesItOn", async () => {
    await patchInventory("x", { quantity: 2, reason: "purchase" }, "shopping_list");
    expect(patch).toHaveBeenCalledWith("/inventory/x", { quantity: 2, reason: "purchase" }, "shopping_list");
  });

  it("deleteInventory deletes /inventory/{ean}", async () => {
    await deleteInventory("x");
    expect(del).toHaveBeenCalledWith("/inventory/x");
  });

  it("createProduct posts to /products", async () => {
    const data = { ean: "x", name: "Manual" };
    await createProduct(data);
    expect(post).toHaveBeenCalledWith("/products", data);
  });

  it("getShoppingList hits /shopping-list", async () => {
    await getShoppingList();
    expect(get).toHaveBeenCalledWith("/shopping-list");
  });

  it("test_postScan_postsTheRequestToScan", async () => {
    const body = { ean: "1", mode: "purchase" as const, location: "freezer" as const };
    await postScan(body);
    expect(post).toHaveBeenCalledWith("/scan", body, undefined);
  });

  it("test_postScan_withASource_passesItOn", async () => {
    await postScan({ ean: "1", mode: "consume" }, "device");
    expect(post).toHaveBeenCalledWith("/scan", { ean: "1", mode: "consume" }, "device");
  });

  it("test_undoMovement_postsToTheUndoPathOfThatMovement", async () => {
    await undoMovement(42);
    expect(post).toHaveBeenCalledWith("/movements/42/undo");
  });

  it("test_getReview_getsTheReviewList", async () => {
    await getReview();
    expect(get).toHaveBeenCalledWith("/review");
  });

  it("test_confirmReview_postsToTheConfirmPathAndEncodesTheEan", async () => {
    await confirmReview("a/b");
    expect(post).toHaveBeenCalledWith("/review/a%2Fb/confirm");
  });
});
