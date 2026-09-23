import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductAnomalyTypeName } from "@workspace/api-client-react";
import { relatorio } from "./fixtures";

const mocks = vi.hoisted(() => ({ useProductAnomalies: vi.fn() }));

vi.mock("@/features/product-anomalies/hooks/useProductAnomalies", () => ({
  useProductAnomalies: mocks.useProductAnomalies,
}));

const { default: ProductAnomaliesPage } = await import("@/pages/product-anomalies");

/** O que o hook devolve, com o relatório de exemplo; cada teste troca o que precisa. */
function tela(overrides: Record<string, unknown> = {}) {
  return {
    report: relatorio,
    items: relatorio.items,
    counts: new Map<ProductAnomalyTypeName, number>(relatorio.counts.map((c) => [c.type, c.groups])),
    total: relatorio.items.length,
    search: "",
    setSearch: vi.fn(),
    type: null,
    toggleType: vi.fn(),
    clearType: vi.fn(),
    isFiltered: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("página Anomalias", () => {
  beforeEach(() => mocks.useProductAnomalies.mockReturnValue(tela()));

  it("diz quando a varredura foi feita e quantos cadastros há para corrigir", () => {
    render(<ProductAnomaliesPage />);

    expect(screen.getByRole("heading", { name: "Anomalias" })).toBeTruthy();
    expect(screen.getByText(/Varredura de 23\/09\/2026 às 18:42 · 3 cadastros para corrigir/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Como ler esta tela/ })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /no cadastro, em nova aba/ })).toHaveLength(3);
  });

  it("catálogo sem anomalia é verde, com texto — nunca uma lista vazia muda", () => {
    const vazio = { ...relatorio, counts: [], items: [] };
    mocks.useProductAnomalies.mockReturnValue(
      tela({ report: vazio, items: [], counts: new Map(), total: 0 }),
    );

    render(<ProductAnomaliesPage />);

    expect(screen.getByText(/Nenhuma anomalia no catálogo/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /no cadastro/ })).toBeNull();
  });

  it("erro do servidor aparece na faixa vermelha", () => {
    mocks.useProductAnomalies.mockReturnValue(
      tela({ report: undefined, items: [], isError: true, error: new Error("Falha de rede") }),
    );

    render(<ProductAnomaliesPage />);

    expect(screen.getByText("Falha de rede")).toBeTruthy();
  });

  it("carregando, sem relatório ainda, não quebra nem mostra lista", () => {
    mocks.useProductAnomalies.mockReturnValue(
      tela({ report: undefined, items: [], total: 0, isLoading: true }),
    );

    render(<ProductAnomaliesPage />);

    expect(screen.queryByText(/Varredura de/)).toBeNull();
    expect(screen.queryByRole("link", { name: /no cadastro/ })).toBeNull();
  });
});
