import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdvPhoneCartBar } from "../pdv-phone-cart-bar";

describe("PdvPhoneCartBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra quantos itens e quanto dá, e leva ao carrinho", () => {
    const onOpenCart = vi.fn();
    render(<PdvPhoneCartBar units={3} total={45.9} pulseKey={0} onOpenCart={onOpenCart} />);

    const barra = screen.getByRole("button", { name: /Abrir o carrinho: 3 itens/ });
    expect(barra.textContent).toMatch(/R\$\s45,90/);
    expect(screen.getByTestId("phone-cart-count").textContent).toBe("3");

    fireEvent.click(barra);
    expect(onOpenCart).toHaveBeenCalledTimes(1);
  });

  it("não existe com o carrinho vazio", () => {
    const { container } = render(<PdvPhoneCartBar units={0} total={0} pulseKey={0} onOpenCart={vi.fn()} />);
    expect(container.textContent).toBe("");
  });

  it("pulsa e vibra quando um item entra, mas não ao reaparecer", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, vibrate });

    // Montada com o item já no carrinho (voltando da vista do carrinho): nada
    // entrou agora, então nem pulso nem vibração.
    const { rerender } = render(<PdvPhoneCartBar units={1} total={5} pulseKey={4} onOpenCart={vi.fn()} />);
    expect(screen.getByTestId("phone-cart-count").className).not.toContain("pdv-count-pulse");
    expect(vibrate).not.toHaveBeenCalled();

    rerender(<PdvPhoneCartBar units={2} total={10} pulseKey={5} onOpenCart={vi.fn()} />);
    expect(screen.getByTestId("phone-cart-count").className).toContain("pdv-count-pulse");
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("retomar uma venda em espera não pulsa: o carrinho volta cheio sem item novo", () => {
    // Revisão de 07/10/2026: a barra fica montada com o carrinho vazio, e a base
    // antiga fazia o contador nascer pulsando ao retomar a venda.
    const { rerender } = render(<PdvPhoneCartBar units={1} total={5} pulseKey={3} onOpenCart={vi.fn()} />);
    rerender(<PdvPhoneCartBar units={2} total={10} pulseKey={4} onOpenCart={vi.fn()} />);
    // Venda finalizada: carrinho vazio, o contador de bipes não muda.
    rerender(<PdvPhoneCartBar units={0} total={0} pulseKey={4} onOpenCart={vi.fn()} />);
    // Venda em espera retomada: três itens de volta, sem bipe nenhum.
    rerender(<PdvPhoneCartBar units={3} total={15} pulseKey={4} onOpenCart={vi.fn()} />);
    expect(screen.getByTestId("phone-cart-count").className).not.toContain("pdv-count-pulse");

    // O próximo bipe volta a pulsar.
    rerender(<PdvPhoneCartBar units={4} total={20} pulseKey={5} onOpenCart={vi.fn()} />);
    expect(screen.getByTestId("phone-cart-count").className).toContain("pdv-count-pulse");
  });
});
