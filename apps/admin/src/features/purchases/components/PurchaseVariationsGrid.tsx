import { Calculator, PencilLine } from "lucide-react";
import { Button, Input, Spinner } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { formatCurrency, formatQuantity } from "@workspace/core";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import type { PurchaseFormItem } from "../types";

type PurchaseVariationsGridProps = {
  items: PurchaseFormItem[];
  costSplitManual: boolean;
  readOnly: boolean;
  loading: boolean;
  onQuantityChange: (productId: number, quantity: number) => void;
  onTotalChange: (productId: number, valor: number) => void;
  onToggleManual: (manual: boolean) => void;
};

/**
 * A grade de variações da compra.
 *
 * Mostra TODAS as variações do grupo, e não só as compradas: é ela que responde
 * "o que existe para eu escolher". Quantidade zero é "não comprei esta", e a
 * linha nem vira item ao gravar.
 *
 * A coluna de custo muda de dono conforme o modo, e nunca são os dois:
 *
 * - **Rateado** (padrão): o operador digita os totais do PEDIDO lá em cima e a
 *   fatia de cada variação aparece aqui, calculada, em texto. É o caso comum —
 *   o fornecedor cobra o mesmo por todas as cores.
 * - **Por variação**: a fatia vira campo e o total do pedido passa a ser a soma.
 *   Existe para a variação mais cara (o GG custa mais que o P).
 *
 * Voltar para rateado recalcula tudo, então o botão avisa antes: o trabalho de
 * digitar dez valores não pode sumir por um clique sem confirmação.
 */
export function PurchaseVariationsGrid({
  items,
  costSplitManual,
  readOnly,
  loading,
  onQuantityChange,
  onTotalChange,
  onToggleManual,
}: PurchaseVariationsGridProps) {
  const compradas = items.filter((item) => item.quantity > 0);
  const totalDeUnidades = compradas.reduce((soma, item) => soma + item.quantity, 0);
  const somaDasFatias = compradas.reduce((soma, item) => soma + item.finalTotal, 0);

  function alternarModo() {
    if (
      costSplitManual &&
      !window.confirm("Voltar para o custo rateado recalcula os valores digitados por variação. Continuar?")
    ) {
      return;
    }
    onToggleManual(!costSplitManual);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase text-muted-foreground">
          Variações <span className="text-red-500">*</span>
        </label>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={alternarModo}
          >
            {costSplitManual ? (
              <Calculator className="h-3.5 w-3.5" />
            ) : (
              <PencilLine className="h-3.5 w-3.5" />
            )}
            {costSplitManual ? "Voltar ao custo rateado" : "Informar custo por variação"}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/40">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="h-9 text-xs">Variação</TableHead>
              <TableHead className="h-9 w-24 text-right text-xs">Estoque</TableHead>
              <TableHead className="h-9 w-28 text-right text-xs">Qtd.</TableHead>
              <TableHead className="h-9 w-36 text-right text-xs">
                {costSplitManual ? "Custo desta variação" : "Fatia do custo"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  <Spinner className="mr-2 inline h-4 w-4" /> Carregando variações...
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.productId} className={item.quantity > 0 ? "" : "opacity-60"}>
                <TableCell className="py-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="font-mono text-2xs text-muted-foreground">{item.barcode || "Sem código"}</p>
                </TableCell>
                <TableCell className="py-2 text-right text-sm text-muted-foreground">
                  {/* "2 → 5" só aparece na linha comprada: nas outras o operador
                      não pediu previsão nenhuma. */}
                  {item.quantity > 0
                    ? `${formatQuantity(item.stock)} → ${formatQuantity(item.stock + item.quantity)}`
                    : formatQuantity(item.stock)}
                </TableCell>
                <TableCell className="py-2">
                  {/* Zero é o campo EM BRANCO, como no resto do formulário: com
                      `value={0}` o React escreve "0" no campo apagado e o que vem
                      depois entra à direita — "020". */}
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity > 0 ? item.quantity : ""}
                    onChange={(event) => onQuantityChange(item.productId, Number(event.target.value))}
                    aria-label={`Quantidade de ${item.name}`}
                    className="h-9 bg-background text-right"
                    readOnly={readOnly}
                  />
                </TableCell>
                <TableCell className="py-2 text-right">
                  {costSplitManual ? (
                    <CurrencyInput
                      value={item.finalTotal}
                      onChange={(valor) => onTotalChange(item.productId, valor)}
                      className="h-9 bg-background text-right"
                      readOnly={readOnly || item.quantity <= 0}
                      allowFormula
                    />
                  ) : (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {item.quantity > 0 ? formatCurrency(item.finalTotal) : "—"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {compradas.length === 0 ? (
          "Informe a quantidade de ao menos uma variação."
        ) : (
          <>
            {compradas.length} variação(ões), {formatQuantity(totalDeUnidades)} unidades —{" "}
            <span className="font-medium text-foreground">{formatCurrency(somaDasFatias)}</span>
            {costSplitManual
              ? " (soma das variações, que vira o total do pedido)"
              : " (rateado pelo total do pedido)"}
          </>
        )}
      </p>
    </div>
  );
}
