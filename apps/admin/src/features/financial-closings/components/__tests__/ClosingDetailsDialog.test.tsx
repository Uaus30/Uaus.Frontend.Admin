import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FinancialClosingDto } from "@workspace/api-client-react";
import { closingFixture, legacyClosingFixture } from "../../__tests__/fixtures";
import { ClosingDetailsDialog } from "../ClosingDetailsDialog";

function renderDetails(closing: FinancialClosingDto) {
  render(
    <ClosingDetailsDialog
      open
      closing={closing}
      isLoading={false}
      isDeleting={false}
      onClose={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe("ClosingDetailsDialog", () => {
  afterEach(() => cleanup());

  it("o último fechamento pode ser excluído", () => {
    renderDetails(closingFixture);

    expect(screen.getByRole("button", { name: /Excluir fechamento/ })).toBeTruthy();
    expect(screen.queryByTestId("delete-locked")).toBeNull();
  });

  it("os outros não têm o botão, e dizem por quê", () => {
    renderDetails({ ...closingFixture, isLatest: false });

    expect(screen.queryByRole("button", { name: /Excluir fechamento/ })).toBeNull();
    expect(screen.getByTestId("delete-locked").textContent).toMatch(
      /Só o último fechamento pode ser excluído/,
    );
  });

  it("mostra os três blocos do documento, com o saldo confirmado e a explicação da diferença", () => {
    renderDetails(closingFixture);

    expect(screen.getByText("Resultado do mês")).toBeTruthy();
    expect(screen.getByText("Caixa do mês")).toBeTruthy();
    expect(screen.getByText("Rateio e retiradas")).toBeTruthy();
    expect(screen.getByText("Saldo confirmado")).toBeTruthy();
    expect(screen.getByText("Taxa da maquininha")).toBeTruthy();
  });

  it("fechamento da conta antiga: a nota e '—' nos campos novos", () => {
    renderDetails(legacyClosingFixture);

    expect(screen.getAllByText(/Fechado com a conta antiga/).length).toBeGreaterThan(0);
    expect(screen.getByText("Descontos (só o da venda)")).toBeTruthy();
    // Vendas brutas, sobras, aportes, compras pagas, retiradas, saldos... e o retirado por sócio.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(8);
  });
});
