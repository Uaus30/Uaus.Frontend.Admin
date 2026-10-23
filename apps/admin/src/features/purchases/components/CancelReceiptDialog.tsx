import { AlertTriangle, Lock, PackageX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  Spinner,
} from "@workspace/ui";
import type { PurchaseReceiptCancellationDto } from "@workspace/api-client-react";
import { formatCurrency, formatShortDate } from "@workspace/core";
import type { ReceiptCancellationTarget } from "../hooks/useCancelPurchaseReceipt";

type CancelReceiptDialogProps = {
  /** A compra com a confirmação aberta; nulo fecha. */
  target: ReceiptCancellationTarget | null;
  /** A prévia do servidor. `undefined` enquanto a consulta não respondeu. */
  preview: PurchaseReceiptCancellationDto | undefined;
  isLoadingPreview: boolean;
  /** A prévia falhou: a frase aparece no lugar do botão de confirmar. */
  previewError?: string | null;
  /** A prévia está sendo relida: o botão de confirmar espera por ela. */
  isRefreshingPreview?: boolean;
  /** A caixa "excluir também o produto criado" — só aparece quando ele pode sair. */
  deleteGeneratedProduct: boolean;
  onDeleteGeneratedProductChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  isCancelling: boolean;
};

/**
 * A confirmação do "Cancelar recebimento" (23/10/2026).
 *
 * Mostra o que a PRÉVIA do servidor disse, e nada além: o que sai do estoque, a
 * nota, as outras compras que a mesma nota fechou e o produto que o recebimento
 * cadastrou. Quando o servidor diz que não dá — unidade já vendida, conferência
 * aberta —, o motivo aparece no lugar do botão, como no espelho da nota: o botão
 * que some sem explicação faz a tela parecer quebrada.
 *
 * O botão de confirmar não é o `AlertDialogAction`: aquele fecha o diálogo no
 * clique, antes de o servidor responder. Quem fecha é o sucesso do cancelamento.
 */
export function CancelReceiptDialog({
  target,
  preview,
  isLoadingPreview,
  previewError = null,
  isRefreshingPreview = false,
  deleteGeneratedProduct,
  onDeleteGeneratedProductChange,
  onClose,
  onConfirm,
  isCancelling,
}: CancelReceiptDialogProps) {
  const generated = preview?.generatedProduct;
  const keepsProduct = !generated || !deleteGeneratedProduct;
  const canConfirm = preview?.canCancel === true && !previewError;
  // Nota anterior a 23/10/2026: não guardou o preço de antes, e o dela fica.
  const priceNotRecorded = preview?.items.some((item) => !item.previousPriceRecorded) ?? false;

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent
        className="max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(event) => {
          if (isCancelling) event.preventDefault();
        }}
      >
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle>Cancelar o recebimento desta compra?</AlertDialogTitle>
          <AlertDialogDescription>
            As unidades lançadas saem do estoque e a compra volta para A caminho, pronta para ser corrigida e
            recebida de novo. A entrada de estoque cancelada não volta.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {target && (
          <p className="break-words rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-center text-sm font-medium text-foreground">
            Compra #{target.id} — {target.productName}
          </p>
        )}

        {previewError ? (
          <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm leading-relaxed text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{previewError}</span>
          </p>
        ) : isLoadingPreview || !preview ? (
          <div className="flex justify-center py-6" data-testid="receipt-cancellation-loading">
            <Spinner />
          </div>
        ) : !preview.canCancel ? (
          <p className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{preview.blockedReason ?? "Este recebimento não pode ser cancelado."}</span>
          </p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Sai do estoque
                {preview.purchaseEntryId != null && ` — entrada #${preview.purchaseEntryId}`}
                {preview.invoiceNumber && ` · NF ${preview.invoiceNumber}`}
                {preview.entryDate && ` · ${formatShortDate(preview.entryDate)}`}
              </p>
              <ul className="divide-y divide-border/40 rounded-md border border-border/50">
                {preview.items.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block break-words font-medium text-foreground">
                        {item.productName}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{item.barcode}</span>
                      {/* O preço que o recebimento aplicou volta (23/10/2026) —
                          só quando ninguém o mudou depois; o servidor decide. */}
                      {item.revertsToPrice != null && (
                        <span className="block text-xs text-foreground">
                          Preço volta de {formatCurrency(item.currentPrice)} para{" "}
                          <span className="font-semibold">{formatCurrency(item.revertsToPrice)}</span>
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold text-destructive">−{item.quantity} un</span>
                  </li>
                ))}
              </ul>
            </div>

            {preview.otherPurchaseIds.length > 0 && (
              <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
                A mesma nota lançou também{" "}
                {preview.otherPurchaseIds.length === 1 ? "a compra " : "as compras "}
                {preview.otherPurchaseIds.map((id) => `#${id}`).join(", ")}: volta junto para A caminho.
              </p>
            )}

            {generated && generated.canDelete && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5">
                <Checkbox
                  className="mt-0.5"
                  checked={deleteGeneratedProduct}
                  disabled={isCancelling}
                  onCheckedChange={(value) => onDeleteGeneratedProductChange(value === true)}
                  aria-label="Excluir também o produto criado neste recebimento"
                />
                <span>
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <PackageX className="h-4 w-4 text-destructive" />
                    Excluir também o produto criado neste recebimento
                  </span>
                  <span className="block font-medium">{generated.name}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {generated.barcodes.join(" · ")}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    A compra volta a ser de produto novo, e o código fica livre para o próximo recebimento.
                    Desmarque se o cadastro está certo e o erro foi só de quantidade ou de custo.
                  </span>
                </span>
              </label>
            )}

            {generated && !generated.canDelete && (
              <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-muted-foreground">
                O produto <span className="font-medium text-foreground">{generated.name}</span>, criado neste
                recebimento, continua no cadastro:{" "}
                {generated.blockedReason ?? "ele tem outro movimento além deste recebimento."}
              </p>
            )}

            {keepsProduct && priceNotRecorded && (
              <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                Esta entrada é anterior a 23/10/2026 e não guardou o preço de antes: se ela mudou o preço de
                venda, ele não volta sozinho — confira no cadastro.
              </p>
            )}

            {keepsProduct && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                O preço de venda volta ao de antes quando ninguém o mudou depois do recebimento. A reativação
                e a troca de código de barras feitas nele não são desfeitas. A compra continua vinculada ao
                produto — para trocar, edite a compra e desvincule.
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isCancelling}>
            {previewError || (preview && !preview.canCancel) ? "Fechar" : "Voltar"}
          </Button>
          {canConfirm && (
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isCancelling || isRefreshingPreview}
            >
              {(isCancelling || isRefreshingPreview) && (
                <Spinner className="mr-2 h-4 w-4" dotClassName="h-1.5 w-1.5 bg-current" />
              )}
              Sim, cancelar recebimento
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
