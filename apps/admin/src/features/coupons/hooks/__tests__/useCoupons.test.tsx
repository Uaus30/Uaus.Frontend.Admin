import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COUPON_DISCOUNT_TYPE, getGetCouponsQueryKey, type CouponDto } from "@workspace/api-client-react";
import type { CouponForm } from "../../types";

const mocks = vi.hoisted(() => ({
  useGetCoupons: vi.fn(),
  useGetCampaigns: vi.fn(),
  createCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  deleteCoupon: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL:
// redefini-las aqui já mascarou uma quebra de invalidação em outra feature,
// porque o teste passava contra a chave inventada no mock e não contra a que a
// tela usa.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCoupons: mocks.useGetCoupons,
  useGetCampaigns: mocks.useGetCampaigns,
  createCoupon: mocks.createCoupon,
  updateCoupon: mocks.updateCoupon,
  deleteCoupon: mocks.deleteCoupon,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { PAGE_SIZE, useCoupons } = await import("../useCoupons");

/** Evento de submit mínimo — o hook só chama `preventDefault`. */
const submitEvent = { preventDefault: () => {} } as unknown as React.FormEvent;

/** Cupom novo em folha: nunca resgatado, portanto pode ser EXCLUÍDO. */
const cupomSemUso: CouponDto = {
  id: 1,
  createdAt: "2026-08-01T09:00:00",
  updatedAt: null,
  code: "BEMVINDO",
  description: "Primeira compra",
  // O backend serializa enum pelo NOME; o hook lê com `enumCode`.
  discountType: "Amount",
  discountValue: 20,
  validFrom: "2026-08-01T00:00:00",
  validUntil: "2026-12-31T23:59:59",
  usageLimit: 0,
  redeemedCount: 0,
  remainingUses: null,
  isActive: true,
};

/** Cupom já usado: exclusão proibida, e qualquer edição de definição confirma. */
const cupomResgatado: CouponDto = {
  id: 2,
  createdAt: "2026-08-01T09:00:00",
  updatedAt: null,
  code: "VERAO26",
  description: null,
  discountType: "Percentage",
  discountValue: 10,
  validFrom: "2026-09-01T00:00:00",
  validUntil: "2026-09-30T23:59:59",
  usageLimit: 500,
  redeemedCount: 143,
  remainingUses: 357,
  isActive: true,
  campaignId: 3,
  campaignName: "Setembro 2026",
};

/** Página de listagem no formato que o `useGetCoupons` real devolve. */
function paginaDeCupons(data: CouponDto[], page = 1, totalPages = 1) {
  return {
    data: { data, page, limit: PAGE_SIZE, total: data.length, totalPages },
    isLoading: false,
  };
}

function criarWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

/** Formulário preenchido de um cupom de setembro, com teto de usos EM BRANCO. */
const formVerao: CouponForm = {
  code: "verao26",
  description: "  Verão 2026  ",
  discountType: COUPON_DISCOUNT_TYPE.Percentage,
  discountValue: "10",
  validFromDate: new Date(2026, 8, 1),
  validFromTime: "00:00",
  validUntilDate: new Date(2026, 8, 30),
  validUntilTime: "23:59",
  usageLimit: "",
  isActive: true,
  campaignId: "",
};

describe("useCoupons", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useGetCoupons.mockReturnValue(paginaDeCupons([cupomSemUso, cupomResgatado]));
    mocks.useGetCampaigns.mockReturnValue({
      data: { data: [], page: 1, limit: 100, total: 0, totalPages: 1 },
      isLoading: false,
    });
    mocks.createCoupon.mockResolvedValue({ ...cupomSemUso, id: 99 });
    mocks.updateCoupon.mockResolvedValue(cupomResgatado);
    mocks.deleteCoupon.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve inicializar com os filtros neutros e pedir a primeira página", () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    expect(result.current.page).toBe(1);
    expect(result.current.searchInput).toBe("");
    expect(result.current.onlyActive).toBe(false);
    expect(result.current.coupons).toHaveLength(2);
    expect(mocks.useGetCoupons).toHaveBeenCalledWith({
      search: undefined,
      campaignId: undefined,
      onlyActive: false,
      page: 1,
      limit: PAGE_SIZE,
    });
  });

  it("deve aplicar a busca com debounce de 300ms e voltar à primeira página", () => {
    vi.useFakeTimers();
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setSearchInput("verao"));
    // O filtro só volta à página 1; a consulta ainda não mudou de termo.
    expect(result.current.page).toBe(1);
    expect(mocks.useGetCoupons).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: undefined, page: 1 }),
    );

    act(() => vi.advanceTimersByTime(300));

    expect(mocks.useGetCoupons).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "verao", page: 1 }),
    );
  });

  it("deve enviar o payload exato ao criar, com a vigência montada com hora", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleOpenCreate());
    act(() => result.current.setForm(formVerao));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.createCoupon).toHaveBeenCalledWith({
        code: "VERAO26",
        description: "Verão 2026",
        discountType: COUPON_DISCOUNT_TYPE.Percentage,
        discountValue: 10,
        // Instante local, nunca `toISOString()` — que voltaria um dia no Brasil.
        validFrom: "2026-09-01T00:00:00",
        // O fim fecha em :59 para o cupom valer o último dia INTEIRO.
        validUntil: "2026-09-30T23:59:59",
        usageLimit: 0,
        isActive: true,
        campaignId: null,
      }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Cupom cadastrado." })),
    );
    expect(result.current.modalOpen).toBe(false);
  });

  it("deve converter o teto de usos vazio em 0 (ilimitado), nunca em NaN", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleOpenCreate());
    act(() => result.current.setForm({ ...formVerao, usageLimit: "   " }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() => expect(mocks.createCoupon).toHaveBeenCalled());
    const enviado = mocks.createCoupon.mock.calls[0][0];
    expect(enviado.usageLimit).toBe(0);
    expect(Number.isNaN(enviado.usageLimit)).toBe(false);
  });

  it("deve recusar o teto de usos ilegível sem chamar a API", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleOpenCreate());
    act(() => result.current.setForm({ ...formVerao, usageLimit: "cem" }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.createCoupon).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Teto de usos inválido", variant: "destructive" }),
    );
  });

  it("deve invalidar o prefixo da listagem depois de salvar", async () => {
    const { wrapper, queryClient } = criarWrapper();
    const invalidar = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleOpenCreate());
    act(() => result.current.setForm(formVerao));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    // A chave vem do módulo real: se a factory passar a embutir parâmetros, este
    // teste quebra — que é justamente o sintoma de "a tela não atualiza".
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: getGetCouponsQueryKey() }));
  });

  it("não deve chamar a mutação quando a confirmação de exclusão é recusada", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleDelete(cupomSemUso));
    expect(result.current.confirmRequest).toEqual({ kind: "excluir", coupon: cupomSemUso });

    await act(async () => {
      result.current.handleConfirmDismiss();
    });

    expect(mocks.deleteCoupon).not.toHaveBeenCalled();
    expect(result.current.confirmRequest).toBeNull();
  });

  it("deve excluir depois da confirmação aceita", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleDelete(cupomSemUso));
    await act(async () => {
      result.current.handleConfirmAccept();
    });

    await waitFor(() => expect(mocks.deleteCoupon).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Cupom excluído." })),
    );
  });

  it("deve recuar de página ao excluir o último item da última página", async () => {
    mocks.useGetCoupons.mockReturnValue(paginaDeCupons([cupomSemUso], 3, 3));
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.handleDelete(cupomSemUso));
    await act(async () => {
      result.current.handleConfirmAccept();
    });

    // Sem o recuo, a tela ficaria presa numa página que deixou de existir e a
    // listagem vazia faria parecer que o cadastro inteiro sumiu.
    await waitFor(() => expect(result.current.page).toBe(2));
  });

  it("deve oferecer DESATIVAR, e não excluir, quando o cupom já tem resgate", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleDelete(cupomResgatado));
    expect(result.current.confirmRequest).toEqual({ kind: "desativar", coupon: cupomResgatado });

    await act(async () => {
      result.current.handleConfirmAccept();
    });

    expect(mocks.deleteCoupon).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.updateCoupon).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          code: "VERAO26",
          // "Percentage" tem de voltar como CÓDIGO; o nome faria o servidor ler
          // `None` e recusar com 400.
          discountType: COUPON_DISCOUNT_TYPE.Percentage,
          isActive: false,
        }),
      ),
    );
  });

  it("deve pedir confirmação com o número de resgates antes de alterar o valor de um cupom usado", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleOpenEdit(cupomResgatado));
    // O teto 500 volta para o formulário; só o valor do desconto muda.
    act(() => result.current.setForm({ ...result.current.form, discountValue: "15" }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.updateCoupon).not.toHaveBeenCalled();
    expect(result.current.confirmRequest).toMatchObject({
      kind: "salvar",
      coupon: { redeemedCount: 143 },
      payload: { discountValue: 15 },
    });

    await act(async () => {
      result.current.handleConfirmAccept();
    });

    await waitFor(() =>
      expect(mocks.updateCoupon).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ discountValue: 15, usageLimit: 500 }),
      ),
    );
  });

  it("deve salvar sem confirmação quando a edição não mexe na definição do cupom", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleOpenEdit(cupomResgatado));
    act(() => result.current.setForm({ ...result.current.form, description: "Campanha de setembro" }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(result.current.confirmRequest).toBeNull();
    await waitFor(() =>
      expect(mocks.updateCoupon).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          description: "Campanha de setembro",
          // A vigência volta idêntica: dia e hora foram remontados do instante
          // original, sem passar por `new Date("2026-09-30")`.
          validFrom: "2026-09-01T00:00:00",
          validUntil: "2026-09-30T23:59:59",
        }),
      ),
    );
  });

  it("deve mostrar a mensagem do backend quando a exclusão é recusada", async () => {
    mocks.deleteCoupon.mockRejectedValue(
      new Error("Um cupom que já foi utilizado não pode ser excluído. Desative-o."),
    );
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleDelete(cupomSemUso));
    await act(async () => {
      result.current.handleConfirmAccept();
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao excluir o cupom",
          description: "Um cupom que já foi utilizado não pode ser excluído. Desative-o.",
          variant: "destructive",
        }),
      ),
    );
  });

  it("deve recusar percentual acima de 100 sem chamar a API", async () => {
    const { wrapper } = criarWrapper();
    const { result } = renderHook(() => useCoupons(), { wrapper });

    act(() => result.current.handleOpenCreate());
    act(() => result.current.setForm({ ...formVerao, discountValue: "120" }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.createCoupon).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Percentual inválido", variant: "destructive" }),
    );
  });
});
