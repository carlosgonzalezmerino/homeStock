import { describe, it, expect, vi, afterEach } from "vitest";
import { isDiagnosticsEnabled, setDiagnosticsEnabled } from "./diagnostics";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("diagnostics preference", () => {
  it("test_isDiagnosticsEnabled_nothingStored_returnsFalse", () => {
    expect(isDiagnosticsEnabled()).toBe(false);
  });

  it("test_setDiagnosticsEnabled_true_isRemembered", () => {
    setDiagnosticsEnabled(true);
    expect(isDiagnosticsEnabled()).toBe(true);
  });

  it("test_setDiagnosticsEnabled_false_turnsItOff", () => {
    setDiagnosticsEnabled(true);
    setDiagnosticsEnabled(false);
    expect(isDiagnosticsEnabled()).toBe(false);
  });

  it("test_isDiagnosticsEnabled_storageUnavailable_returnsFalseAndWarns", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(isDiagnosticsEnabled()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("blocked"));
  });

  it("test_setDiagnosticsEnabled_storageUnavailable_doesNotThrow", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => setDiagnosticsEnabled(true)).not.toThrow();
  });
});
