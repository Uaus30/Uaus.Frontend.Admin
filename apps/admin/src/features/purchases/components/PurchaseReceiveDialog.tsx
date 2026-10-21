import { AlertTriangle, PackageCheck, Pencil } from "lucide-react";
import { Button, Input, Textarea, cn } from "@workspace/ui";
import { MOBILE_STICKY_FOOTER } from "./mobile-footer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { DatePicker, formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { blockImplicitSubmit } from "@/lib/block-implicit-submit";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { PricingPreview } from "@/features/stock-entries/components/PricingPreview";
import { PurchaseReceiveGrid } from "./PurchaseReceiveGrid";
import {
  conferencia,
  currentBrandProblem,
  needsCurrentBrand,
  receiveNewBrandProblem,
} from "../lib/new-brand";
import type { PurchaseDto, PurchaseFormItem, ReceiveForm } from "../types";

type PurchaseReceiveDialogProps = {
  purchase: PurchaseDto | null;
  form: ReceiveForm;
  onChange: <K extends keyof ReceiveForm>(field: K, value: ReceiveForm[K]) => void;
  /** Ajuste de uma variação na conferência. */
  onItemChange: (productId: number, campo: "quantity" | "finalTotal", valor: number) => void;
  /** Marca nova: o código bipado ou o "Gerar código" (fase 4). */
  onBrandChange?: (
    productId: number,
    campo: "newBarcode" | "generateBarcode",
    valor: string | boolean,
  ) => void;
  /** Variação que veio e não estava no pedido. */
  onAddItem: (item: PurchaseFormItem) => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** Leva ao formulário da compra — o caminho quando ela foi anotada sem custo. */
  onEditPurchase: (purchase: PurchaseDto) => void;
  isSaving: boolean;
  /**
   * Conferência de estoque aberta: o servidor recusaria a entrada. O diálogo
   * avisa e trava o confirmar, em vez de o operador descobrir pela recusa.
   */
  stockFrozen?: boolean;
};

/**
 * Recebimento de compra com produto JÁ cadastrado — que é também a CONFERÊNCIA.
 *
 * Em compra de um produto só, quantidade e custo vêm da compra e não se editam:
 * o diálogo pede o que a compra não sabe — data da entrada, número da nota e
 * preço de venda (em branco mantém o do cadastro).
 *
 * Em compra com VARIAÇÕES a grade aparece editável (12/09/2026). Quem compra
 * caixa sortida registra a grade no chute — não dá para saber as cores antes de
 * abrir a embalagem — e só aqui sabe o que veio. O que se ajusta é a
 * DISTRIBUIÇÃO, não o valor pago; enquanto a soma não fechar com o total da
 * compra, o confirmar fica desabilitado.
 *
 * A prévia de margem usa o custo unitário FINAL, que é o que a entrada grava.
 *
 * **Não há mais escolha sobre as fotos aqui** (13/09/2026). A galeria do produto
 * é editada na própria modal da compra e replicada no cadastro ao salvar, então
 * as duas já são a mesma lista quando o recebimento acontece — não sobrou
 * pergunta a fazer.
 *
 * **Marca nova** (fase 4, 14/10/2026): a linha da marca de outro fabricante
 * aparece na conferência com o campo do código — obrigatório aqui, bipado ou
 * gerado. É no recebimento que o cadastro dela nasce. Em produto SIMPLES o
 * diálogo pede também a marca do cadastro atual, que vira a primeira variação.
 *
 * **Produto novo com variações** (fase 5, 21/10/2026): a compra de produto
 * ainda não cadastrado, já em tamanhos ou cores, também vem para cá — e não para
 * o cadastro preenchido. Cada variação pede o código, o preço é obrigatório, e
 * ao confirmar o produto nasce com as variações que vieram.
 *
 * Compra anotada SEM custo (pendente) não se recebe daqui: a entrada gravaria o
 * lote a custo zero em silêncio. O diálogo diz isso e troca o botão de confirmar
 * por "Editar compra" — o backend recusa de qualquer jeito
 * (`PurchaseRules.EnsureCostInformed`), mas um botão que só devolve erro é pior
 * que um que leva ao lugar certo.
 */
export function PurchaseReceiveDialog({
  purchase,
  form,
  onChange,
  onItemChange,
  onBrandChange,
  onAddItem,
  onCancel,
  onConfirm,
  onEditPurchase,
  isSaving,
  stockFrozen = false,
}: PurchaseReceiveDialogProps) {
  const missingCost = purchase !== null && purchase.finalTotal <= 0;
  // Com uma variação só não há conferência a fazer: o que foi pedido é o que
  // chegou, e a grade seria uma tabela de uma linha para não decidir nada.
  const conferindo = conferencia(form.items);
  // Produto NOVO com variações (fase 5): ele nasce nesta confirmação, então o
  // preço é obrigatório e não há cadastro atual nem variação de fora a acrescentar.
  const produtoNovo = purchase?.newVariationGradeType != null;
  // Marca nova em produto simples: o cadastro atual vira a primeira variação e
  // precisa de uma marca. `=== false` porque a API antiga omitia o campo.
  const pedeMarcaAtual =
    !produtoNovo && purchase?.groupHasVariations === false && needsCurrentBrand(form.items);
  const problemaDaMarca =
    receiveNewBrandProblem(form.items, produtoNovo ? "variação" : "marca") ??
    (pedeMarcaAtual ? currentBrandProblem(form.items, form.currentBrand) : null) ??
    (produtoNovo && form.price <= 0 ? "Informe o preço de venda: o produto novo nasce com ele." : null);
  const somaDaGrade =
    Math.round(
      form.items.filter((item) => item.quantity > 0).reduce((total, item) => total + item.finalTotal, 0) *
        100,
    ) / 100;
  const gradeFecha = !conferindo || somaDaGrade === form.finalTotal;

  return (
    <Dialog open={purchase !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            Lançar recebimento
          </DialogTitle>
          <DialogDescription>
            A entrada de estoque é gravada com a quantidade e o custo desta compra, e a compra passa a
            Lançado.
          </DialogDescription>
        </DialogHeader>

        {purchase && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (missingCost || !gradeFecha || problemaDaMarca) return;
              onConfirm();
            }}
            // O bipe do código da marca nova termina num Enter, que lançaria a
            // entrada antes da conferência acabar.
            onKeyDown={blockImplicitSubmit}
            className="mt-2 flex flex-col gap-5"
          >
            <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">{purchase.productName}</p>
              <p className="text-xs text-muted-foreground">
                {purchase.supplierName} · {purchase.quantity} un. ·{" "}
                {missingCost ? (
                  <span className="font-semibold text-amber-500">sem custo informado</span>
                ) : (
                  <>
                    custo unitário{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(purchase.unitFinal)}
                    </span>{" "}
                    · total {formatCurrency(purchase.finalTotal)}
                  </>
                )}
              </p>
            </div>

            {missingCost && (
              <div
                data-testid="receive-missing-cost"
                className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-500"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Esta compra foi anotada sem custo. A entrada de estoque grava o custo unitário daqui — edite
                  a compra e informe o total final antes de lançar o recebimento.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Data da entrada <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={parseDateInput(form.entryDate)}
                  onChange={(date) => onChange("entryDate", formatDateInput(date))}
                  placeholder="Selecionar data"
                  clearable={false}
                  maxDate={new Date()}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Nº da Nota Fiscal
                </label>
                <Input
                  value={form.invoiceNumber}
                  onChange={(event) => onChange("invoiceNumber", event.target.value)}
                  placeholder="Ex: NF-1234"
                  className="h-10 bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Preço de venda {produtoNovo && <span className="text-red-500">*</span>}
                </label>
                <CurrencyInput
                  value={form.price}
                  onChange={(value) => onChange("price", value)}
                  className="h-10 bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  {produtoNovo
                    ? "O preço do produto novo, em todas as variações."
                    : purchase.suggestedPrice
                      ? "Veio do preço sugerido na compra. Em branco (zero) mantém o preço atual."
                      : "Em branco (zero) mantém o preço atual do cadastro."}
                </p>
              </div>
            </div>

            <PricingPreview
              unitCost={purchase.unitFinal}
              price={form.price}
              onApplySuggested={(price) => onChange("price", price)}
            />

            {conferindo && (
              <PurchaseReceiveGrid
                items={form.items}
                finalTotal={form.finalTotal}
                onItemChange={onItemChange}
                onBrandChange={onBrandChange}
                onAddVariation={onAddItem}
                newRowSuffix={produtoNovo ? "variação nova" : "marca nova"}
                allowAddVariation={!produtoNovo}
                onUseSum={(soma) => onChange("finalTotal", soma)}
              />
            )}

            {pedeMarcaAtual && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Marca do cadastro atual <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.currentBrand}
                  onChange={(event) => onChange("currentBrand", event.target.value.toUpperCase())}
                  placeholder="Ex: ORIGINAL"
                  maxLength={100}
                  className="h-10 bg-background uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Com a marca nova, &quot;{purchase.productName}&quot; passa a ter variações de Marca. O
                  cadastro de hoje (código {purchase.productBarcode || "atual"}) vira a primeira, com o mesmo
                  estoque e as mesmas vendas.
                </p>
              </div>
            )}

            {problemaDaMarca && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {problemaDaMarca}
              </p>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Observações</label>
              <Textarea
                value={form.notes}
                onChange={(event) => onChange("notes", event.target.value)}
                className="min-h-16"
              />
            </div>

            {stockFrozen && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                Há uma conferência de estoque em andamento: o recebimento fica pausado até ela ser encerrada.
              </p>
            )}

            <div
              className={cn(
                "mt-2 flex items-center justify-end gap-2 border-t border-border/40 pt-4",
                MOBILE_STICKY_FOOTER,
              )}
            >
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              {missingCost ? (
                <Button type="button" onClick={() => onEditPurchase(purchase)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar compra
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={isSaving || !gradeFecha || stockFrozen || problemaDaMarca !== null}
                >
                  {isSaving ? "Lançando..." : "Confirmar recebimento"}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
