import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerLoyaltyDto } from "@workspace/api-client-react";
import { TooltipProvider } from "@workspace/ui";

const mocks = vi.hoisted(() => ({ getCustomerLoyalty: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getCustomerLoyalty: mocks.getCustomerLoyalty,
}));

const { PdvLoyaltyCard } = await import("../pdv-loyalty-card");
const { PdvCartCustomerCompact } = await import("../pdv-cart-customer-compact");
const { usePdvStore } = await import("@/stores/use-pdv-store");
const { useOfflineStore } = await import("@/stores/use-offline-store");
const { useLoyaltyStore, loyaltyStampBase, rewardToCoupon } = await import("../../hooks/use-loyalty");

const STATUS: CustomerLoyaltyDto = {
  customerId: 7,
  programActive: true,
  minimumPurchaseForStamp: 10,
  card: {
    id: 1,
    stamps: 7,
    stampsRequired: 10,
    middleStamp: 5,
    openedAt: "2026-11-03T10:00:00",
    expiresAt: "2027-11-03T23:59:59",
    status: "Open",
    nextRewardAt: 10,
    nextRewardType: "Amount",
    nextRewardValue: 5,
  },
  availableRewards: [
    {
      id: 9,
      stage: "Middle",
      couponId: 10,
      couponCode: "FIDELIDADE5",
      discountType: "Amount",
      discountValue: 5,
      minimumPurchase: 10,
      unlockedAt: "2026-11-07T10:00:00",
      redeemUntil: "2027-12-03T23:59:59",
      status: "Available",
      expired: false,
    },
  ],
};

/** Item de R$ 11,00. */
const ITEM = {
  id: "linha-1",
  productId: 1,
  name: "Pote",
  price: 11,
  quantity: 1,
  discount: 0,
  availableStock: 9,
};

const CODE_COUPON = {
  couponId: 3,
  code: "10OFF",
  description: null,
  discountType: 1 as const,
  discountValue: 10,
  answers: [],
};

function renderCard(compact = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>{compact ? <PdvCartCustomerCompact /> : <PdvLoyaltyCard />}</TooltipProvider>
    </QueryClientProvider>,
  );
}

describe.each([false, true])("o programa no carrinho (compacto: %s)", (compact) => {
  beforeEach(() => {
    mocks.getCustomerLoyalty.mockResolvedValue(STATUS);
    useOfflineStore.setState({ online: true });
    useLoyaltyStore.getState().resetSaved();
    usePdvStore.setState({
      items: [ITEM],
      globalDiscount: 0,
      coupon: null,
      consumer: { customerId: 7, name: "Ana Paula", document: "" },
    });
  });

  it("o cupom do panfleto conta como desconto da compra, como no servidor", async () => {
    // R$ 11 com 10% de panfleto = R$ 9,90: abaixo do mínimo de R$ 10.
    usePdvStore.setState({ coupon: CODE_COUPON });
    renderCard(compact);

    expect(await screen.findByText(/faltam/i)).toBeTruthy();
    expect(screen.queryByText(/ganhar 1 carimbo/)).toBeNull();
    expect(loyaltyStampBase(11, 0, 1.1, CODE_COUPON)).toBe(9.9);
  });

  it("o prêmio do cartão não tira o carimbo da compra", () => {
    expect(loyaltyStampBase(11, 0, 5, rewardToCoupon(STATUS.availableRewards[0]))).toBe(11);
  });

  it("o prêmio tirado pelo X do cupom pode voltar para a venda", async () => {
    renderCard(compact);
    const button = await screen.findByRole("button", { name: /Usar o prêmio de/ });

    fireEvent.click(button);

    expect(usePdvStore.getState().coupon).toMatchObject({ loyaltyRewardId: 9 });
  });

  it("guardar para a próxima tira o prêmio e o deixa à mão", async () => {
    act(() => usePdvStore.setState({ coupon: rewardToCoupon(STATUS.availableRewards[0]) }));
    renderCard(compact);

    fireEvent.click(await screen.findByRole("button", { name: "Guardar para a próxima" }));

    expect(useLoyaltyStore.getState().savedRewardIds).toEqual([9]);
  });
});

describe("card do programa no carrinho estendido", () => {
  beforeEach(() => {
    mocks.getCustomerLoyalty.mockResolvedValue(STATUS);
    useOfflineStore.setState({ online: true });
    usePdvStore.setState({
      items: [ITEM],
      globalDiscount: 0,
      coupon: null,
      consumer: { customerId: 7, name: "Ana", document: "" },
    });
  });

  it("some com o programa desligado", async () => {
    mocks.getCustomerLoyalty.mockResolvedValue({ ...STATUS, programActive: false });
    const { container } = renderCard();

    await vi.waitFor(() => expect(mocks.getCustomerLoyalty).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});

describe("cliente e cartão no carrinho compacto", () => {
  beforeEach(() => {
    mocks.getCustomerLoyalty.mockResolvedValue(STATUS);
    useOfflineStore.setState({ online: true });
    useLoyaltyStore.getState().resetSaved();
    usePdvStore.setState({
      items: [ITEM],
      globalDiscount: 0,
      coupon: rewardToCoupon(STATUS.availableRewards[0]),
      consumer: { customerId: 7, name: "Wagner Barbosa", phone: "44999990001", document: "" },
    });
  });

  it('diz numa linha quem é o cliente e o que a compra rende: "Wagner vai ganhar 1 carimbo"', async () => {
    const { container } = renderCard(true);

    await screen.findByRole("button", { name: "Guardar para a próxima" });
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("flex-wrap");
    expect(row.textContent).toContain("Wagner vai ganhar 1 carimbo");
    expect(row.textContent).toMatch(/Prêmio R\$\s5,00/);
    expect(container.querySelectorAll(".rounded-lg")).toHaveLength(0);
  });

  it("abaixo do mínimo, diz quanto falta com o nome e não escreve o aviso que quebraria a linha", async () => {
    // R$ 6,00: abaixo dos R$ 10 do carimbo e do prêmio — ele fica suspenso.
    usePdvStore.setState({ items: [{ ...ITEM, price: 6 }] });
    const { container } = renderCard(true);

    await screen.findByRole("button", { name: "Guardar para a próxima" });
    const row = container.firstElementChild as HTMLElement;
    expect(row.textContent).toMatch(/Wagner: faltam R\$\s4,00 para o carimbo/);
    expect(row.textContent).not.toMatch(/abaixo do mínimo/);
    expect(row.querySelector(".opacity-60")).not.toBeNull();
  });

  it("sem itens, mostra o nome e o cartão; o X tira o cliente", async () => {
    usePdvStore.setState({ items: [], coupon: null });
    const { container } = renderCard(true);

    expect(await screen.findByText(/7\/10/)).toBeTruthy();
    expect(container.textContent).toContain("Wagner");
    fireEvent.click(screen.getByRole("button", { name: "Tirar o cliente da venda" }));
    expect(usePdvStore.getState().consumer.customerId).toBeNull();
  });

  it("com o programa desligado, ainda diz de quem é a venda", async () => {
    mocks.getCustomerLoyalty.mockResolvedValue({ ...STATUS, programActive: false });
    usePdvStore.setState({ coupon: null });
    const { container } = renderCard(true);

    await vi.waitFor(() => expect(mocks.getCustomerLoyalty).toHaveBeenCalled());
    expect(container.textContent).toContain("Wagner");
    expect(container.textContent).not.toMatch(/carimbo/);
  });

  it("sem cliente, não ocupa linha nenhuma: o botão Cliente mora na engrenagem", () => {
    usePdvStore.setState({ consumer: { customerId: null, name: "", document: "" } });
    const { container } = renderCard(true);

    expect(container.textContent).toBe("");
  });
});
