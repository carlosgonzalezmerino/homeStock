import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuantityStepper } from "./QuantityStepper";
import { QUANTITY_RANGE_MESSAGE } from "@/utils/parse";

describe("QuantityStepper steps", () => {
  it("test_stepper_plusFromHalfUnit_givesOneAndHalf", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={0.5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "＋" }));
    expect(onChange).toHaveBeenCalledWith(1.5);
  });

  it("test_stepper_minusFromHalfUnit_givesZero", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={0.5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "−" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("test_stepper_atZero_disablesMinus", () => {
    render(<QuantityStepper value={0} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "−" })).toBeDisabled();
  });

  it("test_stepper_neutralTone_keepsIncrementOffAccent", () => {
    render(<QuantityStepper value={1} onChange={vi.fn()} tone="neutral" />);
    expect(screen.getByRole("button", { name: "＋" })).not.toHaveClass("bg-primary");
  });

  it("test_stepper_readOnly_showsValueWithDecimalComma", () => {
    render(<QuantityStepper value={0.5} onChange={vi.fn()} />);
    expect(screen.getByText("0,5")).toBeInTheDocument();
    expect(screen.queryByLabelText("cantidad")).not.toBeInTheDocument();
  });
});

describe("QuantityStepper editable value", () => {
  it("test_editable_validDecimalOnBlur_savesValue", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} editable />);
    const input = screen.getByLabelText("cantidad");
    fireEvent.change(input, { target: { value: "0,5" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("test_editable_invalidTextOnBlur_showsErrorAndDoesNotSave", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} editable />);
    const input = screen.getByLabelText("cantidad");
    fireEvent.change(input, { target: { value: "-3" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(QUANTITY_RANGE_MESSAGE)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("test_editable_enterKey_savesValue", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} editable />);
    const input = screen.getByLabelText("cantidad");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("test_editable_unchangedValueOnBlur_doesNotSave", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} editable />);
    fireEvent.blur(screen.getByLabelText("cantidad"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
