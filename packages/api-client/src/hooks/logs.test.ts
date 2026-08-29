import { afterEach, describe, expect, it, vi } from "vitest";
import { createLog, markLogAsVerified, type SystemLogDto } from "./logs";

const verifiedLog: SystemLogDto = {
  id: 188,
  createdAt: "2026-08-21T16:00:00-03:00",
  updatedAt: "2026-08-21T17:00:00-03:00",
  code: "LOG-188",
  requestId: null,
  type: "Critical",
  requiresVerification: false,
  origin: "Api",
  message: "Falha crítica",
  details: null,
};

describe("logs API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("marca o log como verificado pelo endpoint PUT específico", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(verifiedLog), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await markLogAsVerified(188);

    expect(result).toEqual(verifiedLog);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.uaus.com.br/Logs/188/verification",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("cria um registro de log via POST /Logs", async () => {
    const createdLog: SystemLogDto = {
      ...verifiedLog,
      id: 200,
      type: "Error",
      origin: "[Front-Admin] /produtos",
      message: "Erro ao renderizar tabela",
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdLog), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createLog({
      type: 3,
      origin: "[Front-Admin] /produtos",
      message: "Erro ao renderizar tabela",
      details: '{"stack": "..."}',
    });

    expect(result).toEqual(createdLog);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.uaus.com.br/Logs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: 3,
          origin: "[Front-Admin] /produtos",
          message: "Erro ao renderizar tabela",
          details: '{"stack": "..."}',
        }),
      }),
    );
  });
});
