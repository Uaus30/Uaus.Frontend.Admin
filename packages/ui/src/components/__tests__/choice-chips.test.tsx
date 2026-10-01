import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceChips } from "../choice-chips";

const OPTIONS = [
  { value: 1, label: "Feminino" },
  { value: 2, label: "Masculino" },
];

describe("ChoiceChips", () => {
  it("escolhe com um toque e marca o escolhido", () => {
    const onChange = vi.fn();
    render(<ChoiceChips label="Sexo" options={OPTIONS} value={2} onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "Masculino" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Feminino" }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("tocar de novo no escolhido volta ao vazio", () => {
    const onChange = vi.fn();
    render(<ChoiceChips label="Sexo" options={OPTIONS} value={1} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "Feminino" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("sem desmarcar, repete o valor", () => {
    const onChange = vi.fn();
    render(
      <ChoiceChips label="Sexo" options={OPTIONS} value={1} onChange={onChange} allowDeselect={false} />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Feminino" }));

    expect(onChange).toHaveBeenCalledWith(1);
  });
});
