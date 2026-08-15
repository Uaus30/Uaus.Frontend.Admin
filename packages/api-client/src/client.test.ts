import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiGetOrThrow, buildUrl, extractCreatedId, mapPagedResult } from "./client";

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
