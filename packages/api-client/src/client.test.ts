import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiGet,
  apiGetOrThrow,
  buildUrl,
  extractCreatedId,
  fetchAllPages,
  FETCH_ALL_PAGES_MAX_ITEMS,
  mapPagedResult,
} from "./client";

/** Resposta de sucesso com o corpo informado, ou 204 quando o corpo é `null`. */
function mockResponse(body: unknown, status = 200) {
  return {
    ok: true,
    status: body === null ? 204 : status,
    text: async () => (body === null ? "" : JSON.stringify(body)),
    headers: new Headers(),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildUrl", () => {
  it("monta a query string a partir dos parâmetros", () => {
    const url = buildUrl("/Produtos", { search: "café", page: 2 });

    expect(url).toContain("/Produtos");
    expect(url).toContain("page=2");
    expect(url).toContain(`search=${encodeURIComponent("café")}`);
  });

  it("descarta parâmetro nulo, indefinido e string vazia", () => {
    // Enviar `search=` filtraria por string vazia em vez de não filtrar.
    const url = buildUrl("/Produtos", { search: "", page: null, size: undefined, ativo: false });

    expect(url).not.toContain("search=");
    expect(url).not.toContain("page=");
    expect(url).not.toContain("size=");
    // `false` é valor legítimo e precisa passar.
    expect(url).toContain("ativo=false");
  });

  it("aceita path sem barra inicial", () => {
    expect(buildUrl("Produtos")).toBe(buildUrl("/Produtos"));
  });
});

describe("apiGet", () => {
  it("devolve o corpo quando ele existe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse({ id: 1, nome: "Café" })));

    await expect(apiGet<{ id: number }>("/Produtos/1")).resolves.toEqual({ id: 1, nome: "Café" });
  });

  it("devolve null em HTTP 204", async () => {
    // REGRESSÃO: a assinatura antiga era `as T`, então o `null` que o client
    // produz chegava à tela tipado como objeto — e ela quebrava ao ler um campo.
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(null)));

    await expect(apiGet<{ id: number }>("/Cupons/por-codigo/INEXISTENTE")).resolves.toBeNull();
  });

  it("devolve null quando o corpo vem vazio com status 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "",
        headers: new Headers(),
      }) as unknown as Response),
    );

    await expect(apiGet("/Qualquer")).resolves.toBeNull();
  });
});

describe("apiGetOrThrow", () => {
  it("devolve o corpo quando ele existe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse({ items: [], pagination: {} })));

    await expect(apiGetOrThrow("/Produtos")).resolves.toEqual({ items: [], pagination: {} });
  });

  it("lança ApiError quando a resposta vem sem corpo", async () => {
    // Listagem paginada sem corpo é falha do servidor. Propagar null dali só
    // empurraria o problema para dentro da tela.
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(null)));

    await expect(apiGetOrThrow("/Produtos")).rejects.toBeInstanceOf(ApiError);
  });

  it("o erro identifica o endereço que falhou", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(null)));

    await expect(apiGetOrThrow("/Produtos")).rejects.toThrow(/\/Produtos/);
  });
});

describe("mapPagedResult", () => {
  it("traduz o formato do backend para o da UI", () => {
    // O backend manda `page`/`size`/`filteredItems`; a UI consome
    // `page`/`limit`/`total`. `totalPages` NÃO vem do servidor — é calculado
    // aqui, e é por isso que ele nunca diverge do total com o limite atual.
    const result = mapPagedResult({
      items: [{ id: 1 }, { id: 2 }],
      pagination: { page: 2, size: 10, filteredItems: 25 },
    });

    expect(result.data).toHaveLength(2);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  it("assume os padrões quando a paginação vem incompleta", () => {
    const result = mapPagedResult({ items: [{ id: 1 }], pagination: {} });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("nunca devolve menos de uma página, mesmo sem itens", () => {
    // Zero páginas deixaria a paginação da tela num estado impossível.
    const result = mapPagedResult({ items: [], pagination: { page: 1, size: 20, filteredItems: 0 } });

    expect(result.totalPages).toBe(1);
  });
});

describe("extractCreatedId", () => {
  it("lê o id do cabeçalho Location", () => {
    const response = {
      headers: new Headers({ Location: "/api/Produtos/42" }),
    } as unknown as Response;

    expect(extractCreatedId(response)).toBe(42);
  });

  it("devolve null sem cabeçalho Location", () => {
    const response = { headers: new Headers() } as unknown as Response;

    expect(extractCreatedId(response)).toBeNull();
  });
});

describe("fetchAllPages", () => {
  /**
   * Servidor paginado de mentira: devolve a fatia pedida de `items` e o total
   * declarado, que pode ser MAIOR que a lista — é assim que se simula o catálogo
   * grande sem materializar 6.000 objetos no teste.
   */
  function stubPagedApi(items: unknown[], declaredTotal = items.length) {
    const calls: { page: number; size: number; concurrent: number }[] = [];
    let inFlight = 0;
    let peak = 0;

    const fetchMock = vi.fn(async (url: string) => {
      const query = new URL(url, "http://local").searchParams;
      const page = Number(query.get("page") ?? 1);
      const size = Number(query.get("size") ?? 200);

      inFlight++;
      peak = Math.max(peak, inFlight);
      calls.push({ page, size, concurrent: inFlight });

      // Cede o event loop para as requisições realmente se sobreporem: sem isso
      // cada uma resolveria antes da próxima começar e o pico seria sempre 1.
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight--;

      return mockResponse({
        items: items.slice((page - 1) * size, page * size),
        pagination: { page, size, filteredItems: declaredTotal },
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    return { calls, peak: () => peak };
  }

  it("junta as páginas na ordem das páginas, não na ordem de resposta", async () => {
    // O resultado alimenta combo de seleção; ordem instável faria a mesma lista
    // aparecer embaralhada a cada carregamento.
    const items = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));
    stubPagedApi(items);

    await expect(fetchAllPages<{ id: number }>("/Categorias", undefined, 10)).resolves.toEqual(
      items,
    );
  });

  it("não pede a segunda página quando a primeira já trouxe tudo", async () => {
    const { calls } = stubPagedApi([{ id: 1 }, { id: 2 }]);

    await fetchAllPages("/Departamentos", undefined, 10);

    expect(calls).toHaveLength(1);
  });

  it("repassa os filtros em TODAS as páginas", async () => {
    // Mandar o filtro só na primeira página traria o catálogo inteiro da segunda
    // em diante — e a tela mostraria itens que o filtro deveria ter escondido.
    const items = Array.from({ length: 30 }, (_, index) => ({ id: index }));
    const { calls } = stubPagedApi(items);
    const fetchMock = vi.mocked(globalThis.fetch);

    await fetchAllPages("/ProductTags", { productId: 7 }, 10);

    expect(calls).toHaveLength(3);
    for (const [url] of fetchMock.mock.calls as unknown as [string][]) {
      expect(url).toContain("productId=7");
    }
  });

  it("limita quantas páginas vão ao servidor ao mesmo tempo", async () => {
    // REGRESSÃO: a versão anterior montava um Promise.all com todas as páginas
    // restantes — 40 requisições no mesmo tick, das quais o navegador executava
    // 6 e as outras 34 ficavam pendentes segurando memória.
    const items = Array.from({ length: 410 }, (_, index) => ({ id: index }));
    const { calls, peak } = stubPagedApi(items);

    await fetchAllPages("/Sales", undefined, 10);

    expect(calls).toHaveLength(41);
    expect(peak()).toBeLessThanOrEqual(6);
  });

  it("lança quando o total passa do teto, em vez de devolver a lista cortada", async () => {
    // Devolver os primeiros N pareceria uma lista legítima: o cliente sumido
    // viraria "cliente não cadastrado" e a venda faltante, faturamento menor.
    stubPagedApi([{ id: 1 }], FETCH_ALL_PAGES_MAX_ITEMS + 1);

    await expect(fetchAllPages("/Customers")).rejects.toThrow(/teto/);
  });

  it("o erro do teto nomeia o endereço e o total encontrado", async () => {
    stubPagedApi([{ id: 1 }], 123456);

    await expect(fetchAllPages("/Sales")).rejects.toThrow(/\/Sales.*123456/);
  });

  it("aceita teto próprio quando o padrão não serve", async () => {
    stubPagedApi([{ id: 1 }], 10);

    await expect(fetchAllPages("/Images", undefined, 200, { maxItems: 5 })).rejects.toThrow(
      /teto de 5/,
    );
  });

  it("aceita exatamente o total do teto", async () => {
    // Fronteira: o teto é inclusivo — 5.000 passa, 5.001 não.
    const items = Array.from({ length: 3 }, (_, index) => ({ id: index }));
    stubPagedApi(items, 3);

    await expect(fetchAllPages("/Tags", undefined, 200, { maxItems: 3 })).resolves.toHaveLength(3);
  });
});
