import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupplierTypeField } from "../SupplierTypeField";

/**
 * A frase embaixo do seletor é o único lugar onde o efeito do tipo aparece
 * nesta tela — trocar o texto de um tipo pelo de outro não dá erro nenhum, só
 * ensina a regra errada a quem cadastra.
 */
describe("SupplierTypeField", () => {
  afterEach(cleanup);

  const hint = () => screen.getByTestId("supplier-type-hint").textContent ?? "";

  it("sem tipo escolhido, avisa que é obrigatório no cadastro novo", () => {
    render(<SupplierTypeField value="" onChange={vi.fn()} />);

    expect(hint()).toContain("Obrigatório no cadastro novo");
  });

  it("atacado e varejo explicam a compra pequena que desliga o controle de estoque", () => {
    for (const tipo of ["Wholesale", "Retail"] as const) {
      render(<SupplierTypeField value={tipo} onChange={vi.fn()} />);
      expect(hint()).toContain("Planejar viagem");
      expect(hint()).toContain("Configurações › Estoque");
      cleanup();
    }
  });

  it("marketplace explica o link obrigatório na compra", () => {
    render(<SupplierTypeField value="Marketplace" onChange={vi.fn()} />);

    expect(hint()).toContain("link do anúncio");
  });

  it("fábrica fica fora da regra da compra pequena", () => {
    render(<SupplierTypeField value="Factory" onChange={vi.fn()} />);

    expect(hint()).toContain("fora da regra");
    expect(hint()).not.toContain("Planejar viagem");
  });

  it("distribuidor e outros não mudam nada fora daqui", () => {
    render(<SupplierTypeField value="Other" onChange={vi.fn()} />);

    expect(hint()).toBe("Sem efeito em outras telas.");
  });
});
