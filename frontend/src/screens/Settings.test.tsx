import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/theme";
import { Settings } from "./Settings";

describe("Settings — scanner diagnostics", () => {
  it("test_diagnosticsSwitch_startsOff", () => {
    render(<ThemeProvider><Settings /></ThemeProvider>);
    expect(screen.getByRole("checkbox", { name: "Diagnóstico del escáner" })).not.toBeChecked();
  });

  it("test_diagnosticsSwitch_turnedOn_isStored", () => {
    render(<ThemeProvider><Settings /></ThemeProvider>);
    fireEvent.click(screen.getByRole("checkbox", { name: "Diagnóstico del escáner" }));
    expect(screen.getByRole("checkbox", { name: "Diagnóstico del escáner" })).toBeChecked();
    expect(localStorage.getItem("scannerDiagnostics")).toBe("on");
  });

  it("test_diagnosticsSwitch_storedOn_isShownChecked", () => {
    localStorage.setItem("scannerDiagnostics", "on");
    render(<ThemeProvider><Settings /></ThemeProvider>);
    expect(screen.getByRole("checkbox", { name: "Diagnóstico del escáner" })).toBeChecked();
  });
});
