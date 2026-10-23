import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PurchaseReceiptCancellationDto } from "@workspace/api-client-react";
import { CancelReceiptDialog } from "../CancelReceiptDialog";

function previa(extras: Partial<PurchaseReceiptCancellationDto> = {}): PurchaseReceiptCancellationDto {
  return {
    purchaseId: 287,
    purchaseEntryId: 1322,
    canCancel: true,
    invoiceNumber: "NF-9",
    items: [
      {
        productId: 1240,
        productName: "SACOLA 3D URSO",
        barcode: "7908888909282",
        quantity: 2,
        currentPrice: 7,
        previousPriceRecorded: true,
      },
    ],
    otherPurchaseIds: [],
    ...extras,
  };
}

function renderDialog(
  preview: PurchaseReceiptCancellationDto | undefined,
  extras: { deleteGeneratedProduct?: boolean; isLoadingPreview?: boolean; previewError?: string } = {},
) {
  const props = {
    onDeleteGeneratedProductChange: vi.fn(),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };
  render(
    <CancelReceiptDialog
      target={{ id: 287, productName: "SACOLA 3D URSO" }}
      preview={preview}
      isLoadingPreview={extras.isLoadingPreview ?? false}
      previewError={extras.previewError}
      deleteGeneratedProduct={extras.deleteGeneratedProduct ?? false}
      isCancelling={false}
      {...props}
    />,
  );
  return props;
}

describe("CancelReceiptDialog — correções de 23/10/2026", () => {
  afterEach(() => cleanup());

  it("o preço que volta aparece na linha da variação", () => {
    const item = { ...previa().items[0], currentPrice: 25, revertsToPrice: 10 };
    renderDialog(previa({ items: [item] }));

    // O `Intl` separa "R$" do número com espaço não separável.
    const linha = screen.getByText(/Preço volta de/).textContent?.replace(/\s/g, " ");
    expect(linha).toBe("Preço volta de R$ 25,00 para R$ 10,00");
  });

  it("nota anterior ao registro do preço de antes avisa que o preço não volta sozinho", () => {
    const item = { ...previa().items[0], previousPriceRecorded: false };
    renderDialog(previa({ items: [item] }));

    expect(screen.getByText(/não guardou o preço de antes/)).toBeTruthy();
    expect(screen.queryByText(/Preço volta de/)).toBeNull();
  });

  it("prévia que falhou mostra o erro no lugar do botão, mesmo com a prévia velha na mão", () => {
    // A releitura depois de uma recusa falhou: o React Query guarda o dado velho
    // (`canCancel: true`) junto do erro, e o botão não pode voltar por causa dele.
    const { onClose } = renderDialog(previa(), {
      previewError: "Só a compra lançada tem recebimento para cancelar.",
    });

    expect(screen.getByText("Só a compra lançada tem recebimento para cancelar.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sim, cancelar recebimento" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("produto gerado que não pode sair sem motivo informado não deixa a frase solta", () => {
    renderDialog(
      previa({
        generatedProduct: {
          productGroupId: 1101,
          name: "SACOLA 3D URSO",
          barcodes: ["7908888909282"],
          canDelete: false,
        },
      }),
    );

    expect(screen.getByText(/ele tem outro movimento além deste recebimento/)).toBeTruthy();
  });
});

describe("CancelReceiptDialog", () => {
  afterEach(() => cleanup());

  it("mostra o que sai do estoque e confirma pelo botão vermelho", () => {
    const { onConfirm } = renderDialog(previa());

    expect(screen.getByText("Compra #287 — SACOLA 3D URSO")).toBeTruthy();
    expect(screen.getByText("−2 un")).toBeTruthy();
    expect(screen.getByText(/entrada #1322 · NF NF-9/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sim, cancelar recebimento" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("quando o servidor diz que não dá, o motivo aparece no lugar do botão", () => {
    const { onClose } = renderDialog(
      previa({ canCancel: false, blockedReason: "Parte do que este recebimento trouxe já saiu do estoque." }),
    );

    expect(screen.getByText("Parte do que este recebimento trouxe já saiu do estoque.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sim, cancelar recebimento" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("enquanto a prévia carrega, não há botão de confirmar", () => {
    renderDialog(undefined, { isLoadingPreview: true });

    expect(screen.getByTestId("receipt-cancellation-loading")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sim, cancelar recebimento" })).toBeNull();
  });

  it("o produto criado no recebimento vem com a caixa de excluir, e desmarcar avisa a tela", () => {
    const { onDeleteGeneratedProductChange } = renderDialog(
      previa({
        generatedProduct: {
          productGroupId: 1101,
          name: "SACOLA 3D URSO",
          barcodes: ["7908888909282"],
          canDelete: true,
        },
      }),
      { deleteGeneratedProduct: true },
    );

    const caixa = screen.getByRole("checkbox", { name: "Excluir também o produto criado neste recebimento" });
    expect(caixa.getAttribute("aria-checked")).toBe("true");
    // Excluindo, a compra volta a produto novo: o aviso de "o cadastro fica" não vale.
    expect(screen.queryByText(/O preço de venda volta ao de antes quando ninguém o mudou/)).toBeNull();

    fireEvent.click(caixa);
    expect(onDeleteGeneratedProductChange).toHaveBeenCalledWith(false);
  });

  it("produto gerado que não pode sair diz por quê, sem caixa", () => {
    renderDialog(
      previa({
        generatedProduct: {
          productGroupId: 1101,
          name: "SACOLA 3D URSO",
          barcodes: ["7908888909282"],
          canDelete: false,
          blockedReason: "O produto está também na compra #290.",
        },
      }),
    );

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/O produto está também na compra #290/)).toBeTruthy();
    expect(screen.getByText(/O preço de venda volta ao de antes quando ninguém o mudou/)).toBeTruthy();
  });

  it("a nota que fechou outra compra avisa que ela volta junto", () => {
    renderDialog(previa({ otherPurchaseIds: [288] }));

    expect(screen.getByText(/A mesma nota lançou também a compra #288/)).toBeTruthy();
  });
});
