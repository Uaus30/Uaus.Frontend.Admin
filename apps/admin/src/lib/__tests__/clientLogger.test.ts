import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reportClientError, resetClientLoggerState } from "../clientLogger";
import { createLog, ApiError } from "@workspace/api-client-react";

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  createLog: vi.fn(() => Promise.resolve({ id: 1 })),
}));

describe("clientLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetClientLoggerState();
    vi.stubGlobal("window", {
      location: {
        href: "http://localhost:5173/produtos",
        pathname: "/produtos",
      },
    });
    vi.stubGlobal("navigator", {
      onLine: true,
      userAgent: "Mozilla/5.0 Vitest",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia o erro capturado para a API com a origem e detalhes formatados", async () => {
    const error = new Error("Falha ao salvar produto");
    const result = await reportClientError(error);

    expect(result).toBe(true);
    expect(createLog).toHaveBeenCalledTimes(1);
    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 3,
        origin: "[Front-Admin] /produtos",
        message: "Falha ao salvar produto",
      }),
    );

    const callArgs = vi.mocked(createLog).mock.calls[0][0];
    expect(callArgs.details).toContain("http://localhost:5173/produtos");
    expect(callArgs.details).toContain("Falha ao salvar produto");
  });

  it("descarta erros 401 de sessão expirada", async () => {
    const apiError = new ApiError("Sessão expirada", 401, null, "GET", "/Products");
    const result = await reportClientError(apiError);

    expect(result).toBe(false);
    expect(createLog).not.toHaveBeenCalled();
  });

  it("não tenta reportar falhas no próprio endpoint /Logs para evitar loop", async () => {
    const apiError = new ApiError("Erro ao gravar log", 500, null, "POST", "/Logs");
    const result = await reportClientError(apiError);

    expect(result).toBe(false);
    expect(createLog).not.toHaveBeenCalled();
  });

  it("descarta logs quando o navegador está offline", async () => {
    vi.stubGlobal("navigator", { onLine: false, userAgent: "Vitest" });

    const error = new Error("Falha de conexão");
    const result = await reportClientError(error);

    expect(result).toBe(false);
    expect(createLog).not.toHaveBeenCalled();
  });

  it("deduplica erros idênticos ocorridos em sequência dentro da janela de 5 segundos", async () => {
    const error = new Error("Erro repetitivo");

    const result1 = await reportClientError(error);
    const result2 = await reportClientError(error);

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(createLog).toHaveBeenCalledTimes(1);
  });

  it("aceita origem e metadados customizados", async () => {
    const error = new Error("Falha específica");
    const result = await reportClientError(error, {
      origin: "[PDV] /caixa",
      type: 4,
      extraDetails: { saleId: 123 },
    });

    expect(result).toBe(true);
    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 4,
        origin: "[PDV] /caixa",
        message: "Falha específica",
      }),
    );

    const callArgs = vi.mocked(createLog).mock.calls[0][0];
    expect(callArgs.details).toContain('"saleId": 123');
  });

  it("não quebra a aplicação caso a chamada createLog lance uma exceção", async () => {
    vi.mocked(createLog).mockRejectedValueOnce(new Error("Rede indisponível"));

    const error = new Error("Erro qualquer");
    const result = await reportClientError(error);

    expect(result).toBe(false);
  });
});
