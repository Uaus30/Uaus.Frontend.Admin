import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromotionsTable } from "../PromotionsTable";
import type { PromotionRow } from "../../types";

function promocao(): PromotionRow {
  return {
    id: 5,
    productGroupName: "ESMALTE RISQUÉ",
    productGroupImageUrl: null,
    type: "Regular",
    discountType: "Percentage",
    discountValue: 10,
    referencePriceMin: 10,
    referencePriceMax: 10,
    promotionalPriceMin: 9,
    promotionalPriceMax: 9,
    maxQuantityPerSale: null,
    investment: 0,
    validFrom: "2026-10-06T08:00:00",
    validUntil: null,
    situation: "no-ar",
  } as unknown as PromotionRow;
}

function renderTable() {
  const props = {
    items: [promocao()],
    isLoading: false,
    isBusy: false,
    onOpen: vi.fn(),
    onRepeat: vi.fn(),
    onEnd: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<PromotionsTable {...props} />);
  return props;
}

describe("PromotionsTable — no celular (06/10/2026)", () => {
  it("o menu ⋮ tem as ações por extenso, e escolher uma não abre a promoção", () => {
    // Os três ícones só se distinguiam pelo desenho: o nome estava no `title`,
    // que não existe no toque.
    const props = renderTable();

    fireEvent.pointerDown(screen.getByRole("button", { name: /opções da promoção de esmalte/i }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByRole("menuitem", { name: /encerrar agora/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /repetir promoção/i }));

    expect(props.onRepeat).toHaveBeenCalled();
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("tipo, desconto, preço, vigência e situação vêm embaixo do nome", () => {
    renderTable();

    const nome = screen.getByText("ESMALTE RISQUÉ");
    const resumo = nome.parentElement!.querySelector(".lg\\:hidden")!;
    expect(resumo.textContent).toContain("por");
    expect(resumo.textContent).toContain("sem prazo");
    // O investimento ficava em toda largura; no celular ele vem no resumo.
    expect(resumo.textContent).toContain("sem investimento");
  });
});
