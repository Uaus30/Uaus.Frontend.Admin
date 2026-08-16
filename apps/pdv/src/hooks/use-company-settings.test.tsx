import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useGetCompanySettings = vi.fn();
const readCachedCompanySettings = vi.fn();
const writeCachedCompanySettings = vi.fn();

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCompanySettings: (...args: unknown[]) => useGetCompanySettings(...args),
}));

vi.mock("@/offline", () => ({
  readCachedCompanySettings: (...args: unknown[]) => readCachedCompanySettings(...args),
  writeCachedCompanySettings: (...args: unknown[]) => writeCachedCompanySettings(...args),
}));

vi.mock("@/stores/use-offline-store", () => ({
  useOfflineStore: (selector: (state: { online: boolean }) => unknown) => selector({ online: true }),
}));

const { useCompanySettings } = await import("./use-company-settings");

/** Configurações completas como o backend atual devolve, identidade inclusa. */
const SERVER_SETTINGS = {
  usesCashRegister: true,
  storeName: "LOJA NOVA",
  addressLine: "AV. BRASIL, 100",
  phone: "(11) 90000-0000",
  document: "11.222.333/0001-44",
  receiptFooterMessage: "Volte sempre!",
};

describe("useCompanySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readCachedCompanySettings.mockResolvedValue(null);
    writeCachedCompanySettings.mockResolvedValue(undefined);
  });

  it("deve usar a resposta do servidor, identidade da loja inclusa", async () => {
    useGetCompanySettings.mockReturnValue({ data: SERVER_SETTINGS });

    const { result } = renderHook(() => useCompanySettings());

    expect(result.current.settings).toEqual(SERVER_SETTINGS);
    expect(result.current.isFromCache).toBe(false);
    // A cópia local guarda o objeto inteiro: é ela que mantém o cabeçalho do
    // cupom correto num PDV vendendo offline.
    await waitFor(() => expect(writeCachedCompanySettings).toHaveBeenCalledWith(SERVER_SETTINGS));
  });

  it("deve cair na cópia local quando a API não respondeu", async () => {
    useGetCompanySettings.mockReturnValue({ data: undefined });
    readCachedCompanySettings.mockResolvedValue({ ...SERVER_SETTINGS, storeName: "LOJA CACHE" });

    const { result } = renderHook(() => useCompanySettings());

    await waitFor(() => expect(result.current.isFromCache).toBe(true));
    expect(result.current.settings.storeName).toBe("LOJA CACHE");
  });

  it("deve aceitar uma cópia local antiga, sem os campos de identidade", async () => {
    // Cache gravado por uma versão anterior do PDV: só o toggle de caixa. O
    // cupom resolve a ausência com os padrões embutidos (`resolveStoreInfo`).
    useGetCompanySettings.mockReturnValue({ data: undefined });
    readCachedCompanySettings.mockResolvedValue({ usesCashRegister: true });

    const { result } = renderHook(() => useCompanySettings());

    await waitFor(() => expect(result.current.isFromCache).toBe(true));
    expect(result.current.settings.usesCashRegister).toBe(true);
    expect(result.current.settings.storeName).toBeUndefined();
  });

  it("deve cair no padrão sem servidor e sem cópia local", () => {
    useGetCompanySettings.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useCompanySettings());

    expect(result.current.settings).toEqual({ usesCashRegister: false });
    expect(result.current.isFromCache).toBe(false);
  });

  it("deve avisar que a configuração ainda é palpite enquanto ninguém respondeu", async () => {
    // Quem decide a TELA a partir da configuração não pode agir sobre o padrão:
    // ele responde "loja sem controle de caixa", e quando a resposta de verdade
    // chega dizendo o contrário o PDV remontava inteiro. Ver a regra 11 do README
    // da feature.
    useGetCompanySettings.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useCompanySettings());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.settings.usesCashRegister).toBe(false);

    await waitFor(() => expect(readCachedCompanySettings).toHaveBeenCalled());
  });

  it("a resposta do servidor encerra a espera na hora", () => {
    useGetCompanySettings.mockReturnValue({ data: SERVER_SETTINGS, isLoading: false });

    const { result } = renderHook(() => useCompanySettings());

    // Sem esperar pela leitura da base local: já se sabe o que a loja usa.
    expect(result.current.isLoading).toBe(false);
  });

  it("cópia local ilegível não pode prender o PDV no spinner", async () => {
    // Um IndexedDB bloqueado (outra aba migrando o banco, modo privado) faria a
    // leitura falhar. Sem encerrar a espera na falha, a tela nunca apareceria.
    useGetCompanySettings.mockReturnValue({ data: undefined, isLoading: false });
    readCachedCompanySettings.mockRejectedValue(new Error("IndexedDB bloqueado"));

    const { result } = renderHook(() => useCompanySettings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toEqual({ usesCashRegister: false });
  });
});
