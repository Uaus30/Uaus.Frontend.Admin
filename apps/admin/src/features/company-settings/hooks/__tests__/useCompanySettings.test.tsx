import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetCompanySettings: vi.fn(),
  updateCompanySettings: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetCompanySettings: mocks.useGetCompanySettings,
  updateCompanySettings: mocks.updateCompanySettings,
  COMPANY_SETTINGS_QUERY_KEY: ["company-settings"],
}));

vi.mock("@/hooks/use-toast", () => ({
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

describe("useCompanySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetCompanySettings.mockReturnValue({
      data: { usesCashRegister: true },
      isLoading: false,
    });
    mocks.updateCompanySettings.mockResolvedValue({ usesCashRegister: false });
  });

  it("deve assumir o valor vindo do servidor", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
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

  it("não deve chamar a API quando não há alteração", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.updateCompanySettings).not.toHaveBeenCalled();
  });

  it("deve gravar o valor alterado e avisar o usuário", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.usesCashRegister).toBe(true));
    act(() => result.current.setUsesCashRegister(false));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.updateCompanySettings).toHaveBeenCalledWith({ usesCashRegister: false }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Configurações salvas" }),
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
