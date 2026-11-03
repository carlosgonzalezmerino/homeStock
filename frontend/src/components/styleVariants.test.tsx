import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";
import { Card } from "./Card";
import { ErrorState } from "./ErrorState";

describe("Button variants", () => {
  it("test_button_tertiary_hasNoBackgroundColourOrBorder", () => {
    render(<Button variant="tertiary">Añadir sin código</Button>);
    const button = screen.getByRole("button", { name: "Añadir sin código" });
    expect(button).toHaveClass("bg-transparent");
    expect(button).not.toHaveClass("bg-primary");
    expect(button).not.toHaveClass("border-[1.5px]");
  });

  it("test_button_primary_usesAccentBackground", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveClass("bg-primary");
  });
});

describe("Card surface", () => {
  it("test_card_lightSurface_usesLightPanelClass", () => {
    render(<Card surface="light">Cabecera</Card>);
    expect(screen.getByText("Cabecera")).toHaveClass("surface-light");
  });

  it("test_card_defaultSurface_doesNotUseLightPanel", () => {
    render(<Card>Normal</Card>);
    expect(screen.getByText("Normal")).not.toHaveClass("surface-light");
  });
});

describe("ErrorState retry", () => {
  it("test_errorState_retryIsATertiaryButton", () => {
    render(<ErrorState message="Error al cargar" onRetry={() => undefined} />);
    expect(screen.getByRole("button", { name: "Reintentar" })).not.toHaveClass("bg-primary");
  });
});
