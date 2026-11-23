import { useEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PURCHASE_STATUS,
  type CategoryDto,
  type DepartmentDto,
  type PurchaseBudgetDto,
  type SupplierDto,
} from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetPurchaseBudget: vi.fn(),
  createPurchase: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPurchaseBudget: mocks.useGetPurchaseBudget,
  createPurchase: mocks.createPurchase,
}));

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(),
  downloadWebImageAsFile: vi.fn(),
  buildImageProxyUrl: vi.fn((url: string) => url),
}));

const { usePurchaseForm } = await import("../../hooks/usePurchaseForm");
const { PurchaseEditorModal } = await import("../PurchaseEditorModal");

const SUPPLIERS = [{ id: 1, name: "Atacado", isMarketplace: false }] as unknown as SupplierDto[];
const CATEGORIES = [
  {
    id: 7,
    departmentId: 4,
    name: "Canecas",
    createdAt: "",
    updatedAt: null,
    description: null,
    productCount: 0,
  },
] as CategoryDto[];
// O departamento da categoria precisa estar na lista: sem ele, o select de
// departamento não acha o valor e a troca apaga a categoria escolhida.
const DEPARTMENTS = [{ id: 4, name: "Utilidades" }] as unknown as DepartmentDto[];

/**
 * A faixa do mês que o servidor devolveria: novembro/2026 no dia 23 (seção 1.1
 * do plano) — K = 2.782, linha verde 3.220, vermelha 4.493. O mês da resposta é
 * o pedido: a compra nasce com a data de hoje, seja qual for.
 */
function budgetFor(month: string): PurchaseBudgetDto {
  return {
    month,
    periodStart: `${month}-01T00:00:00`,
    periodEnd: `${month}-28T00:00:00`,
    isCurrentMonth: true,
    isClosedMonth: false,
    isProvisional: false,
    openingBalance: 0,
    contributions: 0,
    availableBalance: 0,
    revenue: 5358,
    costOfSales: 3220,
    purchasesPaid: 2782,
    purchasesPlanned: 0,
    plannedWithoutValueCount: 0,
    fixedCosts: 865,
    greenLimit: 3220,
    redLimit: 4493,
    greenRoom: 438,
    redRoom: 1711,
    band: "Green",
    bandIfPlannedBought: "Green",
    reliesOnBalance: false,
    stockValueAtCost: 34400,
    stockDays: 195,
  };
}

/** O formulário do último render, para o teste mexer nele como a tela mexe. */
const handle: { form: ReturnType<typeof usePurchaseForm> | null } = { form: null };

/** O formulário vivo — falha alto se a modal ainda não montou. */
function formApi(): ReturnType<typeof usePurchaseForm> {
  if (!handle.form) throw new Error("A modal ainda não montou.");
  return handle.form;
}

/** O hook de verdade por trás da modal, aberto numa compra nova durante o render. */
function Harness() {
  const form = usePurchaseForm({ onSaved: vi.fn(), suppliers: SUPPLIERS, categories: CATEGORIES });
  // Num efeito, e não no render: atribuir fora do componente durante o render é
  // efeito colateral (o lint recusa), e o `act` do teste já espera os efeitos.
  useEffect(() => {
    handle.form = form;
  });
  const [opened, setOpened] = useState(false);
  if (!opened) {
    setOpened(true);
    form.openNew();
  }
  return <PurchaseEditorModal form={form} suppliers={SUPPLIERS} departments={DEPARTMENTS} />;
}

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

/** Preenche o essencial para gravar: fornecedor, nome, categoria e quantidade. */
function fillRequired(quantity: number) {
  act(() => {
    formApi().update("supplierId", "1");
    formApi().update("productName", "CANECA");
    formApi().update("categoryId", "7");
    formApi().update("quantity", quantity);
  });
}

function setStatusAndTotal(status: number, total: number) {
  act(() => formApi().update("status", String(status)));
  act(() => formApi().setGrossTotal(total));
}

function bandLine() {
  return screen.queryByTestId("purchase-band-line");
}

describe("PurchaseEditorModal — faixa de compras (23/11/2026)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.useGetPurchaseBudget.mockImplementation(
      (params: { month: string }, options?: { query?: { enabled?: boolean } }) => ({
        data: options?.query?.enabled ? budgetFor(params.month) : undefined,
      }),
    );
    mocks.createPurchase.mockResolvedValue({ id: 1 });
  });

  afterEach(() => cleanup());

  it("Pendente não mexe na faixa: sem linha e sem consulta", () => {
    renderModal();
    fillRequired(100);
    setStatusAndTotal(PURCHASE_STATUS.Pending, 2000);

    expect(bandLine()).toBeNull();
    expect(mocks.useGetPurchaseBudget).toHaveBeenLastCalledWith(expect.anything(), {
      query: { enabled: false },
    });
  });

  it("a linha muda com a situação e com o total", () => {
    renderModal();
    fillRequired(100);

    setStatusAndTotal(PURCHASE_STATUS.InTransit, 100);
    expect(bandLine()?.dataset.band).toBe("green");
    expect(bandLine()?.textContent).toMatch(/Esta compra mantém \S+ no verde/);

    act(() => formApi().setGrossTotal(900));
    expect(bandLine()?.dataset.band).toBe("yellow");
    expect(bandLine()?.textContent).toMatch(/Esta compra leva \S+ para o amarelo/);

    act(() => formApi().setGrossTotal(2000));
    expect(bandLine()?.dataset.band).toBe("red");

    // Voltar para Pendente tira a compra da conta — e a linha some.
    act(() => formApi().update("status", String(PURCHASE_STATUS.Pending)));
    expect(bandLine()).toBeNull();
  });

  it("no amarelo grava direto, sem perguntar", async () => {
    renderModal();
    fillRequired(100);
    setStatusAndTotal(PURCHASE_STATUS.InTransit, 900);

    await act(async () => formApi().submit());

    expect(screen.queryByText("Comprar no vermelho?")).toBeNull();
    await waitFor(() => expect(mocks.createPurchase).toHaveBeenCalledTimes(1));
  });

  it("no vermelho pergunta antes e só grava com o 'Comprar mesmo assim'", async () => {
    renderModal();
    fillRequired(100);
    setStatusAndTotal(PURCHASE_STATUS.InTransit, 2000);

    await act(async () => formApi().submit());

    expect(screen.getByText("Comprar no vermelho?")).toBeTruthy();
    expect(screen.getByText(/não cobre os custos fixos\. Comprar mesmo assim\?/)).toBeTruthy();
    expect(mocks.createPurchase).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Comprar mesmo assim" }));

    await waitFor(() => expect(mocks.createPurchase).toHaveBeenCalledTimes(1));
  });

  it("'Revisar a compra' fecha a pergunta sem gravar", async () => {
    renderModal();
    fillRequired(100);
    setStatusAndTotal(PURCHASE_STATUS.InTransit, 2000);

    await act(async () => formApi().submit());
    fireEvent.click(screen.getByRole("button", { name: "Revisar a compra" }));

    await waitFor(() => expect(formApi().redBandOpen).toBe(false));
    expect(mocks.createPurchase).not.toHaveBeenCalled();
  });

  it("margem negativa e vermelho: as duas perguntas em fila, e a gravação sai uma vez só", async () => {
    renderModal();
    // Dez unidades por R$ 2.000: custo de R$ 200, acima do teto de R$ 30.
    fillRequired(10);
    setStatusAndTotal(PURCHASE_STATUS.InTransit, 2000);

    await act(async () => formApi().submit());
    expect(screen.getByText("Preço abaixo do custo")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Gravar com margem negativa" }));
    await waitFor(() => expect(formApi().redBandOpen).toBe(true));
    expect(mocks.createPurchase).not.toHaveBeenCalled();

    // O clique que cai no diálogo da margem durante a animação de saída não grava:
    // a pergunta dele já foi respondida.
    act(() => formApi().confirmBelowCost());
    expect(mocks.createPurchase).not.toHaveBeenCalled();

    act(() => formApi().confirmRedBand());
    await waitFor(() => expect(mocks.createPurchase).toHaveBeenCalledTimes(1));

    // E o mesmo vale para o da faixa: confirmado, um segundo clique não grava de novo.
    act(() => formApi().confirmRedBand());
    expect(mocks.createPurchase).toHaveBeenCalledTimes(1);
  });
});
