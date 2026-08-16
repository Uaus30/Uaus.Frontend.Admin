import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DateRangePicker } from "../date-range-picker";

describe("DateRangePicker", () => {
  it("exibe o placeholder quando não há período", () => {
    render(<DateRangePicker />);

    expect(screen.getByRole("button", { name: /selecionar período/i })).toBeTruthy();
  });

  it("exibe o período no formato dd/MM/yyyy → dd/MM/yyyy", () => {
    render(<DateRangePicker value={{ from: new Date(2026, 6, 18), to: new Date(2026, 6, 25) }} />);

    expect(screen.getByText("18/07/2026 → 25/07/2026")).toBeTruthy();
  });

  it("abre o calendário em português ao clicar no gatilho", () => {
    render(<DateRangePicker value={{ from: new Date(2026, 6, 18), to: undefined }} />);

    fireEvent.click(screen.getByRole("button", { name: /18\/07\/2026/i }));

    expect(screen.getByText("julho 2026")).toBeTruthy();
    expect(screen.getByText("Data atual")).toBeTruthy();
  });

  it("limpa o período selecionado", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{ from: new Date(2026, 6, 18), to: new Date(2026, 6, 25) }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar período" }));

    expect(onChange).toHaveBeenCalledWith({ from: undefined, to: undefined });
  });
});
