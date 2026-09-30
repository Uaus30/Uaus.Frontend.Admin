import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSaleDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetProductSales: vi.fn(),
  /** O que a modal recebeu: é por ela que o olho se prova. */
  modalProps: { atual: null as null | { open: boolean; saleId?: number | null } },
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetProductSales: mocks.useGetProductSales,
}));

// A modal tem teste próprio; aqui importa só QUAL venda ela recebeu.
vi.mock("@/features/sales/components/SaleDetailsModal", () => ({
  SaleDetailsModal: (props: { open: boolean; saleId?: number | null }) => {
    mocks.modalProps.atual = props;
    return props.open ? <div data-testid="modal-venda">venda {props.saleId}</div> : null;
  },
}));

const { ProductSalesTab } = await import("../ProductSalesTab");

const vendaPaga: ProductSaleDto = {
  saleId: 1945,
  saleItemId: 501,
  createdAt: "2026-09-02T08:52:54",
  quantity: 2,
  unitPrice: 20,
  discount: 2,
  subtotal: 40,
  saleTotal: 185.5,
  paymentStatus: "Paid",
};

const vendaCancelada: ProductSaleDto = {
  saleId: 1950,
  saleItemId: 530,
  createdAt: "2026-09-03T10:00:00",
  quantity: 1,
  unitPrice: 22,
  discount: 0,
  subtotal: 22,
  saleTotal: 22,
  paymentStatus: "Cancelled",
};

function respondeCom(vendas: ProductSaleDto[], total = vendas.length) {
  mocks.useGetProductSales.mockReturnValue({
    data: { data: vendas, page: 1, limit: 10, total, totalPages: 1 },
    isLoading: false,
    isError: false,
  });
}

function renderTab(productId: number | null = 39) {
  return render(<ProductSalesTab productId={productId} variationOptions={[]} onSelectProduct={vi.fn()} />);
}

describe("ProductSalesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.modalProps.atual = null;
  });

  it("lista data e hora, quantidade e o preço praticado, com o de tabela riscado quando houve desconto", () => {
    respondeCom([vendaPaga]);
    renderTab();

    expect(screen.getByText(/02\/09\/2026/)).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText(/^R\$\s20,00$/)).toBeDefined();
    // 20,00 + 2,00 de desconto: o preço de tabela, riscado.
    expect(screen.getByText(/^R\$\s22,00$/).className).toContain("line-through");
  });

  it("mostra o total da venda inteira, em destaque, ao lado do preço do item", () => {
    // Um esmalte de R$ 20 numa venda de R$ 185,50: é isso que diz se o produto
    // puxa venda grande.
    respondeCom([vendaPaga]);
    renderTab();

    const total = screen.getByText(/^R\$\s185,50$/);
    expect(total.closest("td")?.className).toContain("text-primary");
    expect(total.closest("td")?.className).toContain("font-bold");
  });

  it("marca a venda cancelada em vez de escondê-la", () => {
    // O estoque dela voltou — não é saída —, mas sumir da lista faria alguém
    // procurar a venda que "sumiu".
    respondeCom([vendaPaga, vendaCancelada]);
    renderTab();

    expect(screen.getAllByRole("row")).toHaveLength(3); // cabeçalho + 2
    expect(screen.getByText("Cancelada")).toBeDefined();
  });

  it("o olho abre a modal com a venda daquela linha", () => {
    respondeCom([vendaPaga, vendaCancelada]);
    renderTab();

    expect(screen.queryByTestId("modal-venda")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes da venda 1950" }));

    expect(screen.getByTestId("modal-venda").textContent).toBe("venda 1950");
  });

  it("sem venda, diz isso em vez de desenhar uma tabela vazia", () => {
    respondeCom([]);
    renderTab();

    expect(screen.getByText("Nenhuma venda deste produto.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("no cadastro ainda não salvo, não consulta nada", () => {
    renderTab(null);

    expect(screen.getByText("Salve o produto para ver as vendas dele")).toBeDefined();
    // O hook é chamado (regra dos hooks), mas com produto nulo — que o desliga.
    expect(mocks.useGetProductSales).toHaveBeenCalledWith(null, expect.anything());
  });

  it("só mostra a paginação quando há mais de uma página", () => {
    respondeCom([vendaPaga], 10);
    const { unmount } = renderTab();
    expect(screen.queryByText(/Itens por página|Página/)).toBeNull();
    unmount();

    respondeCom([vendaPaga], 11);
    renderTab();
    expect(screen.getByText(/11 vendas/)).toBeDefined();
  });
});
