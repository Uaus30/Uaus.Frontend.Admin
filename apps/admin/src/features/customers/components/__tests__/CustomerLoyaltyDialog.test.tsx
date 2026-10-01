import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoyaltyStatementDto } from "@workspace/api-client-react";
import { CustomerLoyaltyDialog } from "../CustomerLoyaltyDialog";

const statement = {
  customerId: 7,
  customerName: "Ana",
  card: { stamps: 2, stampsRequired: 10, middleStamp: 5, expiresAt: "2027-10-01T23:59:59" },
  stamps: [
    { position: 1, points: 1, occurredAt: "2026-10-01T10:00:00", kind: "Bonus" },
    {
      position: 4,
      points: 3,
      occurredAt: "2026-10-02T10:00:00",
      kind: "Adjustment",
      reason: "Cartão de papel",
    },
    {
      position: 3,
      points: -1,
      occurredAt: "2026-10-03T10:00:00",
      kind: "Adjustment",
      reason: "Venda estornada",
    },
  ],
  rewards: [
    {
      id: 1,
      stage: "Middle",
      discountType: "Amount",
      discountValue: 5,
      status: "Redeemed",
      redeemedAt: "2026-12-21T10:00:00",
      redeemUntil: "2027-10-31T23:59:59",
      expired: false,
    },
  ],
} as unknown as LoyaltyStatementDto;

const onAdjust = vi.fn();

function renderDialog() {
  return render(
    <CustomerLoyaltyDialog
      customerName="Ana"
      statement={statement}
      isLoading={false}
      onClose={vi.fn()}
      onPrint={vi.fn()}
      onAdjust={onAdjust}
      isAdjusting={false}
    />,
  );
}

const fill = (points: string, reason: string) => {
  fireEvent.change(screen.getByLabelText("Carimbos"), { target: { value: points } });
  fireEvent.change(screen.getByLabelText("Motivo do ajuste"), { target: { value: reason } });
  fireEvent.click(screen.getByRole("button", { name: "Gravar ajuste" }));
};

describe("CustomerLoyaltyDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAdjust.mockResolvedValue(undefined);
  });

  it("mostra cada carimbo com a data, o ajuste com o que deu ou tirou e o motivo, e o prêmio trocado", () => {
    renderDialog();

    expect(screen.getByText(/1º \(extra\) · 01\/10\/2026/)).not.toBeNull();
    expect(screen.getByText(/2º a 4º \(ajuste\) · 02\/10\/2026 — Cartão de papel/)).not.toBeNull();
    expect(
      screen.getByText(/Tirou 1 \(ajuste, fica com 3\) · 03\/10\/2026 — Venda estornada/),
    ).not.toBeNull();
    expect(screen.getByText(/Prêmio do 5º carimbo .*trocado em 21\/12\/2026/)).not.toBeNull();
  });

  it("grava o ajuste com o motivo e limpa o formulário", async () => {
    renderDialog();

    fill("-1", "  Venda estornada  ");

    await waitFor(() => expect(onAdjust).toHaveBeenCalledWith(-1, "Venda estornada"));
    await waitFor(() =>
      expect((screen.getByLabelText("Motivo do ajuste") as HTMLInputElement).value).toBe(""),
    );
  });

  it("sem motivo não envia", () => {
    renderDialog();

    fill("1", "   ");

    expect(onAdjust).not.toHaveBeenCalled();
    expect(screen.getByText(/Informe o motivo/)).not.toBeNull();
  });

  it("zero, mais de 10 ou só o sinal não enviam", () => {
    renderDialog();

    for (const points of ["0", "11", "-", ""]) {
      fill(points, "Motivo");
      expect(onAdjust).not.toHaveBeenCalled();
    }
    expect(screen.getByText(/de 1 a 10 carimbos/)).not.toBeNull();
  });

  it("fechar limpa o ajuste digitado: o próximo cliente não herda", () => {
    const onClose = vi.fn();
    const props = {
      statement,
      isLoading: false,
      onClose,
      onPrint: vi.fn(),
      onAdjust,
      isAdjusting: false,
    };
    const { rerender } = render(<CustomerLoyaltyDialog customerName="Ana" {...props} />);
    fireEvent.change(screen.getByLabelText("Motivo do ajuste"), { target: { value: "Cartão de papel" } });

    fireEvent.keyDown(screen.getByLabelText("Motivo do ajuste"), { key: "Escape" });
    rerender(<CustomerLoyaltyDialog customerName={null} {...props} />);
    rerender(<CustomerLoyaltyDialog customerName="Bia" {...props} />);

    expect(onClose).toHaveBeenCalled();
    expect((screen.getByLabelText("Motivo do ajuste") as HTMLInputElement).value).toBe("");
  });

  it("recusa do servidor mantém o que foi digitado", async () => {
    onAdjust.mockRejectedValue(new Error("recusado"));
    renderDialog();

    fill("2", "Cartão de papel");

    await waitFor(() => expect(onAdjust).toHaveBeenCalled());
    expect((screen.getByLabelText("Motivo do ajuste") as HTMLInputElement).value).toBe("Cartão de papel");
  });
});
