import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PdvCartItemImage } from "../pdv-cart-item-image";

describe("PdvCartItemImage", () => {
  it("não oferece ampliação para produto sem foto cadastrada", () => {
    // Produto sem foto é comum no catálogo. Um botão que abre um retângulo
    // vazio ensina o operador a não clicar mais em nenhum.
    render(<PdvCartItemImage name="PRODUTO SEM FOTO" imageUrl={null} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("amplia a foto ao tocar na miniatura, com o código de barras na legenda", async () => {
    // O clique existe por causa do touchscreen do balcão, onde `hover` não
    // acontece: sem ele a ampliação seria inalcançável no caixa.
    //
    // A legenda é o código, e não o nome: o nome já está na linha do carrinho,
    // ao lado desta foto. O código só é consultado em caso de dúvida sobre qual
    // produto é — que é exatamente quando a foto é aberta.
    render(
      <PdvCartItemImage
        name="CANECA DE PORCELANA 150ML CONICA"
        barcode="7891234567890"
        imageUrl="produtos/caneca.png"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ampliar a foto/ }));

    await waitFor(() => expect(screen.getByAltText("CANECA DE PORCELANA 150ML CONICA")).toBeTruthy());
    expect(screen.getByText("7891234567890")).toBeTruthy();
  });

  it("deve cair no nome quando o produto não tem código de barras", async () => {
    // Produto sem código existe no cadastro, e a legenda vazia deixaria a
    // ampliação sem dizer de que produto ela é.
    render(<PdvCartItemImage name="PRODUTO SEM CODIGO" imageUrl="produtos/x.png" />);

    fireEvent.click(screen.getByRole("button", { name: /Ampliar a foto/ }));

    await waitFor(() => expect(screen.getByText("PRODUTO SEM CODIGO")).toBeTruthy());
  });

  it("renderiza a ampliação fora da área rolável que contém a miniatura", async () => {
    // Regressão: a lista de resultados do PDV é um ScrollArea com overflow
    // escondido. Sem portal, a foto grande nascia DENTRO dele e saía decepada
    // no topo na primeira linha. Aqui o gatilho está num container qualquer; a
    // ampliação não pode ser descendente dele.
    render(
      <div data-testid="area-rolavel" style={{ overflow: "hidden", height: 40 }}>
        <PdvCartItemImage name="CHINELO ESTAMPADO" barcode="3598196816859" imageUrl="produtos/chinelo.png" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ampliar a foto/ }));

    const ampliada = await waitFor(() => screen.getByAltText("CHINELO ESTAMPADO"));
    expect(ampliada.closest("[data-testid='area-rolavel']")).toBeNull();
  });

  it("fecha a ampliação no segundo toque", async () => {
    render(<PdvCartItemImage name="CANECA" imageUrl="produtos/caneca.png" />);

    const gatilho = screen.getByRole("button", { name: /Ampliar a foto/ });
    fireEvent.click(gatilho);
    await waitFor(() => expect(screen.getByAltText("CANECA")).toBeTruthy());

    fireEvent.click(gatilho);

    await waitFor(() => expect(screen.queryByAltText("CANECA")).toBeNull());
  });
});
