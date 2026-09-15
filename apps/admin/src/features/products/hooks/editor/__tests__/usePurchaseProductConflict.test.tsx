import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("wouter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/produtos", mocks.navigate],
}));

const { usePurchaseProductConflict } = await import("../usePurchaseProductConflict");

const CONFLITO = {
  barcode: "7891234567895",
  productName: "COPO TÉRMICO 500ML",
  purchaseName: "COPO TERMICO GRANDE",
  purchaseId: 12,
};

function renderConflict() {
  const limparCodigo = vi.fn();
  const view = renderHook(() => usePurchaseProductConflict({ limparCodigo }));
  return { ...view, limparCodigo };
}

describe("usePurchaseProductConflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nasce sem conflito nenhum", () => {
    const { result } = renderConflict();
    expect(result.current.conflict).toBeNull();
  });

  it("guarda os dois lados do conflito — o que já existe e o que a compra achava que era", () => {
    // A modal nomeia os dois: "este produto já existe" sozinho obrigaria o
    // operador a adivinhar QUAL produto é, e é esse nome que ele vai procurar
    // no seletor da tela de Compras um clique depois.
    const { result } = renderConflict();

    act(() => result.current.reportConflict(CONFLITO));

    expect(result.current.conflict).toEqual(CONFLITO);
  });

  it("'Ajustar a compra' leva à modal daquela compra e fecha o aviso", () => {
    const { result } = renderConflict();
    act(() => result.current.reportConflict(CONFLITO));

    act(() => result.current.goToPurchase());

    expect(mocks.navigate).toHaveBeenCalledWith("/estoque/compras?compra=12");
    expect(result.current.conflict).toBeNull();
  });

  it("sem conflito não navega para lugar nenhum", () => {
    const { result } = renderConflict();

    act(() => result.current.goToPurchase());

    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("'Corrigir o código' fica na tela e limpa o campo", () => {
    // Deixar o código duplicado no campo só adiaria a recusa para o salvar — e o
    // leitor ACRESCENTA ao que já está lá, então o bipe seguinte viraria dois
    // códigos emendados.
    const { result, limparCodigo } = renderConflict();
    act(() => result.current.reportConflict(CONFLITO));

    act(() => result.current.dismissConflict());

    expect(limparCodigo).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(result.current.conflict).toBeNull();
  });

  it("fechar a tela esquece o conflito sem mexer no campo", () => {
    const { result, limparCodigo } = renderConflict();
    act(() => result.current.reportConflict(CONFLITO));

    act(() => result.current.clearConflict());

    expect(result.current.conflict).toBeNull();
    expect(limparCodigo).not.toHaveBeenCalled();
  });
});
