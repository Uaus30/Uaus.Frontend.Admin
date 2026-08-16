import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerSummaryDto } from "@workspace/api-client-react";
import { useCustomers } from "../useCustomers";

/**
 * A tela de clientes depois do item 4.1.
 *
 * O que estes testes protegem, além do comportamento: o consolidado de compras
 * vem SOMADO do servidor. Antes a tela chamava `useAllSales()`, que varria a
 * tabela de vendas inteira — todas as páginas, sem filtro — para calcular três
 * colunas de quinze linhas, e lançava ao passar de 20 mil vendas. Reintroduzir
 * aquela varredura não quebraria nada visível; por isso "não pede /Sales" é
 * teste, não comentário.
 */

const maria: CustomerSummaryDto = {
  id: 1,
  createdAt: "2026-06-18T00:00:00",
  updatedAt: null,
  name: "Maria Silva",
  email: "maria@test.com",
  phone: "11999999999",
  document: "123.456.789-00",
  address: "Rua A, 123",
  totalPurchased: 200,
  purchaseCount: 2,
  lastPurchaseAt: "2026-08-01T10:00:00",
};

/** Cliente novo: existe, nunca comprou. */
const joao: CustomerSummaryDto = {
  id: 2,
  createdAt: "2026-08-10T00:00:00",
  updatedAt: null,
  name: "João Santos",
  email: null,
  phone: null,
  document: null,
  address: null,
  totalPurchased: 0,
  purchaseCount: 0,
  lastPurchaseAt: null,
};

/**
 * `fetch` dublado no nível mais baixo de propósito: dublar o hook de consulta
 * esconderia exatamente o que mudou — quantas e quais requisições a tela faz.
 */
const fetchMock = vi.fn(async (url: string | URL) => {
  const href = String(url);

  if (href.includes("/Customers/summary")) {
    return new Response(
      JSON.stringify({
        items: [maria, joao],
        pagination: { page: 1, size: 15, filteredItems: 2 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  throw new Error(`Requisição inesperada: ${href}`);
});

vi.stubGlobal("fetch", fetchMock);

/** URLs pedidas ao servidor, sem o host. */
function caminhosPedidos(): string[] {
  return fetchMock.mock.calls.map((call) => {
    const url = new URL(String(call[0]));
    return `${url.pathname}${url.search}`;
  });
}

const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

const mockCreateCustomer = vi.fn();
const mockUpdateCustomer = vi.fn();
const mockDeleteCustomer = vi.fn();

// Só as MUTAÇÕES são dubladas. A consulta roda de verdade contra o `fetch`
// acima — é ela que carrega a mudança deste item.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useCreateCustomer: vi.fn(() => ({ mutate: mockCreateCustomer, isPending: false })),
  useUpdateCustomer: vi.fn(() => ({ mutate: mockUpdateCustomer, isPending: false })),
  useDeleteCustomer: vi.fn(() => ({ mutateAsync: mockDeleteCustomer, isPending: false })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCustomers Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega a página com UMA requisição e sem varrer as vendas", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.statsByCustomerId.size).toBe(2));

    const caminhos = caminhosPedidos();
    expect(caminhos).toHaveLength(1);
    expect(caminhos[0]).toContain("/Customers/summary");
    // A varredura de /Sales é o custo que este item eliminou: ela crescia com a
    // operação da loja e derrubava a tela ao passar de 20 mil vendas.
    expect(caminhos.some((caminho) => caminho.includes("/Sales"))).toBe(false);
  });

  it("expõe o consolidado que o servidor somou, sem recalcular no navegador", async () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.statsByCustomerId.size).toBe(2));

    expect(result.current.statsByCustomerId.get(1)).toEqual({
      totalPurchases: 200,
      purchaseCount: 2,
      lastPurchaseAt: "2026-08-01T10:00:00",
    });
  });

  it("distingue quem nunca comprou de quem comprou hoje", async () => {
    // `lastPurchaseAt` nulo tem que continuar nulo até a tela: uma data zerada
    // apareceria na coluna como 01/01/0001, com cara de compra real.
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.statsByCustomerId.size).toBe(2));

    expect(result.current.statsByCustomerId.get(2)).toEqual({
      totalPurchases: 0,
      purchaseCount: 0,
      lastPurchaseAt: null,
    });
  });

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.searchVal).toBe("");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.isSaving).toBe(false);
  });

  it("deve gerenciar a abertura da modal em modo de criação", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleOpenModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.formData.name).toBe("");
  });

  it("deve gerenciar a abertura da modal em modo de edição", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleOpenModal(maria);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(1);
    expect(result.current.formData.name).toBe("Maria Silva");
    expect(result.current.formData.email).toBe("maria@test.com");
  });

  it("deve chamar a mutação correspondente ao salvar um cliente", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    const payload = {
      name: "João Santos",
      email: "joao@test.com",
      phone: "11988888888",
      document: "111.222.333-44",
      address: "Rua B, 456",
    };

    act(() => {
      result.current.handleSaveCustomer(payload);
    });

    expect(mockCreateCustomer).toHaveBeenCalledWith({ data: payload });
  });

  it("exclui sem passar por window.confirm e devolve a Promise da mutação", async () => {
    // A confirmação saiu do hook e virou o `ConfirmDialog`, renderizado pela
    // tabela — é ela que sabe QUAL linha o operador clicou, e é o nome dessa
    // linha que o diálogo mostra. O `window.confirm` que morava aqui travava a
    // thread, ignorava o tema e perguntava "Remover este cliente?" sem dizer
    // qual: em tabela paginada, errar o ícone da linha é o engano mais comum.
    //
    // A Promise importa: o diálogo só fecha quando ela resolve, e permanece
    // aberto se o servidor recusar. Devolver `void` faria o diálogo sumir e o
    // operador teria que reencontrar a linha para descobrir que nada mudou.
    mockDeleteCustomer.mockResolvedValueOnce(undefined);
    const confirmSpy = vi.spyOn(window, "confirm");

    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.handleDeleteCustomer(1);
    });

    expect(mockDeleteCustomer).toHaveBeenCalledWith({ id: 1 });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("propaga a recusa do servidor em vez de engolir", async () => {
    // É o que mantém o diálogo aberto quando a exclusão falha.
    mockDeleteCustomer.mockRejectedValueOnce(new Error("Cliente tem venda vinculada"));

    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    await expect(result.current.handleDeleteCustomer(1)).rejects.toThrow("Cliente tem venda vinculada");
  });
});
