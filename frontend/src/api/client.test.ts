import { describe, it, expect, vi, afterEach } from "vitest";
import { get, post, patch, del, ApiError } from "@/api/client";

function mockFetch(status: number, body?: unknown, contentType = "application/json") {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? contentType : null) },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("GET prefixes /api and parses a 200 JSON body", async () => {
    const fn = mockFetch(200, { status: "ok" });
    const result = await get<{ status: string }>("/health");
    expect(fn).toHaveBeenCalledWith("/api/health", expect.objectContaining({ method: "GET" }));
    expect(result).toEqual({ status: "ok" });
  });

  it("POST sends JSON body + content-type header", async () => {
    const fn = mockFetch(201, { ean: "x" });
    await post("/inventory", { ean: "x", quantity: 1, threshold: 1 });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("/api/inventory");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ ean: "x", quantity: 1, threshold: 1 });
  });

  it("PATCH sends JSON body", async () => {
    const fn = mockFetch(200, { ean: "x", quantity: 0 });
    await patch("/inventory/x", { quantity: 0 });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("/api/inventory/x");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ quantity: 0 });
  });

  it("DELETE returns void on 204 without parsing a body", async () => {
    mockFetch(204, undefined, "");
    await expect(del("/inventory/x")).resolves.toBeUndefined();
  });

  it("throws ApiError{status,body} on non-2xx", async () => {
    mockFetch(404, { ean: "missing" });
    await expect(get("/resolve/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      body: { ean: "missing" },
    });
    expect(await get("/resolve/missing").catch((e) => e)).toBeInstanceOf(ApiError);
  });
});
