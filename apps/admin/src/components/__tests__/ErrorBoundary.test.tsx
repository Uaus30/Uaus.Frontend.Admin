// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { reportClientError } from "../../lib/clientLogger";

const mocks = vi.hoisted(() => ({
  reloadOnChunkLoadError: vi.fn(),
}));

vi.mock("../../lib/clientLogger", () => ({
  reportClientError: vi.fn(),
}));

// Só o reload é dublado; `isChunkLoadError` e o Button vêm do módulo real.
// `vi.spyOn` sobre o namespace não serve aqui: o chunk-reload chega ao
// componente por re-export do barrel do @workspace/ui, e o spy no namespace
// re-exportado não intercepta a chamada feita dentro do componente.
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  reloadOnChunkLoadError: mocks.reloadOnChunkLoadError,
}));

const ProblemChild = () => {
  throw new Error("Erro simulado no componente");
};

const ChunkProblemChild = () => {
  throw new TypeError(
    "Failed to fetch dynamically imported module: https://domain/assets/payment-methods.js",
  );
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renderiza os filhos normalmente quando não há erro", () => {
    render(
      <ErrorBoundary>
        <div>Conteúdo Normal</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Conteúdo Normal")).toBeDefined();
  });

  it("captura exceção de renderização, exibe interface de erro e aciona o clientLogger", () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Algo deu errado")).toBeDefined();
    expect(screen.getByText("Erro simulado no componente")).toBeDefined();
    expect(reportClientError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        type: 4,
        origin: "[Front-Admin] Crash de Renderização",
      }),
    );
  });

  it("suprime o envio de Crash Crítico caso seja erro de chunk e o auto-reload for disparado", () => {
    mocks.reloadOnChunkLoadError.mockReturnValueOnce(true);

    render(
      <ErrorBoundary>
        <ChunkProblemChild />
      </ErrorBoundary>,
    );

    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("aciona o clientLogger caso o erro de chunk persista e o reload tenha sido bloqueado pela trava", () => {
    mocks.reloadOnChunkLoadError.mockReturnValueOnce(false);

    render(
      <ErrorBoundary>
        <ChunkProblemChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Algo deu errado")).toBeDefined();
    expect(reportClientError).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({
        type: 4,
        origin: "[Front-Admin] Crash de Renderização",
      }),
    );
  });
});
