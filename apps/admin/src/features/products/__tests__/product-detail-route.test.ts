import { describe, expect, it } from "vitest";
import {
  PRODUCTS_MATCH_PATH,
  detailTabFromUrl,
  productDetailPathname,
  productGroupIdFromPathname,
  productStockTabPathname,
  productsListPathname,
  stockProductIdFromUrl,
} from "../product-detail-route";

/** Troca a barra de enderecos do jsdom sem recarregar a pagina. */
function comUrl(url: string) {
  window.history.replaceState(null, "", url);
}

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

describe("aba de abertura pela URL", () => {
  it("o caminho da aba de Estoque continua sendo caminho de detalhe do grupo", () => {
    // O `?aba=` nao pode atrapalhar o parser do id: quem le o pathname e quem
    // decide QUAL produto abrir, e ele ignora a query.
    const caminho = productStockTabPathname(42);

    expect(caminho).toContain("aba=estoque");
    expect(productGroupIdFromPathname(new URL(caminho, "http://x").pathname)).toBe(42);
  });

  it("abre em Estoque so quando a URL pede exatamente isso", () => {
    comUrl(productStockTabPathname(42));
    expect(detailTabFromUrl()).toBe("estoque");
  });

  it("cai em Dados sem o parametro, com valor desconhecido e com a aba vazia", () => {
    // A aba vem da barra de enderecos, que qualquer um edita. Um valor que
    // ninguem reconhece nao pode deixar a tela sem aba selecionada.
    comUrl("/produtos/42/detalhes");
    expect(detailTabFromUrl()).toBe("dados");

    comUrl("/produtos/42/detalhes?aba=opcionais");
    expect(detailTabFromUrl()).toBe("dados");

    comUrl("/produtos/42/detalhes?aba=");
    expect(detailTabFromUrl()).toBe("dados");
  });
});

describe("variacao de abertura da aba de Estoque", () => {
  it("vai junto no caminho quando quem navega sabe qual variacao chegou", () => {
    comUrl(productStockTabPathname(42, 39));

    expect(detailTabFromUrl()).toBe("estoque");
    expect(stockProductIdFromUrl()).toBe(39);
  });

  it("fica de fora do caminho sem variacao", () => {
    // Recebimento de produto sem variacao gravada nao tem o que apontar; o
    // parametro vazio faria a aba procurar por um id que nao existe.
    expect(productStockTabPathname(42)).not.toContain("variacao");
    expect(productStockTabPathname(42, null)).not.toContain("variacao");
  });

  it("recusa id que nao e inteiro positivo", () => {
    comUrl("/produtos/42/detalhes?aba=estoque&variacao=abc");
    expect(stockProductIdFromUrl()).toBeNull();

    comUrl("/produtos/42/detalhes?aba=estoque&variacao=0");
    expect(stockProductIdFromUrl()).toBeNull();

    comUrl("/produtos/42/detalhes?aba=estoque");
    expect(stockProductIdFromUrl()).toBeNull();
  });
});
