import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "../input";

describe("Input", () => {
  it("campo numérico perde o foco no giro da roda, e o valor não muda", () => {
    // Focado, o navegador soma um passo a cada giro: rolar o pagamento dividido do
    // PDV com o cursor sobre o valor alterava o valor sem o operador perceber.
    render(<Input aria-label="Valor" type="number" defaultValue="20" />);
    const campo = screen.getByLabelText<HTMLInputElement>("Valor");
    campo.focus();

    fireEvent.wheel(campo, { deltaY: -100 });

    expect(document.activeElement).not.toBe(campo);
    expect(campo.value).toBe("20");
  });

  it("campo numérico esconde as setinhas de incremento", () => {
    render(<Input aria-label="Valor" type="number" />);

    expect(screen.getByLabelText("Valor").className).toContain(
      "[&::-webkit-inner-spin-button]:appearance-none",
    );
  });

  it("repassa o onWheel de quem usa o campo", () => {
    const onWheel = vi.fn();
    render(<Input aria-label="Valor" type="number" onWheel={onWheel} />);

    fireEvent.wheel(screen.getByLabelText("Valor"));

    expect(onWheel).toHaveBeenCalledTimes(1);
  });

  it("campo de texto continua focado no giro da roda", () => {
    // Texto não tem passo para a roda mudar: tirar o foco ali só atrapalharia
    // quem está digitando o valor recebido em dinheiro.
    render(<Input aria-label="Recebido" type="text" />);
    const campo = screen.getByLabelText("Recebido");
    campo.focus();

    fireEvent.wheel(campo);

    expect(document.activeElement).toBe(campo);
    expect(campo.className).not.toContain("spin-button");
  });
});
