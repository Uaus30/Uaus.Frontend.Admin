import { AlertTriangle, Check } from "lucide-react";
import { Button, Input } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { formatCurrency, formatQuantity } from "@workspace/core";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { ProductSearchPicker, type ProductSearchOption } from "@/components/product-search-picker";
import type { PurchaseFormItem } from "../types";

type PurchaseReceiveGridProps = {
  items: PurchaseFormItem[];
  /** O total pago segundo a compra — ou o novo, se o operador já confirmou um. */
  finalTotal: number;
  onItemChange: (productId: number, campo: "quantity" | "finalTotal", valor: number) => void;
  onAddVariation: (item: PurchaseFormItem) => void;
  onUseSum: (soma: number) => void;
};

/**
 * A conferência do que chegou.
 *
 * O recebimento deixou de ser só "confirmar" em 12/09/2026. Quem compra caixa
 * sortida registra a grade no chute — não dá para saber as cores antes de abrir
 * a embalagem — e só na hora de receber sabe o que veio. Por isso a grade é
 * editável aqui, com acrescentar a variação que veio e zerar a que não veio.
 *
 * **O que se ajusta é a DISTRIBUIÇÃO, não o valor pago.** O total da compra é o
 * que saiu do bolso e não muda por efeito colateral de um ajuste de quantidade;
 * a grade redistribui esse total. Enquanto a soma não fechar, o aviso aparece e
 * o botão de confirmar fica desabilitado — deixar passar faria a entrada e a
 * compra contarem histórias diferentes sobre o mesmo dinheiro, e a compra fica
 * imutável logo depois.
 *
 * Quando o valor mudou de verdade (faltou item e o fornecedor abateu), o botão
 * "Usar a soma" confirma o total novo — explicitamente, que é o ponto.
 */
export function PurchaseReceiveGrid({
  items,
  finalTotal,
  onItemChange,
  onAddVariation,
  onUseSum,
}: PurchaseReceiveGridProps) {
  const recebidas = items.filter((item) => item.quantity > 0);
  const soma = Math.round(recebidas.reduce((total, item) => total + item.finalTotal, 0) * 100) / 100;
  const fecha = soma === finalTotal;

  function acrescentar(produto: ProductSearchOption) {
    onAddVariation({
      productId: produto.id,
      name: produto.name,
      barcode: produto.barcode,
      stock: produto.stock,
      quantity: 1,
      grossTotal: 0,
      finalTotal: 0,
    });
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase text-muted-foreground">
        Conferência do que chegou
      </label>

      <div className="overflow-hidden rounded-xl border border-border/40">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="h-9 text-xs">Variação</TableHead>
              <TableHead className="h-9 w-28 text-right text-xs">Qtd.</TableHead>
              <TableHead className="h-9 w-36 text-right text-xs">Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.productId} className={item.quantity > 0 ? "" : "opacity-60"}>
                <TableCell className="py-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="font-mono text-2xs text-muted-foreground">{item.barcode || "Sem código"}</p>
                </TableCell>
                <TableCell className="py-2">
                  {/* Zero é o campo em branco e significa "não veio" — a variação
                      sai do recebimento sem precisar de um botão de remover. */}
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity > 0 ? item.quantity : ""}
                    onChange={(event) => onItemChange(item.productId, "quantity", Number(event.target.value))}
                    aria-label={`Quantidade recebida de ${item.name}`}
                    className="h-9 bg-background text-right"
                  />
                </TableCell>
                <TableCell className="py-2">
                  <CurrencyInput
                    value={item.finalTotal}
                    onChange={(valor) => onItemChange(item.productId, "finalTotal", valor)}
                    className="h-9 bg-background text-right"
                    readOnly={item.quantity <= 0}
                    allowFormula
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProductSearchPicker
        onSelect={acrescentar}
        selectedIds={items.map((item) => item.productId)}
        placeholder="Veio uma variação que não estava no pedido? Busque e acrescente..."
      />

      {fecha ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          {recebidas.length} variação(ões),{" "}
          {formatQuantity(recebidas.reduce((total, item) => total + item.quantity, 0))} unidades — soma{" "}
          {formatCurrency(soma)}, igual ao total da compra.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            A soma das variações ({formatCurrency(soma)}) não fecha com o total da compra (
            {formatCurrency(finalTotal)}).
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-2xs"
            onClick={() => onUseSum(soma)}
          >
            Usar {formatCurrency(soma)} como total pago
          </Button>
        </div>
      )}
    </div>
  );
}
