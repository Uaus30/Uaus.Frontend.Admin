import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PartnerDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetPartners: vi.fn(),
  useGetPartnerProfitShares: vi.fn(),
  createPartner: vi.fn(),
  updatePartner: vi.fn(),
  deletePartner: vi.fn(),
  updatePartnerProfitShares: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL:
// redefini-las aqui já mascarou uma quebra de invalidação, porque o teste
// passava contra a chave inventada no mock e não contra a que a tela usa.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPartners: mocks.useGetPartners,
  useGetPartnerProfitShares: mocks.useGetPartnerProfitShares,
  createPartner: mocks.createPartner,
  updatePartner: mocks.updatePartner,
  deletePartner: mocks.deletePartner,
  updatePartnerProfitShares: mocks.updatePartnerProfitShares,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

const { usePartners } = await import("../usePartners");

/** Evento de submit mínimo — o hook só chama `preventDefault`. */
const submitEvent = { preventDefault: () => {} } as unknown as React.FormEvent;

const partnerAna: PartnerDto = {
  id: 1,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: null,
  name: "Ana Souza",
  profitSharePercentage: 75,
  isActive: true,
};

const partnerBruno: PartnerDto = {
  id: 2,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: null,
  name: "Bruno Lima",
  profitSharePercentage: 25,
  isActive: true,
};

const partnerCarlaInativa: PartnerDto = {
  id: 3,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: null,
  name: "Carla Dias",
  profitSharePercentage: 0,
  isActive: false,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("usePartners", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useGetPartners.mockReturnValue({
      data: {
        data: [partnerAna, partnerBruno, partnerCarlaInativa],
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
      },
      isLoading: false,
    });

    mocks.useGetPartnerProfitShares.mockReturnValue({
      data: {
        totalPercentage: 100,
        shares: [
          { partnerId: 1, partnerName: "Ana Souza", percentage: 75, isActive: true },
          { partnerId: 2, partnerName: "Bruno Lima", percentage: 25, isActive: true },
          { partnerId: 3, partnerName: "Carla Dias", percentage: 0, isActive: false },
        ],
      },
      isLoading: false,
    });

    mocks.createPartner.mockResolvedValue(99);
    mocks.updatePartner.mockResolvedValue(partnerAna);
    mocks.deletePartner.mockResolvedValue(undefined);
    mocks.updatePartnerProfitShares.mockResolvedValue({ totalPercentage: 100, shares: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve inicializar com os estados padrão e listar todos os sócios", () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.searchVal).toBe("");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.partners).toHaveLength(3);
    // A listagem pede inativos também — a UI é quem filtra.
    expect(mocks.useGetPartners).toHaveBeenCalledWith({
      includeInactive: true,
      page: 1,
      limit: 10,
    });
  });

  it("deve aplicar a busca local com debounce de 300ms e voltar à primeira página", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    act(() => result.current.setPage(2));
    act(() => result.current.setSearchVal("bru"));

    // Antes do debounce, nada muda.
    expect(result.current.partners).toHaveLength(3);

    act(() => vi.advanceTimersByTime(300));

    expect(result.current.partners).toEqual([partnerBruno]);
    expect(result.current.page).toBe(1);
  });

  it("deve ignorar acentos na busca por nome", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    act(() => result.current.setSearchVal("sóuza"));
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.partners).toEqual([partnerAna]);
  });

  it("deve abrir a modal em modo de edição com os dados do sócio", () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenModal(partnerAna));

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(1);
    expect(result.current.editingWasActive).toBe(true);
    expect(result.current.form).toEqual({ name: "Ana Souza", isActive: true });
  });

  it("deve criar o sócio só com o nome ao submeter no modo de criação", async () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenModal());
    act(() => result.current.setForm({ name: "  Diego Nunes  ", isActive: true }));
    await act(async () => {
      result.current.handleSubmitPartner(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.createPartner).toHaveBeenCalledWith({ name: "Diego Nunes" }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sócio cadastrado." }),
      ),
    );
    expect(result.current.modalOpen).toBe(false);
  });

  it("deve atualizar nome e status ao submeter no modo de edição", async () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenModal(partnerAna));
    act(() => result.current.setForm({ name: "Ana S. Souza", isActive: false }));
    await act(async () => {
      result.current.handleSubmitPartner(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.updatePartner).toHaveBeenCalledWith(1, {
        name: "Ana S. Souza",
        isActive: false,
      }),
    );
    // Desativar zera o percentual — o toast avisa para rebalancear.
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Sócio atualizado.",
          description:
            "O percentual foi zerado — rebalanceie a distribuição antes do próximo fechamento.",
        }),
      ),
    );
  });

  it("não deve chamar a API quando o nome está vazio", async () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenModal());
    act(() => result.current.setForm({ name: "   ", isActive: true }));
    await act(async () => {
      result.current.handleSubmitPartner(submitEvent);
    });

    expect(mocks.createPartner).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("não deve excluir quando a confirmação é recusada", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.handleDeletePartner(partnerAna);
    });

    expect(mocks.deletePartner).not.toHaveBeenCalled();
  });

  it("deve excluir o sócio após a confirmação", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.handleDeletePartner(partnerAna);
    });

    await waitFor(() => expect(mocks.deletePartner).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Sócio removido." }),
      ),
    );
  });

  it("deve mostrar a mensagem do backend quando o sócio tem fechamentos registrados", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    // O `ApiError` já chega com o texto do backend em `message`.
    mocks.deletePartner.mockRejectedValue(
      new Error("Este sócio possui fechamentos registrados! Desative-o em vez de excluir."),
    );

    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.handleDeletePartner(partnerAna);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao remover sócio",
          description:
            "Este sócio possui fechamentos registrados! Desative-o em vez de excluir.",
          variant: "destructive",
        }),
      ),
    );
  });

  it("deve carregar no rascunho apenas os percentuais dos sócios ativos", async () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(result.current.draftPercentages).toEqual({ 1: "75", 2: "25" }),
    );
    expect(result.current.activeShares).toHaveLength(2);
    expect(result.current.sharesSum).toBe(100);
    expect(result.current.isSharesSumValid).toBe(true);
    // Soma 100 sem mudança pendente: nada a salvar.
    expect(result.current.canSaveShares).toBe(false);
  });

  it("deve bloquear salvar enquanto a soma difere de 100", async () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.draftPercentages).toEqual({ 1: "75", 2: "25" }));
    act(() => result.current.setSharePercentage(1, "70"));

    expect(result.current.sharesSum).toBe(95);
    expect(result.current.isSharesSumValid).toBe(false);
    expect(result.current.canSaveShares).toBe(false);

    await act(async () => {
      result.current.handleSaveShares(submitEvent);
    });

    expect(mocks.updatePartnerProfitShares).not.toHaveBeenCalled();
  });

  it("deve salvar a distribuição com exatamente os sócios ativos quando a soma fecha em 100", async () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.draftPercentages).toEqual({ 1: "75", 2: "25" }));
    act(() => result.current.setSharePercentage(1, "70"));
    act(() => result.current.setSharePercentage(2, "30"));

    expect(result.current.sharesSum).toBe(100);
    expect(result.current.canSaveShares).toBe(true);

    await act(async () => {
      result.current.handleSaveShares(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.updatePartnerProfitShares).toHaveBeenCalledWith({
        shares: [
          { partnerId: 1, percentage: 70 },
          { partnerId: 2, percentage: 30 },
        ],
      }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Distribuição de lucros salva." }),
      ),
    );
  });

  it("deve validar a soma sobre os valores arredondados por sócio — os mesmos do payload", async () => {
    mocks.useGetPartnerProfitShares.mockReturnValue({
      data: {
        totalPercentage: 100,
        shares: [
          { partnerId: 1, partnerName: "Ana Souza", percentage: 34, isActive: true },
          { partnerId: 2, partnerName: "Bruno Lima", percentage: 33, isActive: true },
          { partnerId: 3, partnerName: "Carla Dias", percentage: 33, isActive: true },
        ],
      },
      isLoading: false,
    });

    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.activeShares).toHaveLength(3));

    // Cru, 33,336 + 33,336 + 33,33 soma 100,00 (o gate antigo liberava); por
    // sócio arredonda para 33,34 + 33,34 + 33,33 = 100,01 — o payload que o
    // servidor recusaria. O gate precisa somar os números do payload.
    act(() => result.current.setSharePercentage(1, "33.336"));
    act(() => result.current.setSharePercentage(2, "33.336"));
    act(() => result.current.setSharePercentage(3, "33.33"));

    expect(result.current.sharesSum).toBe(100.01);
    expect(result.current.isSharesSumValid).toBe(false);
    expect(result.current.canSaveShares).toBe(false);
  });

  it("deve normalizar o percentual digitado para 2 casas ao sair do campo", async () => {
    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.draftPercentages).toEqual({ 1: "75", 2: "25" }));

    act(() => result.current.setSharePercentage(1, "33.336"));
    act(() => result.current.handleSharePercentageBlur(1));
    expect(result.current.draftPercentages[1]).toBe("33.34");

    // Campo vazio ou não numérico fica como está — a validação da soma acusa.
    act(() => result.current.setSharePercentage(2, ""));
    act(() => result.current.handleSharePercentageBlur(2));
    expect(result.current.draftPercentages[2]).toBe("");
  });

  it("deve aceitar percentuais quebrados sem erro de ponto flutuante", async () => {
    mocks.useGetPartnerProfitShares.mockReturnValue({
      data: {
        totalPercentage: 100,
        shares: [
          { partnerId: 1, partnerName: "Ana Souza", percentage: 33.33, isActive: true },
          { partnerId: 2, partnerName: "Bruno Lima", percentage: 33.33, isActive: true },
          { partnerId: 3, partnerName: "Carla Dias", percentage: 33.34, isActive: true },
        ],
      },
      isLoading: false,
    });

    const { result } = renderHook(() => usePartners(), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(result.current.draftPercentages).toEqual({ 1: "33.33", 2: "33.33", 3: "33.34" }),
    );
    // 33.33 + 33.33 + 33.34 em binário não dá 100 exato — a soma arredonda a 2 casas.
    expect(result.current.sharesSum).toBe(100);
    expect(result.current.isSharesSumValid).toBe(true);
  });
});
