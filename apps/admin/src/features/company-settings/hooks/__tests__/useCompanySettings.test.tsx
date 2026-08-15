import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetCompanySettings: vi.fn(),
  updateCompanySettings: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCompanySettings: mocks.useGetCompanySettings,
  updateCompanySettings: mocks.updateCompanySettings,
  COMPANY_SETTINGS_QUERY_KEY: ["company-settings"],
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useCompanySettings } = await import("../useCompanySettings");

/** Evento de submit mínimo — o hook só chama `preventDefault`. */
const submitEvent = { preventDefault: () => {} } as unknown as React.FormEvent;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Configurações completas como o backend atual devolve (colunas NOT NULL DEFAULT ''). */
const serverSettings = {
  usesCashRegister: true,
  storeName: "MÁXIMO 30",
  addressLine: "RUA PARANAGUÁ, 663",
  phone: "Cel: (44) 99137-2305",
  document: "64.958.682/0001-22",
  receiptFooterMessage: "Obrigado pela preferência!",
  maxSellerDiscountPercentage: 0,
};

describe("useCompanySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetCompanySettings.mockReturnValue({
      data: { ...serverSettings },
      isLoading: false,
    });
    mocks.updateCompanySettings.mockResolvedValue({ ...serverSettings, usesCashRegister: false });
  });

  it("deve assumir o valor vindo do servidor", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
    expect(result.current.identity).toEqual({
      storeName: "MÁXIMO 30",
      addressLine: "RUA PARANAGUÁ, 663",
      phone: "Cel: (44) 99137-2305",
      document: "64.958.682/0001-22",
      receiptFooterMessage: "Obrigado pela preferência!",
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("deve tratar um backend sem os campos de identidade como campos vazios", async () => {
    // Segurança de versão: o backend anterior à identidade responde só o toggle.
    mocks.useGetCompanySettings.mockReturnValue({
      data: { usesCashRegister: true },
      isLoading: false,
    });

    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
    expect(result.current.identity.storeName).toBe("");
    expect(result.current.isDirty).toBe(false);
  });

  it("deve manter o controle de caixa ligado enquanto a leitura não chega", () => {
    mocks.useGetCompanySettings.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    // Mesmo padrão do backend: sem configuração, a loja opera com caixa.
    expect(result.current.usesCashRegister).toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  it("deve marcar alteração pendente ao desligar o toggle", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
    act(() => result.current.setUsesCashRegister(false));

    expect(result.current.isDirty).toBe(true);
  });

  it("deve marcar alteração pendente ao editar um campo da identidade", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.identity.storeName).toBe("MÁXIMO 30"));
    act(() => result.current.setIdentityField("storeName", "LOJA NOVA"));

    expect(result.current.identity.storeName).toBe("LOJA NOVA");
    // Os demais campos não podem ser arrastados pela edição de um só.
    expect(result.current.identity.addressLine).toBe("RUA PARANAGUÁ, 663");
    expect(result.current.isDirty).toBe(true);
  });

  it("não deve chamar a API quando não há alteração", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.updateCompanySettings).not.toHaveBeenCalled();
  });

  it("deve gravar o objeto completo e avisar o usuário", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
    act(() => result.current.setUsesCashRegister(false));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    // O PUT leva a linha inteira, não só o campo mexido: configurações são um
    // registro único e o backend grava o que receber.
    await waitFor(() =>
      expect(mocks.updateCompanySettings).toHaveBeenCalledWith({
        ...serverSettings,
        usesCashRegister: false,
      }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Configurações salvas" }),
      ),
    );
  });

  it("deve gravar a identidade aparada, sem espaços acidentais", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.identity.storeName).toBe("MÁXIMO 30"));
    act(() => result.current.setIdentityField("storeName", "  LOJA NOVA  "));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    // Espaço acidental viraria "campo preenchido" no cupom, furando o fallback.
    await waitFor(() =>
      expect(mocks.updateCompanySettings).toHaveBeenCalledWith(
        expect.objectContaining({ storeName: "LOJA NOVA" }),
      ),
    );
  });

  it("deve mostrar a mensagem do backend quando a gravação falha", async () => {
    // O `ApiError` já chega com o texto do backend em `message`.
    mocks.updateCompanySettings.mockRejectedValue(
      Object.assign(new Error("Apenas o administrador altera as configurações."), {
        status: 403,
        payload: { message: "Apenas o administrador altera as configurações." },
      }),
    );

    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
    act(() => result.current.setUsesCashRegister(false));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao salvar as configurações",
          description: "Apenas o administrador altera as configurações.",
          variant: "destructive",
        }),
      ),
    );
    // O toggle continua desligado: a falha não pode desfazer o que o usuário escolheu.
    expect(result.current.usesCashRegister).toBe(false);
  });
});
