import { describe, expect, it } from "vitest";
import {
  PRODUCTS_MATCH_PATH,
  productDetailPathname,
  productGroupIdFromPathname,
  productsListPathname,
} from "../product-detail-route";

describe("productGroupIdFromPathname", () => {
  it("lê o id do grupo do caminho do detalhe", () => {
    expect(productGroupIdFromPathname("/produtos/709/detalhes")).toBe(709);
  });

  it("aceita barra no fim e o base de um deploy em subpasta", () => {
    // O base do Vite entra no pathname real; ignorá-lo é o que faz o mesmo
    // parser servir a `admin.uaus.com.br` e a um deploy sob `/painel/`.
    expect(productGroupIdFromPathname("/produtos/709/detalhes/")).toBe(709);
    expect(productGroupIdFromPathname("/painel/produtos/709/detalhes")).toBe(709);
  });

  it("devolve null para a listagem e para caminho de outra tela", () => {
    expect(productGroupIdFromPathname("/produtos")).toBeNull();
    expect(productGroupIdFromPathname("/estoque/entradas")).toBeNull();
  });

  it("devolve null para id que não é inteiro positivo", () => {
    // A rota casa qualquer segmento; quem recusa lixo é este parser. Sem ele,
    // `/produtos/abc/detalhes` viraria uma busca por NaN no servidor.
    expect(productGroupIdFromPathname("/produtos/abc/detalhes")).toBeNull();
    expect(productGroupIdFromPathname("/produtos/0/detalhes")).toBeNull();
    expect(productGroupIdFromPathname("/produtos/-3/detalhes")).toBeNull();
  });

  it("não confunde o detalhe com um caminho que só o contém no meio", () => {
    expect(productGroupIdFromPathname("/produtos/709/detalhes/estoque")).toBeNull();
  });
});

describe("caminhos montados", () => {
  it("o detalhe volta pelo parser que o lê", () => {
    expect(productGroupIdFromPathname(productDetailPathname(42))).toBe(42);
  });

  it("a listagem não é caminho de detalhe", () => {
    expect(productGroupIdFromPathname(productsListPathname())).toBeNull();
  });
});

describe("PRODUCTS_MATCH_PATH", () => {
  it("tem os dois segmentos opcionais", () => {
    // Os `?` são o que faz `/produtos` e `/produtos/709/detalhes` casarem no
    // MESMO `<Route>`. Sem eles seriam duas entradas, com chaves diferentes no
    // `<Switch>` — e ir para o detalhe desmontaria a listagem, levando junto o
    // filtro, a busca e a página em que a pessoa estava.
    expect(PRODUCTS_MATCH_PATH).toBe("/produtos/:id?/:secao?");
  });
});
