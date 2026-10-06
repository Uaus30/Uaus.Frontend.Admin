import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { DateRangePicker } from "../date-range-picker";
import { CALENDAR_PORTAL_ATTRIBUTE } from "../date-field";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Retângulo do gatilho como o navegador mediria, só com o que o cálculo usa. */
function rectAt(top: number): DOMRect {
  return { top, bottom: top + 36, left: 10, right: 210, width: 200, height: 36, x: 10, y: top } as DOMRect;
}

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

  it("acompanha o campo quando a página rola com o calendário aberto", async () => {
    // No admin quem rola é o <main>, não a janela: o painel medido só na
    // abertura ficava parado enquanto o campo subia.
    let triggerTop = 300;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => rectAt(triggerTop));

    render(
      <div data-testid="rolavel" style={{ overflowY: "auto" }}>
        <DateRangePicker value={{ from: new Date(2026, 6, 18), to: undefined }} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /18\/07\/2026/i }));

    const panel = document.querySelector<HTMLElement>(`[${CALENDAR_PORTAL_ATTRIBUTE}]`)!;
    // O jsdom não tem altura de janela, então o painel abre para cima do campo:
    // topo do campo − respiro de 6px − altura medida (0 no jsdom).
    expect(panel.style.top).toBe("294px");

    triggerTop = 120;
    fireEvent.scroll(screen.getByTestId("rolavel"));

    await waitFor(() => expect(panel.style.top).toBe("114px"));
  });
});
