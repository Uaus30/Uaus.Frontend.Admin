import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoyaltySaleOutcomeDto } from "@workspace/api-client-react";
import type { ReceiptData } from "@workspace/receipt";

const mocks = vi.hoisted(() => ({ printReceipt: vi.fn() }));

vi.mock("@workspace/receipt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/receipt")>()),
  printReceipt: mocks.printReceipt,
}));

const { LoyaltyResultDialog } = await import("../loyalty-result-dialog");
const { useLoyaltyStore } = await import("../../hooks/use-loyalty");

const card = {
  id: 1,
  stamps: 1,
  stampsRequired: 10,
  middleStamp: 5,
  openedAt: "2026-10-01T10:00:00",
  expiresAt: "2027-10-01T23:59:59",
  status: "Open",
  nextRewardAt: 5,
  nextRewardType: "Amount",
  nextRewardValue: 5,
};

const receipt = { saleId: 42, total: 12 } as unknown as ReceiptData;

function open(outcome: LoyaltySaleOutcomeDto) {
  useLoyaltyStore
    .getState()
    .setLastResult({ outcome, customerId: 3, customerName: "Wagner Barbosa", receipt });
  return render(<LoyaltyResultDialog />);
}

describe("cartão digital depois da venda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.printReceipt.mockResolvedValue(undefined);
  });

  it("título centralizado e o nome do cliente embaixo", () => {
    open({
      stamped: true,
      stampNumber: 1,
      cardCompleted: false,
      card,
      unlockedRewards: [],
      minimumPurchaseForStamp: 10,
    });

    expect(screen.getByRole("heading", { name: /Programa de Fidelidade/ })).toBeTruthy();
    expect(screen.getByText("Wagner Barbosa")).toBeTruthy();
  });

  it("a casa ganha agora é a estrela; as já carimbadas, o certo", () => {
    open({
      stamped: true,
      stampNumber: 3,
      cardCompleted: false,
      card: { ...card, stamps: 3 },
      unlockedRewards: [],
      minimumPurchaseForStamp: 10,
    });

    expect(screen.getByLabelText("3º carimbo: ganho agora")).toBeTruthy();
    expect(screen.getByLabelText("2º carimbo: carimbado")).toBeTruthy();
    expect(screen.getByLabelText("5º carimbo: prêmio")).toBeTruthy();
  });

  it("ao completar o cartão, mostra os dois carimbos ganhos de uma vez", () => {
    open({
      stamped: true,
      stampNumber: 10,
      cardCompleted: true,
      card,
      unlockedRewards: [],
      minimumPurchaseForStamp: 10,
    });

    expect(screen.getByText("Cartão completo")).toBeTruthy();
    expect(screen.getByText("Cartão novo")).toBeTruthy();
    expect(screen.getAllByLabelText(/ganho agora/)).toHaveLength(2);
    expect(
      screen.getByText(/ganhou 2 carimbos: o 10º, que completou o cartão, e o 1º do cartão novo/),
    ).toBeTruthy();
  });

  it('cartão completo sem extra configurado: um carimbo só, sem "0 no cartão novo"', () => {
    open({
      stamped: true,
      stampNumber: 10,
      cardCompleted: true,
      card: { ...card, stamps: 0 },
      unlockedRewards: [],
      minimumPurchaseForStamp: 10,
    });

    expect(screen.getByText(/Esta compra ganhou 1 carimbo: o 10º, que completou o cartão\./)).toBeTruthy();
    expect(screen.queryByText(/0 no cartão novo/)).toBeNull();
  });

  it("o comprovante sai daqui, com ou sem o saldo do cartão", () => {
    open({
      stamped: true,
      stampNumber: 1,
      cardCompleted: false,
      card,
      unlockedRewards: [],
      minimumPurchaseForStamp: 10,
    });

    fireEvent.click(screen.getByRole("button", { name: /^Comprovante$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Com saldo do cartão/ }));

    expect(mocks.printReceipt).toHaveBeenCalledTimes(2);
    expect(mocks.printReceipt.mock.calls[0][0]).not.toHaveProperty("loyalty");
    expect(mocks.printReceipt.mock.calls[1][0]).toMatchObject({ saleId: 42, loyalty: { stamps: 1 } });
  });
});
