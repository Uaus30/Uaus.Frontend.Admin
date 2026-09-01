import { useEffect } from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Route, Router, Switch } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { ROUTES } from "../routes";
import { PRODUCTS_MATCH_PATH } from "@/features/products/product-detail-route";

/**
 * O contrato da rota de Produtos: listagem e detalhe no MESMO `<Route>`.
 *
 * O detalhe do produto é a mesma página da listagem, trocada por estado. Se
 * cada caminho tivesse a sua entrada em `ROUTES`, o `<Switch>` renderizaria
 * elementos com chaves diferentes, a página desmontaria na ida ao detalhe e
 * voltar dele devolveria a pessoa a uma listagem recém-nascida — sem o filtro,
 * a busca e a página em que ela estava. É um regression que compila, roda e só
 * aparece para quem estava na página 4.
 */

let montagens = 0;

function PaginaFalsa() {
  useEffect(() => {
    montagens += 1;
  }, []);

  return <div data-testid="pagina-produtos">produtos</div>;
}

function renderRouter(inicial: string) {
  const { hook, navigate } = memoryLocation({ path: inicial });

  render(
    <Router hook={hook}>
      <Switch>
        <Route key="/produtos" path={PRODUCTS_MATCH_PATH}>
          <PaginaFalsa />
        </Route>
        <Route key="/estoque/entradas" path="/estoque/entradas">
          <div data-testid="pagina-entradas">entradas</div>
        </Route>
        <Route>
          <div data-testid="nao-encontrada">404</div>
        </Route>
      </Switch>
    </Router>,
  );

  return { navigate };
}

afterEach(() => {
  cleanup();
  montagens = 0;
});

describe("rota de Produtos", () => {
  it("responde pela listagem e pelo detalhe", () => {
    renderRouter("/produtos");
    expect(screen.getByTestId("pagina-produtos")).toBeTruthy();

    cleanup();
    renderRouter("/produtos/709/detalhes");
    expect(screen.getByTestId("pagina-produtos")).toBeTruthy();
  });

  it("ir da listagem para o detalhe NÃO remonta a página", () => {
    const { navigate } = renderRouter("/produtos");
    expect(montagens).toBe(1);

    act(() => navigate("/produtos/709/detalhes"));

    expect(screen.getByTestId("pagina-produtos")).toBeTruthy();
    expect(montagens).toBe(1);
  });

  it("voltar do detalhe também não remonta", () => {
    const { navigate } = renderRouter("/produtos/709/detalhes");
    expect(montagens).toBe(1);

    act(() => navigate("/produtos"));

    expect(montagens).toBe(1);
  });

  it("não engole o caminho de outra tela", () => {
    // Os segmentos opcionais só valem DEPOIS de `/produtos`; se engolissem
    // qualquer coisa, a rota de Produtos responderia pelo admin inteiro.
    renderRouter("/estoque/entradas");

    expect(screen.getByTestId("pagina-entradas")).toBeTruthy();
  });

  it("a rota declarada em ROUTES é a que este teste exercita", () => {
    // O teste monta um `<Switch>` próprio para poder contar montagens sem
    // arrastar o app inteiro. Esta asserção é o que impede o `matchPath` de
    // mudar em `routes.ts` sem o teste acompanhar.
    const produtos = ROUTES.find((route) => route.path === "/produtos");

    expect(produtos?.matchPath).toBe(PRODUCTS_MATCH_PATH);
  });
});
