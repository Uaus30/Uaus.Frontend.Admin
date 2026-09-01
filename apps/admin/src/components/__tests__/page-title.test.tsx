import { render, cleanup, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { PageTitleProvider, usePageTitle } from "../page-title";
import { TITULO_DO_APP } from "@/lib/route-title";

function TelaComTitulo({ titulo }: { titulo?: string }) {
  usePageTitle(titulo);
  return <div>tela</div>;
}

function renderEm(path: string, children: React.ReactNode) {
  const { hook, navigate } = memoryLocation({ path });

  const view = render(
    <Router hook={hook}>
      <PageTitleProvider>{children}</PageTitleProvider>
    </Router>,
  );

  return { ...view, navigate };
}

afterEach(() => {
  cleanup();
  document.title = "";
});

describe("PageTitleProvider", () => {
  it("usa o nome da rota quando a tela não pede nada", () => {
    renderEm("/produtos", <TelaComTitulo />);

    expect(document.title).toBe(`Produtos · ${TITULO_DO_APP}`);
  });

  it("o título da TELA ganha do da rota", () => {
    // É a ordem dos efeitos que torna isto não-óbvio: efeito de filho roda
    // antes de efeito de pai. Se a tela escrevesse direto em `document.title`,
    // o provedor sobrescreveria logo depois e o título certo apareceria por um
    // frame só. Aqui a tela ANUNCIA e quem escreve é um efeito só.
    renderEm("/produtos", <TelaComTitulo titulo="BACIA COM TAMPA TRITEC" />);

    expect(document.title).toBe(`BACIA COM TAMPA TRITEC · ${TITULO_DO_APP}`);
  });

  it("a tela devolvendo undefined volta para o nome da rota", () => {
    const { rerender } = renderEm("/produtos", <TelaComTitulo titulo="BACIA COM TAMPA TRITEC" />);
    expect(document.title).toBe(`BACIA COM TAMPA TRITEC · ${TITULO_DO_APP}`);

    rerender(
      <Router hook={memoryLocation({ path: "/produtos" }).hook}>
        <PageTitleProvider>
          <TelaComTitulo />
        </PageTitleProvider>
      </Router>,
    );

    expect(document.title).toBe(`Produtos · ${TITULO_DO_APP}`);
  });

  it("navegar troca o título", () => {
    const { navigate } = renderEm("/produtos", <TelaComTitulo />);

    act(() => navigate("/estoque/entradas"));

    expect(document.title).toBe(`Entradas · ${TITULO_DO_APP}`);
  });

  it("caminho fora das rotas fica só com o nome do app", () => {
    renderEm("/nao-existe", <TelaComTitulo />);

    expect(document.title).toBe(TITULO_DO_APP);
  });
});
