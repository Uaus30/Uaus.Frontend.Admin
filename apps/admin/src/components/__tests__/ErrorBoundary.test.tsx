// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { reportClientError } from "../../lib/clientLogger";

vi.mock("../../lib/clientLogger", () => ({
  reportClientError: vi.fn(),
}));

const ProblemChild = () => {
  throw new Error("Erro simulado no componente");
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
});
