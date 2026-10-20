import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromotionBannerDialog } from "../PromotionBannerDialog";
import { DEFAULT_BANNER_EDIT, type PromotionBannerEdit } from "../../hooks/promotionBannerRules";
import type { PromotionRow } from "../../types";

function promocao(parcial: Partial<PromotionRow> = {}): PromotionRow {
  return {
    id: 1,
    productGroupName: "COPO AMERICANO",
    productGroupImageUrl: null,
    type: "Flash",
    discountType: "FinalPrice",
    discountValue: 0.99,
    referencePriceMin: 1.75,
    referencePriceMax: 1.75,
    promotionalPriceMin: 0.99,
    promotionalPriceMax: 0.99,
    investment: 0,
    validFrom: "2026-10-17T08:00:00",
    validUntil: "2026-10-17T18:00:59",
    isActive: true,
    situation: "programada",
    ...parcial,
  } as unknown as PromotionRow;
}

const DUAS = [promocao(), promocao({ id: 2, productGroupName: "ESMALTE RISQUÉ", situation: "no-ar" })];

function renderDialog(edits: Record<number, PromotionBannerEdit>, bannerCount: number, candidates = DUAS) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    candidates,
    isLoading: false,
    title: "",
    onTitleChange: vi.fn(),
    editOf: (promotion: PromotionRow) => edits[promotion.id] ?? DEFAULT_BANNER_EDIT,
    onToggle: vi.fn(),
    onNameChange: vi.fn(),
    onCopiesChange: vi.fn(),
    bannerCount,
    onPrint: vi.fn(),
    // Régua de mentira: 4mm por caractere, ~21 por linha nos 84,7mm.
    measureName: (texto: string) => texto.length * 4,
  };
  render(<PromotionBannerDialog {...props} />);
  return props;
}

describe("PromotionBannerDialog", () => {
  it("o nome e as cópias só aparecem na promoção marcada, com o nome do cadastro como placeholder", () => {
    renderDialog({ 2: { selected: true, name: "", copies: 1 } }, 1);

    expect(screen.getAllByLabelText("Nome no banner")).toHaveLength(1);
    expect(screen.getByPlaceholderText("ESMALTE RISQUÉ")).toBeTruthy();
  });

  it("o nome no banner para em 44 caracteres", () => {
    renderDialog({ 1: { selected: true, name: "", copies: 1 } }, 1);

    expect(screen.getByLabelText("Nome no banner").getAttribute("maxLength")).toBe("44");
  });

  it("avisa pelo número de LINHAS, e não de caracteres: o nome de 37 que quebra em três", () => {
    // Achado da revisão (20/10/2026): com 37 caracteres a modal calava, e o "24CM"
    // sumia na terceira linha — as formas de 24, 26 e 28cm saíam com o mesmo nome.
    renderDialog({ 1: { selected: true, name: "", copies: 1 } }, 1, [
      promocao({ productGroupName: "FORMA REDONDA ANTIADERENTE PRETA 24CM" }),
    ]);

    expect(screen.getByText(/nome do cadastro passa de duas linhas/i)).toBeTruthy();
  });

  it("o nome digitado que não cabe também avisa", () => {
    renderDialog({ 1: { selected: true, name: "FORMA REDONDA ANTIADERENTE PRETA 24CM", copies: 1 } }, 1);

    expect(screen.getByText(/este nome passa de duas linhas/i)).toBeTruthy();
  });

  it("nome do cadastro curto, ou reescrito, não mostra o aviso", () => {
    const longo = "CONJUNTO DE POTES DE VIDRO HERMETICO RETANGULAR COM TAMPA";
    renderDialog({ 1: { selected: true, name: "POTES DE VIDRO 3 PEÇAS", copies: 1 } }, 1, [
      promocao({ productGroupName: longo }),
    ]);

    expect(screen.queryByText(/passa de duas linhas/)).toBeNull();
  });

  it("digitar o nome e as cópias avisa o controlador — nada vai ao cadastro", () => {
    const props = renderDialog({ 1: { selected: true, name: "", copies: 1 } }, 1);

    fireEvent.change(screen.getByLabelText("Nome no banner"), { target: { value: "COPO" } });
    fireEvent.change(screen.getByLabelText("Cópias"), { target: { value: "3" } });

    expect(props.onNameChange).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), "COPO");
    expect(props.onCopiesChange).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 3);
  });

  it("marcar chama o toggle, e o botão diz quantos banners e folhas saem", () => {
    const props = renderDialog({ 1: { selected: true, name: "", copies: 7 } }, 7);

    fireEvent.click(screen.getByRole("checkbox", { name: /banner de esmalte/i }));
    expect(props.onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));

    expect(screen.getByText("7 banners · 2 folhas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /imprimir 7 banners/i }));
    expect(props.onPrint).toHaveBeenCalled();
  });

  it("o título da faixa tem PROMOÇÃO como placeholder e avisa o controlador ao digitar", () => {
    const props = renderDialog({}, 0);

    const campo = screen.getByLabelText("Título do banner");
    expect(campo.getAttribute("placeholder")).toBe("PROMOÇÃO");

    fireEvent.change(campo, { target: { value: "OFERTA" } });
    expect(props.onTitleChange).toHaveBeenCalledWith("OFERTA");
  });

  it("sem nada marcado o Imprimir fica desabilitado", () => {
    renderDialog({}, 0);

    expect((screen.getByRole("button", { name: /^imprimir$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem promoção no ar nem programada, explica em vez de mostrar lista vazia", () => {
    renderDialog({}, 0, []);

    expect(screen.getByText(/nenhuma promoção no ar ou programada/i)).toBeTruthy();
  });
});
