import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductSearchOption } from "@/components/product-search-picker";
import { PurchaseProductLinkDialog } from "../PurchaseProductLinkDialog";

const PRODUTO: ProductSearchOption = {
  id: 10,
  productGroupId: 10,
  name: "CANECA TÉRMICA 500ML",
  barcode: "7891234567895",
  stock: 4,
  price: 39.9,
  costPrice: 18.4,
};

function renderDialog(props: Partial<React.ComponentProps<typeof PurchaseProductLinkDialog>> = {}) {
  const handlers = {
    onUseProductGallery: vi.fn(),
    onKeepPurchaseImages: vi.fn(),
    onCancel: vi.fn(),
  };
  render(
    <PurchaseProductLinkDialog
      product={PRODUTO}
      purchaseName="CANECA TERMICA"
      imageCount={3}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

/**
 * A modal que explica o que o vínculo substitui.
 *
 * O que está em teste aqui é o TEXTO, porque é ele a entrega: o defeito que esta
 * modal conserta não era um erro de programa, era uma perda silenciosa. Uma
 * versão que abrisse com o texto errado não quebraria nada — só deixaria o
 * operador clicar sem saber o que estava escolhendo.
 */
describe("PurchaseProductLinkDialog", () => {
  afterEach(cleanup);

  it("sem produto pendente não aparece", () => {
    renderDialog({ product: null });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("avisa que o nome digitado não fica gravado, nomeando os dois", () => {
    renderDialog();

    const texto = screen.getByRole("alertdialog").textContent ?? "";
    expect(texto).toContain("CANECA TÉRMICA 500ML");
    expect(texto).toContain("CANECA TERMICA");
    expect(texto).toMatch(/não fica gravado/i);
  });

  it("com foto, oferece as duas respostas — e diz que manter SUBSTITUI a galeria do produto", () => {
    // "Manter" sem dizer o que acontece com as fotos do produto seria a versão
    // simpática de outra perda silenciosa: salvar deixa a galeria do grupo igual
    // à lista da compra, então manter as daqui tira as de lá.
    const handlers = renderDialog();

    const manter = screen.getByRole("button", { name: /manter as 3 fotos desta compra/i });
    expect(manter.textContent ?? "").toMatch(/substituem/i);

    fireEvent.click(screen.getByRole("button", { name: /usar as fotos do produto/i }));
    expect(handlers.onUseProductGallery).toHaveBeenCalledTimes(1);

    fireEvent.click(manter);
    expect(handlers.onKeepPurchaseImages).toHaveBeenCalledTimes(1);
  });

  it("uma foto só fala no singular", () => {
    renderDialog({ imageCount: 1 });
    expect(screen.getByRole("button", { name: /manter a?s? ?1 foto desta compra/i })).toBeTruthy();
  });

  it("sem foto não inventa escolha: só o aviso do nome e um Vincular", () => {
    const handlers = renderDialog({ imageCount: 0 });

    expect(screen.queryByRole("button", { name: /usar as fotos do produto/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^vincular$/i }));
    expect(handlers.onUseProductGallery).toHaveBeenCalledTimes(1);
  });

  it("'Não vincular' devolve a decisão sem aplicar nada", () => {
    const handlers = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /não vincular/i }));

    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
    expect(handlers.onUseProductGallery).not.toHaveBeenCalled();
    expect(handlers.onKeepPurchaseImages).not.toHaveBeenCalled();
  });
});
