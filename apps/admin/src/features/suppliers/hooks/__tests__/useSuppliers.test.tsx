import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGetSuppliersQueryKey, type SupplierDto } from "@workspace/api-client-react";
import { useSuppliers } from "../useSuppliers";
import type { SupplierForm } from "../../types";

/**
 * Dublê do api-client, só do que fala com a rede. `useGetSuppliers` recebe os
 * params para o teste poder afirmar o que foi ao SERVIDOR — é a regressão do
 * filtro de status, que já foi aplicado no cliente sobre a página recortada.
 */
const mocks = vi.hoisted(() => ({
  useGetSuppliers: vi.fn(),
  createSupplier: vi.fn(() => Promise.resolve(null)),
  updateSupplier: vi.fn(() => Promise.resolve(null)),
  deleteSupplier: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetSuppliers: mocks.useGetSuppliers,
  useGetSupplierStatusOptions: () => ({
    data: [
      { id: 1, name: "Ativo", value: "ativo", allowSelect: true },
      { id: 2, name: "Inativo", value: "inativo", allowSelect: true },
    ],
  }),
  useCreateSupplier: () => ({ mutateAsync: mocks.createSupplier, isPending: false }),
  useUpdateSupplier: () => ({ mutateAsync: mocks.updateSupplier, isPending: false }),
  useDeleteSupplier: () => ({ mutateAsync: mocks.deleteSupplier, isPending: false }),
}));

// Mock do toast
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

const SUPPLIER_10: SupplierDto = {
  id: 10,
  createdAt: "2026-08-01T10:00:00",
  updatedAt: null,
  name: "Supplier A",
  corporateName: null,
  document: null,
  salesRepresentative: "",
  phone: "",
  email: null,
  minimumPurchaseValue: 100,
  status: 1,
  city: "",
  state: "PR",
  avatarColor: "#6366f1",
  description: null,
  isRecurring: false,
  isMarketplace: false,
  type: "Wholesale",
};

/** Wrapper com o QueryClient REAL — o teste de invalidação depende do cache de verdade. */
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useSuppliers Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetSuppliers.mockReturnValue({
      data: { data: [SUPPLIER_10], total: 1, page: 1, limit: 20 },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  describe("filtro por status", () => {
    it("envia o status ao SERVIDOR, atravessando todas as páginas", async () => {
      // REGRESSÃO: o filtro era aplicado depois, sobre a página já recortada.
      // Numa base de 200 fornecedores, filtrar por "Inativo" mostrava só os
      // inativos que por acaso caíram nos 20 da página corrente — e o contador
      // de páginas continuava contando todos, produzindo páginas vazias.
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      await act(async () => {
        result.current.setStatusFilter("2");
      });

      await vi.waitFor(() => {
        expect(mocks.useGetSuppliers).toHaveBeenLastCalledWith(expect.objectContaining({ status: 2 }));
      });
    });

    it('não envia status quando o filtro é "all"', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      expect(result.current.statusFilter).toBe("all");
      expect(mocks.useGetSuppliers).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
    });

    it("volta para a primeira página ao trocar o filtro", async () => {
      // A página 3 do conjunto anterior pode nem existir no novo.
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      await act(async () => {
        result.current.setPage(3);
      });
      expect(result.current.page).toBe(3);

      await act(async () => {
        result.current.setStatusFilter("2");
      });

      await vi.waitFor(() => expect(result.current.page).toBe(1));
    });
  });

  it("deve inicializar com os estados padrão corretos", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSuppliers(), { wrapper });

    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(20);
    expect(result.current.searchVal).toBe("");
    expect(result.current.statusFilter).toBe("all");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it("deve abrir a modal em modo de criação", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSuppliers(), { wrapper });

    act(() => {
      result.current.handleOpenModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.form.name).toBe("");
  });

  it("deve abrir a modal em modo de edição e carregar os dados corretos", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSuppliers(), { wrapper });

    act(() => {
      result.current.handleOpenModal(SUPPLIER_10);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(10);
    expect(result.current.form.name).toBe("Supplier A");
    expect(result.current.form.minimumPurchaseValue).toBe("100");
  });

  describe("status pelo nome do enum (15/10/2026)", () => {
    // REGRESSÃO: a API serializa o status pelo NOME (`JsonStringEnumConverter`),
    // e o dublê antigo mandava `status: 1` — por isso o defeito passou. A modal
    // procurava "Inactive" entre as opções "1" e "2", caía em Ativo e o próximo
    // Salvar reativava o fornecedor.
    const INATIVO: SupplierDto = { ...SUPPLIER_10, status: "Inactive" };

    it("abre a edição de um fornecedor inativo com o status Inativo", () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      act(() => result.current.handleOpenModal(INATIVO));

      expect(result.current.form.status).toBe("2");
    });

    it("salvar sem mexer no status mantém o fornecedor inativo", async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      act(() => result.current.handleOpenModal(INATIVO));
      await act(async () => {
        await result.current.handleSubmitSupplier(result.current.form);
      });

      expect(mocks.updateSupplier).toHaveBeenCalledWith({
        id: 10,
        data: expect.objectContaining({ status: 2 }),
      });
    });

    it('lê "Active" como Ativo', () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      act(() => result.current.handleOpenModal({ ...SUPPLIER_10, status: "Active" }));

      expect(result.current.form.status).toBe("1");
    });
  });

  it("deve chamar createSupplier ao submeter formulário no modo de criação", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSuppliers(), { wrapper });

    const newSupplier: SupplierForm = {
      name: "Supplier B",
      corporateName: "Supplier Corp",
      document: "123",
      salesRepresentative: "John Doe",
      phone: "11999999999",
      email: "b@test.com",
      minimumPurchaseValue: "150",
      status: "1",
      city: "Curitiba",
      state: "PR",
      avatarColor: "#6366f1",
      description: "Test description",
      isRecurring: true,
      type: "Marketplace",
    };

    await act(async () => {
      await result.current.handleSubmitSupplier(newSupplier);
    });

    expect(mocks.createSupplier).toHaveBeenCalledWith({
      data: {
        name: "Supplier B",
        corporateName: "Supplier Corp",
        document: "123",
        salesRepresentative: "John Doe",
        phone: "11999999999",
        email: "b@test.com",
        minimumPurchaseValue: 150,
        status: 1,
        city: "Curitiba",
        state: "PR",
        avatarColor: "#6366f1",
        description: "Test description",
        // A marca e o tipo precisam chegar ao servidor: o tipo Marketplace
        // decide se a COMPRA vai exigir o link do anúncio, e perdê-lo aqui
        // liberaria a regra em silêncio. `isMarketplace` não vai mais: virou
        // derivado do tipo no servidor (14/10/2026).
        isRecurring: true,
        type: "Marketplace",
      },
    });
  });

  describe("tipo do fornecedor (14/10/2026)", () => {
    /** O corpo da última edição enviada — o dublê não declara parâmetros, daí o cast. */
    function ultimaEdicao() {
      const chamada = mocks.updateSupplier.mock.calls.at(-1) as unknown[] | undefined;
      return chamada?.[0] as { data: Record<string, unknown> };
    }

    /** O formulário do cadastro novo como a modal o devolve, com o tipo escolhido ou não. */
    function formulario(type: SupplierForm["type"]): SupplierForm {
      return {
        name: "Master",
        corporateName: "",
        document: "",
        salesRepresentative: "",
        phone: "",
        email: "",
        minimumPurchaseValue: "0",
        status: "1",
        city: "Maringá",
        state: "PR",
        avatarColor: "#6366f1",
        description: "",
        isRecurring: false,
        type,
      };
    }

    it("o cadastro novo nasce sem tipo pré-escolhido", () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      act(() => result.current.handleOpenModal());

      // Um padrão seria aceito sem ler — e o tipo muda regra de compra e de estoque.
      expect(result.current.form.type).toBe("");
    });

    it("não cadastra sem tipo: avisa em português antes de ir à rede", async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      act(() => result.current.handleOpenModal());
      await act(async () => {
        await result.current.handleSubmitSupplier(formulario(""));
      });

      // Sem o aviso daqui, a recusa 400 da API chegaria como toast genérico.
      expect(mocks.createSupplier).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Escolha o tipo do fornecedor", variant: "destructive" }),
      );
    });

    it("a edição carrega o tipo gravado e o manda de volta", async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });

      act(() => result.current.handleOpenModal(SUPPLIER_10));
      expect(result.current.form.type).toBe("Wholesale");

      await act(async () => {
        await result.current.handleSubmitSupplier(result.current.form);
      });

      expect(mocks.updateSupplier).toHaveBeenCalledWith({
        id: 10,
        data: expect.objectContaining({ type: "Wholesale" }),
      });
      const enviado = ultimaEdicao();
      expect(enviado.data).not.toHaveProperty("isMarketplace");
    });

    it("editar fornecedor sem tipo (backend anterior) não manda o campo — o servidor mantém o gravado", async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuppliers(), { wrapper });
      const { type: _semTipo, ...antigo } = SUPPLIER_10;

      act(() => result.current.handleOpenModal(antigo));
      expect(result.current.form.type).toBe("");

      await act(async () => {
        await result.current.handleSubmitSupplier(result.current.form);
      });

      // A edição não exige tipo: exigir travaria o Salvar de todo fornecedor antigo.
      const enviado = ultimaEdicao();
      expect(enviado.data).not.toHaveProperty("type");
    });
  });

  it("remove o fornecedor sem passar por window.confirm e invalida o prefixo", async () => {
    // A pergunta agora é do `ConfirmDialog` da tabela. O teste antigo precisava
    // dublar `window.confirm` para chegar até aqui — sinal de que a confirmação
    // estava no lugar errado.
    const { queryClient, wrapper } = createWrapper();
    const catalogoCompleto = [...getGetSuppliersQueryKey(), "all"];
    queryClient.setQueryData(catalogoCompleto, []);

    const { result } = renderHook(() => useSuppliers(), { wrapper });

    await act(async () => {
      await result.current.handleDeleteSupplier(10);
    });

    expect(mocks.deleteSupplier).toHaveBeenCalledWith({ id: 10 });
    expect(queryClient.getQueryState(catalogoCompleto)?.isInvalidated).toBe(true);
  });
});
