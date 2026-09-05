import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PricingPreview } from "../PricingPreview";

afterEach(() => cleanup());

describe("PricingPreview", () => {
  it("mostra margem, markup e o preço sugerido para o custo digitado", () => {
    // Custo 10 a preço 15: margem de 33,33% (sobre o preço), markup de 50%
    // (sobre o custo) e sugestão de R$ 16,70 para 40% em múltiplos de 10
    // centavos. Os três saem da MESMA conta do core — a tela só formata.
    render(<PricingPreview unitCost={10} price={15} onApplySuggested={vi.fn()} />);

    expect(screen.getByText("33,33%")).toBeTruthy();
    expect(screen.getByText("50,00%")).toBeTruthy();
    expect(screen.getByText("R$ 16,70")).toBeTruthy();
  });

  it("aplica o preço sugerido no campo de preço ao clicar", () => {
    const onApplySuggested = vi.fn();
    render(<PricingPreview unitCost={10} price={15} onApplySuggested={onApplySuggested} />);

    fireEvent.click(screen.getByRole("button", { name: /Usar sugerido/ }));

    expect(onApplySuggested).toHaveBeenCalledWith(16.7);
  });

  it("desabilita o botão quando o preço já é o sugerido", () => {
    render(<PricingPreview unitCost={10} price={16.7} onApplySuggested={vi.fn()} />);

    const botao = screen.getByRole("button", { name: /Aplicado/ });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
  });

  it("some sem custo: brinde e bonificação não têm preço a sugerir", () => {
    // Sugerir zero zeraria o preço do produto no cadastro, e "margem 100%" num
    // brinde é informação enganosa.
    render(<PricingPreview unitCost={0} price={15} onApplySuggested={vi.fn()} />);

    expect(screen.queryByTestId("pricing-preview")).toBeNull();
  });

  it("mostra a margem negativa quando o preço está abaixo do custo", () => {
    render(<PricingPreview unitCost={10} price={8} onApplySuggested={vi.fn()} />);

    expect(screen.getByText("-25,00%")).toBeTruthy();
  });
});
