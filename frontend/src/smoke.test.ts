import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs vitest with the @ alias resolvable", async () => {
    const mod = await import("@/App");
    expect(typeof mod.default).toBe("function");
  });
});
