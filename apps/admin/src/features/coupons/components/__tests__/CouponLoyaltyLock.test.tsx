import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { COUPON_DISCOUNT_TYPE, type CouponDto } from "@workspace/api-client-react";
import { CouponEditorModal } from "../CouponEditorModal";
import { CouponsTable } from "../CouponsTable";
import type { CouponForm } from "../../types";

const coupon: CouponDto = {
  id: 10,
  createdAt: "2026-10-01T09:00:00",
  updatedAt: null,
  code: "FIDELIDADE5",
  description: null,
  discountType: "Amount",
  discountValue: 5,
  validFrom: "2026-10-01T00:00:00",
  validUntil: null,
  usageLimit: 0,
  redeemedCount: 3,
  remainingUses: null,
  isActive: true,
};

const form: CouponForm = {
  code: "FIDELIDADE5",
  description: "",
  discountType: COUPON_DISCOUNT_TYPE.Amount,
  discountValue: "5,00",
  minimumPurchaseAmount: "",
  validFromDate: new Date(2026, 9, 1),
  validFromTime: "00:00",
  validUntilDate: undefined,
  validUntilTime: "23:59",
  usageLimit: "",
  isActive: true,
  campaignId: "",
};

const renderModal = (editing: CouponDto, values: CouponForm = form) =>
  render(
    <CouponEditorModal
      open
      editing={editing}
      form={values}
      onFormChange={vi.fn()}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      isSaving={false}
      campaigns={[]}
    />,
  );

const input = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe("cupom com prêmio de fidelidade a trocar", () => {
  beforeAll(() => {
    // O Switch do Radix mede o próprio tamanho; o jsdom não tem ResizeObserver.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("na tabela: selo, editar sim, excluir e desativar não", () => {
    render(
      <CouponsTable
        items={[{ ...coupon, hasPendingLoyaltyRewards: true }]}
        isLoading={false}
        isBusy={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Prêmio de fidelidade a trocar")).not.toBeNull();
    expect(screen.getByTitle("Editar cupom")).not.toBeNull();
    expect(screen.queryByTitle(/Desativar cupom/)).toBeNull();
    expect(screen.queryByTitle("Excluir cupom")).toBeNull();
  });

  it("no formulário: código, valor, teto e ativo travados; descrição e vigência livres", () => {
    renderModal({ ...coupon, hasPendingLoyaltyRewards: true });

    expect(screen.getByText(/Algum cliente tem prêmio do programa de fidelidade/)).not.toBeNull();
    expect(input(/Código/).disabled).toBe(true);
    expect(input(/Valor \(R\$\)/).disabled).toBe(true);
    expect(input(/Teto de resgates/).disabled).toBe(true);
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(true);
    expect(input(/Descrição/).disabled).toBe(false);
    expect(input(/Compra mínima/).disabled).toBe(false);
  });

  it("inativo com prêmio pendente pode ser reativado: devolve o direito", () => {
    renderModal({ ...coupon, isActive: false, hasPendingLoyaltyRewards: true }, { ...form, isActive: false });

    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(false);
  });

  it("sem prêmio pendente, o cupom associado ao programa desligado fica livre", () => {
    renderModal({ ...coupon, redeemedCount: 0 });

    expect(screen.queryByText(/Algum cliente tem prêmio/)).toBeNull();
    expect(input(/Código/).disabled).toBe(false);
    expect(input(/Valor \(R\$\)/).disabled).toBe(false);
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(false);
  });
});
