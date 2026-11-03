import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BackButton,
  Card,
  ErrorState,
  FormField,
  LocationPicker,
  ProductThumbnail,
  SegmentedControl,
  StatTile,
} from "@/components";

describe("BackButton", () => {
  it("test_BackButton_clicked_callsOnBack", () => {
    const onBack = vi.fn();
    render(<BackButton onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("test_BackButton_customLabel_showsLabel", () => {
    render(<BackButton onBack={vi.fn()} label="Atrás" />);
    expect(screen.getByRole("button", { name: "Atrás" })).toBeInTheDocument();
  });
});

describe("FormField", () => {
  it("test_FormField_errorMessage_showsError", () => {
    render(
      <FormField label="Nombre" error="Requerido">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Requerido")).toBeInTheDocument();
  });

  it("test_FormField_noError_showsNoErrorText", () => {
    render(
      <FormField label="Nombre">
        <input />
      </FormField>,
    );
    expect(screen.queryByText("Requerido")).not.toBeInTheDocument();
  });
});

describe("LocationPicker", () => {
  it("test_LocationPicker_pantryValue_checksPantryRadio", () => {
    render(<LocationPicker value="pantry" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Despensa" })).toBeChecked();
  });

  it("test_LocationPicker_freezerRadioClicked_callsOnChangeWithFreezer", () => {
    const onChange = vi.fn();
    render(<LocationPicker value="pantry" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Congelador" }));
    expect(onChange).toHaveBeenCalledWith("freezer");
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "a", label: "Alfa" },
    { value: "b", label: "Beta" },
  ] as const;

  it("test_SegmentedControl_activeValue_marksMatchingTabSelected", () => {
    render(<SegmentedControl options={options} value="b" onChange={vi.fn()} ariaLabel="Letras" />);
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Alfa" })).toHaveAttribute("aria-selected", "false");
  });

  it("test_SegmentedControl_inactiveTabClicked_callsOnChangeWithValue", () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="a" onChange={onChange} ariaLabel="Letras" />);
    fireEvent.click(screen.getByRole("tab", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("StatTile", () => {
  it("test_StatTile_value_showsLabelAndValue", () => {
    render(<StatTile label="Productos" value={12} />);
    expect(screen.getByText("Productos")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("ProductThumbnail", () => {
  it("test_ProductThumbnail_imageUrl_rendersImage", () => {
    render(<ProductThumbnail imageUrl="https://img.test/a.png" alt="Leche" placeholderIcon="grocery" />);
    expect(screen.getByRole("img", { name: "Leche" })).toHaveAttribute("src", "https://img.test/a.png");
  });

  it("test_ProductThumbnail_noImageUrl_rendersPlaceholderIcon", () => {
    render(<ProductThumbnail imageUrl={null} alt="Leche" placeholderIcon="grocery" />);
    expect(screen.getByTestId("img-placeholder")).toHaveTextContent("grocery");
  });
});

describe("ErrorState action label", () => {
  it("test_ErrorState_customActionLabel_showsCustomLabel", () => {
    render(<ErrorState message="Nada" onRetry={vi.fn()} actionLabel="Volver" />);
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });
});

describe("Card interaction", () => {
  it("test_Card_enterKeyOnClickableCard_callsOnClick", () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>x</Card>);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("test_Card_otherKeyOnClickableCard_doesNotCallOnClick", () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>x</Card>);
    fireEvent.keyDown(screen.getByRole("button"), { key: "a" });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("test_Card_denseProp_usesCompactPadding", () => {
    const { container } = render(<Card dense>x</Card>);
    expect(container.firstChild).toHaveClass("p-4");
  });
});
