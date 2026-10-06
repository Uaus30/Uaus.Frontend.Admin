import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CancelSaleDialog } from "../CancelSaleDialog";

const venda = { id: 2117, createdAt: "2026-09-28T19:01:00", total: 1 };

function renderDialog() {
  const onConfirm = vi.fn();
  render(<CancelSaleDialog sale={venda} cancelling={false} onClose={vi.fn()} onConfirm={onConfirm} />);
  return { onConfirm };
}

function botaoCancelar() {
  return screen.getByRole("button", { name: "Cancelar venda" }) as HTMLButtonElement;
}

describe("CancelSaleDialog — cancelar com motivo (06/10/2026)", () => {
  it("sem motivo, ou com um motivo que não explica nada, não cancela", () => {
    const { onConfirm } = renderDialog();

    expect(botaoCancelar().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), { target: { value: "  x  " } });
    expect(botaoCancelar().disabled).toBe(true);

    fireEvent.click(botaoCancelar());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("com o motivo, cancela mandando o motivo sem os espaços das pontas", () => {
    const { onConfirm } = renderDialog();

    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), {
      target: { value: "  lançada em duplicidade  " },
    });
    fireEvent.click(botaoCancelar());

    expect(onConfirm).toHaveBeenCalledWith("lançada em duplicidade");
  });

  it("venda de mês fechado: o diálogo avisa que o fechamento fica desatualizado", () => {
    render(
      <CancelSaleDialog
        sale={venda}
        cancelling={false}
        closedPeriodNotice="Esta venda é do período do fechamento financeiro de 01/09/2026 a 30/09/2026: desatualizado"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/fechamento financeiro de 01\/09\/2026 a 30\/09\/2026/)).toBeTruthy();
  });

  it("diz que a venda continua no histórico, marcada — cancelar não é apagar", () => {
    renderDialog();

    expect(screen.getByText(/continua no histórico, marcada como cancelada/)).toBeTruthy();
  });
});
