import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ROUTES } from "@/routes";
import { HOME_PATH } from "../home-route";
import { HOME_SHORTCUTS } from "../shortcuts";
import { HomeShortcutGrid } from "../components/HomeShortcutGrid";

/**
 * A tela inicial (05/10/2026): a grade de botões que leva direto às telas do
 * dia a dia, pensada para o celular.
 */

afterEach(cleanup);

describe("atalhos da tela inicial", () => {
  it("são os dez pedidos pelo dono, em pares de assunto e com o destino de cada um", () => {
    // Igualdade estrita de propósito: botão a mais, a menos ou trocado de lugar
    // é decisão do dono, não acidente. A ordem é a que ele pediu em 05/10/2026:
    // dois por linha no celular, cada linha um assunto.
    expect(HOME_SHORTCUTS.map(({ label, href }) => [label, href])).toEqual([
      ["Dashboard", "/dashboard"],
      ["Lucros", "/bi/o-que-trouxe-lucro"],

      ["Produtos", "/produtos"],
      ["Anomalias", "/bi/anomalias"],

      // "Estoque" é o relatório de estoque baixo, e não o Inventário: a pergunta
      // do celular é "o que está acabando".
      ["Estoque", "/relatorios/estoque-baixo"],
      ["Compras", "/estoque/compras"],

      ["Vendas", "/vendas"],
      ["Catálogos", "/marketing/catalogo"],

      ["Promoções", "/marketing/promocoes"],
      ["Tarefas", "/tarefas"],
    ]);
  });

  it("a lista fecha os pares: número par de botões", () => {
    // A grade só tem número par de colunas para o par não se separar; um botão
    // sozinho no fim empurraria o próximo par a começar no meio da linha.
    expect(HOME_SHORTCUTS.length % 2).toBe(0);
  });

  it("todo atalho leva a uma rota VISÍVEL do routes.ts", () => {
    // Os caminhos sem constante são literais; é este teste que impede o rename
    // de uma rota de deixar um botão levando à 404.
    const visiveis = new Set(ROUTES.filter((r) => r.label && !r.hidden && !r.publica).map((r) => r.path));

    for (const atalho of HOME_SHORTCUTS) expect(visiveis).toContain(atalho.href);
  });

  it("todo atalho diz em uma linha o que a tela resolve", () => {
    // O rótulo é curto ("Lucros", "Estoque") para caber no celular; a descrição
    // é o que desfaz a dúvida sobre qual tela ele abre.
    for (const atalho of HOME_SHORTCUTS) expect(atalho.description.trim()).toBeTruthy();
  });

  it("a tela inicial é uma rota do menu, com o rótulo Início", () => {
    const rota = ROUTES.find((r) => r.path === HOME_PATH);

    expect(rota?.label).toBe("Início");
    expect(rota?.hidden).toBeFalsy();
    expect(rota?.publica).toBeFalsy();
  });
});

describe("HomeShortcutGrid", () => {
  it("desenha um link por atalho, com rótulo, descrição e destino", () => {
    render(<HomeShortcutGrid shortcuts={HOME_SHORTCUTS} />);

    const grade = screen.getByRole("navigation", { name: "Atalhos" });
    const links = within(grade).getAllByRole("link");

    expect(links).toHaveLength(HOME_SHORTCUTS.length);
    HOME_SHORTCUTS.forEach((atalho, i) => {
      expect(links[i].getAttribute("href")).toBe(atalho.href);
      expect(links[i].textContent).toContain(atalho.label);
      expect(links[i].textContent).toContain(atalho.description);
    });
  });

  it("o cartão inteiro é o alvo do toque, sem botão dentro dele", () => {
    // Um botão dentro do cartão deixaria área morta entre o ícone e o texto —
    // no celular, toque que não leva a lugar nenhum.
    render(<HomeShortcutGrid shortcuts={HOME_SHORTCUTS} />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Lucros/ }).getAttribute("href")).toBe("/bi/o-que-trouxe-lucro");
  });
});
