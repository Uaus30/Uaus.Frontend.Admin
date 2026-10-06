import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaleDto } from "@workspace/api-client-react";
import { EditSaleHeaderModal } from "../EditSaleHeaderModal";

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetFinancialClosings: () => ({ data: { data: [] } }),
}));

/**
 * Venda de 03/10 paga em cheque — forma desativada depois. O dono abre a correção
 * em 06/10 só para trocar a observação.
 */
const venda = {
  id: 1990,
  createdAt: "2026-10-03T10:15:00",
  total: 120,
  discount: 0,
  customerId: null,
  notes: null,
  paymentStatus: 2,
  payments: [{ id: 1, saleId: 1990, paymentMethodId: 9, amount: 120, installments: 1, sequence: 1 }],
} as unknown as SaleDto;

const formas = [
  { id: 1, name: "Dinheiro", isActive: true },
  { id: 9, name: "Cheque", isActive: false },
];

function renderModal(sale: SaleDto = venda) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EditSaleHeaderModal sale={sale} onClose={vi.fn()} customers={[]} paymentMethods={formas} />
    </QueryClientProvider>,
  );
}

describe("EditSaleHeaderModal — corrigir a venda registrada (06/10/2026)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
  });

  afterEach(() => vi.useRealTimers());

  it("venda de outro dia, data intacta: nenhum aviso de estoque ou caixa", () => {
    // A correção não baixa estoque nem mexe em caixa; o aviso da venda nova aqui
    // faria o dono achar que salvar baixaria o estoque de novo.
    renderModal();

    expect(screen.queryByText(/fica fora do caixa/)).toBeNull();
    expect(screen.queryByText(/estoque baixa/)).toBeNull();
    expect(screen.queryByText(/passa para a data nova/)).toBeNull();
  });

  it("o corpo que rola é posicionado, para o select escondido do Radix não fazer o diálogo inteiro rolar", () => {
    // Sem ancestral posicionado, o <select> escondido (absolute) se ancorava no
    // diálogo, fora da área que rola, e o diálogo rolava 42px no celular.
    renderModal();

    const form = document.getElementById("edit-sale-form");
    expect(form?.className.split(" ")).toContain("relative");
    expect(form?.querySelector("select")).not.toBeNull();
  });

  it("venda do PDV: a data aparece travada, e a tela diz para cancelar e registrar de novo pelo Admin", () => {
    // Decisão do dono (06/10/2026): manter as travas e mostrar o caminho.
    renderModal({ ...venda, fromPdv: true } as SaleDto);

    expect(screen.getByText(/Venda do PDV: .*cancele a venda e registre de novo pelo Admin/)).toBeTruthy();
    expect((screen.getByLabelText("Hora da venda") as HTMLInputElement).disabled).toBe(true);
  });

  it("venda do painel: a data é editável e não há a mensagem do PDV", () => {
    renderModal();

    expect(screen.queryByText(/Venda do PDV/)).toBeNull();
    expect((screen.getByLabelText("Hora da venda") as HTMLInputElement).disabled).toBe(false);
  });

  it("a forma desativada que a venda usa continua no select, marcada", () => {
    // Fora da lista, o select abria em branco e o dono entenderia que a forma se perdeu.
    renderModal();

    expect(screen.getByRole("combobox", { name: "Forma de pagamento 1" }).textContent).toContain(
      "Cheque (desativada)",
    );
  });
});
