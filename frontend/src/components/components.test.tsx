import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Card,
  StatusBadge,
  LevelBar,
  QuantityStepper,
  Button,
  EmptyState,
  Spinner,
  ErrorState,
} from "@/components";

// ── StatusBadge ───────────────────────────────────────────────────────────────

describe("StatusBadge", () => {
  it("renders a circle with aria-label 'Stock OK' when status is ok", () => {
    const { container } = render(<StatusBadge status="ok" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-label", "Stock OK");
    expect(dot).toHaveClass("bg-primary");
  });

  it("renders a circle with aria-label 'Stock bajo' when status is low", () => {
    const { container } = render(<StatusBadge status="low" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-label", "Stock bajo");
    expect(dot).toHaveClass("bg-tertiary");
  });

  it("renders a circle with aria-label 'Agotado' when status is empty", () => {
    const { container } = render(<StatusBadge status="empty" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-label", "Agotado");
    expect(dot).toHaveClass("bg-error");
  });
});

// ── Card ──────────────────────────────────────────────────────────────────────

describe("Card", () => {
  it("renders children", () => {
    render(<Card>contenido</Card>);
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("applies error accent class when accent='error'", () => {
    const { container } = render(<Card accent="error">x</Card>);
    expect(container.firstChild).toHaveClass("border-l-4");
    expect(container.firstChild).toHaveClass("border-l-error");
  });

  it("applies tertiary accent class when accent='tertiary'", () => {
    const { container } = render(<Card accent="tertiary">x</Card>);
    expect(container.firstChild).toHaveClass("border-l-tertiary");
  });

  it("has no accent border when accent is null", () => {
    const { container } = render(<Card accent={null}>x</Card>);
    expect(container.firstChild).not.toHaveClass("border-l-4");
  });
});

// ── LevelBar ──────────────────────────────────────────────────────────────────

describe("LevelBar", () => {
  it("sets width proportional to quantity/max", () => {
    render(<LevelBar quantity={3} max={10} />);
    const fill = document.querySelector("[data-testid='level-bar-fill']");
    expect(fill).toHaveStyle({ width: "30%" });
  });

  it("clamps to 100% when quantity exceeds max", () => {
    render(<LevelBar quantity={15} max={10} />);
    const fill = document.querySelector("[data-testid='level-bar-fill']");
    expect(fill).toHaveStyle({ width: "100%" });
  });

  it("clamps to 0% when quantity is 0", () => {
    render(<LevelBar quantity={0} max={10} />);
    const fill = document.querySelector("[data-testid='level-bar-fill']");
    expect(fill).toHaveStyle({ width: "0%" });
  });
});

// ── QuantityStepper ───────────────────────────────────────────────────────────

describe("QuantityStepper", () => {
  it("displays the current value", () => {
    render(<QuantityStepper value={4} onChange={vi.fn()} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("calls onChange with value + 1 on + click", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "＋" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("calls onChange with value - 1 on − click", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "−" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("does not go below 0", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "−" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies lg size classes when size='lg'", () => {
    const { container } = render(<QuantityStepper value={3} onChange={vi.fn()} size="lg" />);
    const buttons = container.querySelectorAll("button");
    expect(buttons[0]).toHaveClass("h-12");
    expect(buttons[1]).toHaveClass("h-12");
  });
});

// ── Button ────────────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders children and calls onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button onClick={vi.fn()} disabled>Guardar</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

// ── EmptyState / Spinner / ErrorState ─────────────────────────────────────────

describe("EmptyState", () => {
  it("renders the message", () => {
    render(<EmptyState message="Tu despensa está vacía" />);
    expect(screen.getByText("Tu despensa está vacía")).toBeInTheDocument();
  });
});

describe("Spinner", () => {
  it("renders without crashing", () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders message and retry button", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error de red" onRetry={onRetry} />);
    expect(screen.getByText("Error de red")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
