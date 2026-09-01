import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { NotFoundScreen, NOT_FOUND_TITLE } from "../not-found-screen";

/**
 * O que estes testes protegem.
 *
 * A tela é a mesma nos três apps, e é isso que o primeiro teste trava: o título
 * não é prop, então nenhum app consegue divergir do padrão sem alterar o
 * componente — que é onde a mudança deve ser discutida.
 *
 * O resto cobre as duas decisões que não se veem no JSX: a arte é decorativa
 * (ela já grita "ERROR" em inglês; anunciada, o leitor de tela repetiria o
 * título no idioma errado) e o `className` precisa REALMENTE vencer a altura
 * padrão. Esse último é o caso frágil: `min-h-[60vh]` é valor arbitrário e
 * `min-h-screen` é classe nomeada, e só o `tailwind-merge` faz uma anular a
 * outra. Sem isso, a loja empurraria o rodapé para fora da tela ou o admin
 * ficaria com um 404 espremido no meio do nada — nenhum dos dois quebra o
 * build.
 */
describe("NotFoundScreen", () => {
  it("mostra o título padrão, igual nos três apps", () => {
    render(<NotFoundScreen />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(NOT_FOUND_TITLE);
    expect(NOT_FOUND_TITLE).toBe("PÁGINA NÃO ENCONTRADA");
  });

  it("mantém a arte fora da leitura de tela", () => {
    const { container } = render(<NotFoundScreen />);

    const imagem = container.querySelector("img");
    expect(imagem?.getAttribute("alt")).toBe("");
    expect(imagem?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("usa a linha de apoio padrão e deixa o app substituí-la", () => {
    const { unmount } = render(<NotFoundScreen />);
    expect(screen.getByText("O endereço que você tentou abrir não existe.")).toBeTruthy();
    unmount();

    render(<NotFoundScreen description="O endereço que você abriu não existe no caixa." />);
    expect(screen.getByText("O endereço que você abriu não existe no caixa.")).toBeTruthy();
    expect(screen.queryByText("O endereço que você tentou abrir não existe.")).toBeNull();
  });

  it("renderiza a ação de retorno que o app passar", () => {
    render(<NotFoundScreen action={<a href="/dashboard">Ir para o Dashboard</a>} />);

    expect(screen.getByRole("link", { name: "Ir para o Dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it("deixa o app trocar a altura padrão, sem herdar as duas", () => {
    const { container } = render(<NotFoundScreen className="min-h-screen" />);

    const raiz = container.querySelector('[data-slot="not-found-screen"]');
    expect(raiz?.className).toContain("min-h-screen");
    expect(raiz?.className).not.toContain("min-h-[60vh]");
  });
});
