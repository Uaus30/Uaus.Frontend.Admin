import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkBalance } from "../../closing-balance";
import { previewFixture } from "../../__tests__/fixtures";
import { BalanceStep } from "../BalanceStep";

type Props = Parameters<typeof BalanceStep>[0];

function renderStep(overrides: Partial<Props> = {}) {
  const props: Props = {
    preview: previewFixture,
    isImplantation: false,
    withdrawalDrafts: { 1: "", 2: "" },
    onWithdrawalChange: vi.fn(),
    openingBalanceText: "",
    onOpeningBalanceChange: vi.fn(),
    onCommit: vi.fn(),
    closingBalanceText: "3727",
    onClosingBalanceChange: vi.fn(),
    balanceNotes: "",
    onBalanceNotesChange: vi.fn(),
    notes: "",
    onNotesChange: vi.fn(),
    balance: checkBalance(3727, "3727", ""),
    inputsDirty: false,
    isRecalculating: false,
    ...overrides,
  };
  render(<BalanceStep {...props} />);
  return props;
}

const text = (element: HTMLElement) => (element.textContent ?? "").replace(/\u00a0/g, " ");

describe("BalanceStep — passo 3 do fechamento", () => {
  afterEach(() => cleanup());

  it("mostra a retirada de cada sócio ao lado do que o rateio dá, e leva à conta ao sair do campo", () => {
    const props = renderStep();

    expect(screen.getAllByText(/a distribuir R\$/).map(text)).toEqual([
      "a distribuir R$ 2.049,50 · retirado R$ 0,00",
      "a distribuir R$ 2.049,50 · retirado R$ 0,00",
    ]);

    const anaInput = screen.getByLabelText(/Ana/);
    fireEvent.change(anaInput, { target: { value: "2000" } });
    fireEvent.blur(anaInput);
    expect(props.onWithdrawalChange).toHaveBeenCalledWith(1, "2000");
    expect(props.onCommit).toHaveBeenCalled();
  });

  it("fora da implantação não há campo de saldo inicial", () => {
    renderStep();

    expect(screen.queryByLabelText("Saldo no início do mês (opcional)")).toBeNull();
  });

  it("na implantação mostra o saldo inicial opcional", () => {
    const props = renderStep({ isImplantation: true });

    const field = screen.getByLabelText("Saldo no início do mês (opcional)");
    fireEvent.change(field, { target: { value: "1727" } });
    expect(props.onOpeningBalanceChange).toHaveBeenCalledWith("1727");
  });

  it("sem diferença, não pede observação", () => {
    renderStep();

    expect(screen.queryByLabelText("Explique a diferença *")).toBeNull();
  });

  it("com diferença acima de R$ 1,00, mostra a diferença e exige a observação", () => {
    renderStep({ closingBalanceText: "3700", balance: checkBalance(3727, "3700", "") });

    expect(text(screen.getByTestId("balance-difference"))).toContain("-R$ 27,00");
    expect(screen.getByLabelText("Explique a diferença *")).toBeTruthy();
  });

  it("avisa, sem travar, retirada acima do rateio e retiradas acima do caixa do mês", () => {
    renderStep({
      preview: {
        ...previewFixture,
        withdrawalsTotal: 4500,
        monthCash: 3727,
        shares: [
          { ...previewFixture.shares[0], withdrawnAmount: 4000 },
          { ...previewFixture.shares[1], withdrawnAmount: 500 },
        ],
      },
    });

    expect(screen.getByText("Retirada acima do que o rateio dá a Ana.")).toBeTruthy();
    expect(screen.queryByText("Retirada acima do que o rateio dá a Bruno.")).toBeNull();
    expect(screen.getByText(/passam do caixa do mês/)).toBeTruthy();
  });
});
