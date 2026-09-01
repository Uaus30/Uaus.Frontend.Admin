import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AddedItemToast } from "../added-item-toast";

describe("AddedItemToast", () => {
  it("mostra a miniatura do produto adicionado", () => {
    // A imagem é a conferência do bipe: o operador olha para o produto na mão,
    // não para a tela, e reconhecer a foto é mais rápido que ler o nome.
    render(<AddedItemToast name="CANECA DE PORCELANA 150ML CONICA" imageUrl="produtos/caneca.png" />);

    const imagem = screen.getByRole("presentation", { hidden: true });
    expect(imagem.getAttribute("src")).toContain("produtos/caneca.png");
    expect(screen.getByText("CANECA DE PORCELANA 150ML CONICA")).toBeTruthy();
  });

  it("cai no ícone quando o produto não tem imagem", () => {
    // Produto sem foto é comum no catálogo; o aviso não pode quebrar nem ficar
    // com um buraco no lugar da miniatura.
    const { container } = render(<AddedItemToast name="PRODUTO SEM FOTO" imageUrl={null} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("PRODUTO SEM FOTO")).toBeTruthy();
  });
});
