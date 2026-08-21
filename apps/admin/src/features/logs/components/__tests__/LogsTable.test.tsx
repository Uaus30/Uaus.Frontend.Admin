import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SystemLogDto } from "../../types";
import { LogsTable } from "../LogsTable";

function createLog(type: SystemLogDto["type"]): SystemLogDto {
  return {
    id: 42,
    createdAt: "2026-08-21T16:00:00-03:00",
    updatedAt: null,
    code: "LOG-042",
    requestId: null,
    type,
    origin: "Admin",
    message: "Teste de regressão",
    details: null,
  };
}

describe("LogsTable", () => {
  it.each([
    [1, "INFORMAÇÃO"],
    [2, "ALERTA"],
    [3, "ERRO"],
    [4, "CRÍTICO"],
  ] as const)("renderiza o tipo numérico %i sem derrubar a tela", (type, expectedLabel) => {
    render(<LogsTable logsList={[createLog(type)]} isLoading={false} onRowClick={vi.fn()} />);

    expect(screen.getByText(expectedLabel)).toBeTruthy();
  });

  it("usa um badge genérico para um valor numérico desconhecido", () => {
    render(<LogsTable logsList={[createLog(99)]} isLoading={false} onRowClick={vi.fn()} />);

    expect(screen.getByText("LOG")).toBeTruthy();
  });

  it("mantém a navegação para o detalhe quando o tipo vem como número", () => {
    const onRowClick = vi.fn();
    render(<LogsTable logsList={[createLog(4)]} isLoading={false} onRowClick={onRowClick} />);

    fireEvent.click(screen.getByText("Teste de regressão"));

    expect(onRowClick).toHaveBeenCalledWith(42);
  });
});
