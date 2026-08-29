// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../client";
import type { StorefrontProductDto, UiPagedResult } from "../models";
import {
  getNextStorefrontPageParam,
  getStorefrontCompany,
  getStorefrontProduct,
  getStorefrontProductsPage,
} from "./storefront";

/**
 * O que estes testes protegem: a vitrine é o único caminho ANÔNIMO do
 * api-client. As duas propriedades que não podem regredir são (1) nenhuma
 * requisição levar `Authorization`, mesmo com uma sessão esquecida no
 * localStorage, e (2) um 401/404 virar erro tratável na tela em vez do
 * redirecionamento global para `/login` — rota que o site público não tem.
 */
describe("storefront API", () => {
  const emptyPage = (page: number, size: number, filteredItems: number) =>
    new Response(JSON.stringify({ items: [], pagination: { page, size, filteredItems } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  beforeEach(() => {
    // Sessão vencida esquecida no navegador: o cenário real de quem usou o
    // admin e depois visitou o site no mesmo host de dev.
    window.localStorage.setItem(
      "uaus-office-auth",
      JSON.stringify({ token: { type: "Bearer", value: "token-esquecido", expiration: "2020-01-01" } }),
    );
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("busca a página da vitrine sem header Authorization, mesmo com sessão no localStorage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyPage(1, 24, 0));
    vi.stubGlobal("fetch", fetchMock);

    await getStorefrontProductsPage({ search: "caneca" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/Storefront/products");
    expect(url).toContain("search=caneca");
    expect(url).toContain("page=1");
    expect(url).toContain("size=24");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("traduz o envelope de paginação do backend para o formato da interface", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(emptyPage(2, 24, 60)));

    const result = await getStorefrontProductsPage({ page: 2 });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(24);
    expect(result.total).toBe(60);
    expect(result.totalPages).toBe(3);
  });

  it("não redireciona para /login quando a vitrine recebe 401", async () => {
    // Não deveria acontecer (os endpoints são anônimos), mas se o servidor
    // recusar, o visitante precisa ver o estado de erro — não um 404 de /login.
    const assignSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign: assignSpy, pathname: "/produtos" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));

    await expect(getStorefrontProduct(10)).rejects.toBeInstanceOf(ApiError);
    expect(assignSpy).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("uaus-office-auth")).not.toBeNull();
  });

  it("propaga o 404 do detalhe como ApiError com a mensagem do backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "abc",
            code: 404,
            title: "NotFoundException",
            message: "Produto não encontrado ou indisponível no site.",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(getStorefrontProduct(999)).rejects.toMatchObject({
      status: 404,
      message: "Produto não encontrado ou indisponível no site.",
    });
  });

  it("busca a identidade da loja no endpoint público", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ storeName: "Uaus! Máximo 30" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const company = await getStorefrontCompany();

    expect(company.storeName).toBe("Uaus! Máximo 30");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/Storefront/company");
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).has("Authorization")).toBe(false);
  });

  describe("getNextStorefrontPageParam", () => {
    const pageOf = (page: number, totalPages: number): UiPagedResult<StorefrontProductDto> => ({
      data: [],
      page,
      limit: 24,
      total: totalPages * 24,
      totalPages,
    });

    it("avança enquanto houver página seguinte", () => {
      expect(getNextStorefrontPageParam(pageOf(1, 3))).toBe(2);
      expect(getNextStorefrontPageParam(pageOf(2, 3))).toBe(3);
    });

    it("encerra na última página — o bug clássico é pedir N+1 para sempre", () => {
      expect(getNextStorefrontPageParam(pageOf(3, 3))).toBeUndefined();
      expect(getNextStorefrontPageParam(pageOf(1, 1))).toBeUndefined();
    });
  });
});
