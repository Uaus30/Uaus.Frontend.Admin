import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { useCatalogFilters } from "../useCatalogFilters";

/**
 * O que estes testes protegem: o filtro da vitrine mora na URL, e é isso que
 * faz o link compartilhado, o F5 e o Voltar do navegador devolverem a mesma
 * lista. Cada caso roda numa localização em memória própria — a do jsdom é
 * global e vazaria o `?busca=` de um teste para o seguinte.
 */
function renderFilters(searchPath = "") {
  const location = memoryLocation({ path: "/produtos", searchPath, record: true });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Router, { hook: location.hook }, children);

  return { ...renderHook(() => useCatalogFilters(), { wrapper }), location };
}

describe("useCatalogFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lê departamento, categoria e busca da URL", () => {
    const { result } = renderFilters("departamento=2&categoria=10&busca=panela");

    expect(result.current.filters).toEqual({ departmentId: 2, categoryId: 10, search: "panela" });
    expect(result.current.searchInput).toBe("panela");
    expect(result.current.hasFilters).toBe(true);
  });

  it("trata id inválido como ausência de filtro", () => {
    // Query string é colada de link velho e digitada por gente: derrubar a
    // vitrine por causa de `?departamento=abc` seria trocar um filtro ignorado
    // por uma página quebrada.
    const { result } = renderFilters("departamento=abc&categoria=0");

    expect(result.current.filters.departmentId).toBeUndefined();
    expect(result.current.filters.categoryId).toBeUndefined();
    expect(result.current.hasFilters).toBe(false);
  });

  it("grava a busca na URL depois do debounce, preservando o filtro", () => {
    const { result, location } = renderFilters("departamento=2");

    act(() => result.current.setSearchInput("caneca"));
    expect(result.current.isSearchPending).toBe(true);

    act(() => vi.advanceTimersByTime(300));

    expect(location.history?.at(-1)).toBe("/produtos?departamento=2&busca=caneca");
    expect(result.current.isSearchPending).toBe(false);
  });

  it("grava a busca com REPLACE — digitar não pode entupir o histórico", () => {
    const { result, location } = renderFilters();
    const before = location.history?.length ?? 0;

    act(() => result.current.setSearchInput("can"));
    act(() => vi.advanceTimersByTime(300));
    act(() => result.current.setSearchInput("caneca"));
    act(() => vi.advanceTimersByTime(300));

    // Duas gravações, nenhuma entrada nova: com push, voltar da vitrine exigiria
    // um clique por letra digitada.
    expect(location.history).toHaveLength(before);
    expect(location.history?.at(-1)).toContain("busca=caneca");
  });

  it("adota o valor da URL quando ela muda por fora (Voltar, trilha, chip)", () => {
    const { result, location } = renderFilters("busca=caneca");

    act(() => location.navigate("/produtos?busca=caderno"));

    expect(result.current.searchInput).toBe("caderno");
    expect(result.current.filters.search).toBe("caderno");
  });

  it("não ressuscita a busca quando o filtro é limpo com o debounce em voo", () => {
    const { result, location } = renderFilters("busca=can");

    // Digitou mais uma letra e, antes de o debounce vencer, clicou em
    // "Limpar tudo". Sem a guarda no efeito, a gravação atrasada devolvia a
    // busca à URL meio segundo depois de a tela já estar limpa.
    act(() => result.current.setSearchInput("cane"));
    act(() => location.navigate("/produtos"));
    act(() => vi.advanceTimersByTime(600));

    expect(result.current.searchInput).toBe("");
    expect(result.current.filters.search).toBeUndefined();
    expect(location.history?.at(-1)).toBe("/produtos");
  });
});
