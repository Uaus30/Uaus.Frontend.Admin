import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SalesTable } from "../SalesTable";
import type { EnrichedSale } from "../../types";

function venda(): EnrichedSale {
  return {
    id: 12,
    createdAt: "2026-10-06T14:32:00",
    customerName: "MARIA DAS DORES",
    total: 185.5,
    discount: 0,
    payments: [{ id: 1, paymentMethodId: 3, paymentMethodName: "Pix", amount: 185.5 }],
    items: [],
  } as unknown as EnrichedSale;
}

function renderTable(overrides: Partial<React.ComponentProps<typeof SalesTable>> = {}) {
  const props: React.ComponentProps<typeof SalesTable> = {
    isLoading: false,
    saleDetails: [venda()],
    paymentMethodById: { 3: "Pix" },
    page: 1,
    setPage: vi.fn(),
    salesPage: undefined,
    onViewDetails: vi.fn(),
    onDelete: vi.fn(),
    onPrintReceipt: vi.fn(),
    deletingSaleId: null,
    printingSaleId: null,
    search: "",
    setSearch: vi.fn(),
    startDate: "",
    setStartDate: vi.fn(),
    endDate: "",
    setEndDate: vi.fn(),
    paymentMethodFilter: "all",
    setPaymentMethodFilter: vi.fn(),
    paymentStatusFilter: "all",
    setPaymentStatusFilter: vi.fn(),
    paymentMethods: [{ id: 3, name: "Pix" }],
    paymentStatuses: [],
    ...overrides,
  };
  render(<SalesTable {...props} />);
  return props;
}

function abrirMenuDaLinha() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Opções da venda 12" }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("SalesTable — no celular (06/10/2026)", () => {
  it("tocar na linha abre a venda — o olho ficava além da borda da tela", () => {
    const props = renderTable();

    fireEvent.click(screen.getByText("MARIA DAS DORES"));

    expect(props.onViewDetails).toHaveBeenCalledWith(12);
  });

  it("o menu ⋮ tem as três ações por extenso, e escolher uma não abre a venda junto", () => {
    const props = renderTable();

    abrirMenuDaLinha();
    fireEvent.click(screen.getByRole("menuitem", { name: /reimprimir cupom/i }));

    expect(props.onPrintReceipt).toHaveBeenCalledWith(12);
    expect(props.onViewDetails).not.toHaveBeenCalled();
  });

  it("remover pelo menu pede a confirmação, sem apagar direto", () => {
    const props = renderTable();

    abrirMenuDaLinha();
    fireEvent.click(screen.getByRole("menuitem", { name: /remover venda/i }));

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it("número, data e forma de pagamento vêm embaixo do cliente", () => {
    renderTable();

    const celula = screen.getByText("MARIA DAS DORES").closest("td")!;
    expect(within(celula).getByText(/#0012 ·/)).toBeTruthy();
    expect(within(celula).getByText("Pix")).toBeTruthy();
  });

  it("o botão Filtros conta período, forma e situação escolhidos", () => {
    renderTable({ startDate: "2026-10-01", paymentMethodFilter: "3" });

    expect(screen.getByRole("button", { name: "Filtros (2)" })).toBeTruthy();
  });

  it("selecionar o nome com o mouse para copiar não abre a venda", () => {
    const props = renderTable();
    const selecao = vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "MARIA",
    } as unknown as Selection);

    fireEvent.click(screen.getByText("MARIA DAS DORES"));

    expect(props.onViewDetails).not.toHaveBeenCalled();
    selecao.mockRestore();
  });
});
