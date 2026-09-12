import React from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ClipboardList } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
} from "@workspace/ui";
import { formatQuantity } from "@workspace/core";
import type { SupplierDto } from "@workspace/api-client-react";

import type { useStockCount } from "../hooks/useStockCount";

type StockCountModalProps = {
  count: ReturnType<typeof useStockCount>;
  /** Nome composto da variação — a contagem é do SKU, não do grupo. */
  productName: string;
  barcode: string | null;
  /** Saldo do sistema. `null` enquanto o produto carrega. */
  currentStock: number | null;
  suppliers: SupplierDto[];
};

/**
 * Contagem física de uma variação.
 *
 * O campo é **quantas unidades existem na prateleira**, e não a diferença: é o
 * que a pessoa acabou de contar, e pedir a diferença seria pedir uma conta de
 * cabeça. A prévia mostra o desfecho antes de gravar — sobra vira entrada de
 * ajuste, falta vira baixa de inventário, igual não gera documento nenhum.
 *
 * Fornecedor e custo só aparecem na SOBRA porque só ela vira lote; lote sem
 * custo envenena o FIFO e a valorização do inventário. Ambos chegam sugeridos
 * (último fornecedor e custo atual) e podem ser trocados.
 *
 * As cores são o vocabulário do repositório: verde = confere, âmbar = falta
 * (atenção), azul-primário = sobra. Nunca sozinhas — sempre com ícone e texto.
 */
export function StockCountModal({
  count,
  productName,
  barcode,
  currentStock,
  suppliers,
}: StockCountModalProps) {
  const { difference } = count;
  const sobra = difference !== null && difference > 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (count.countedIsValid && !count.isSaving) count.submit();
  }

  return (
    <Dialog open={count.open} onOpenChange={count.setOpen}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ClipboardList className="h-5 w-5 text-primary" />
            Contagem física
          </DialogTitle>
          <DialogDescription>
            Informe quantas unidades existem na prateleira. O sistema lança sozinho a diferença.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-border/40 bg-background/40 p-4">
            <p className="truncate text-sm font-semibold text-foreground" title={productName}>
              {productName}
            </p>
            <p className="text-xs text-muted-foreground">
              {barcode ? `Código ${barcode} · ` : ""}Estoque no sistema:{" "}
              <span className="font-semibold text-foreground">
                {currentStock === null ? "—" : formatQuantity(currentStock)}
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contagem-fisica">Contagem física</Label>
            <Input
              id="contagem-fisica"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              autoFocus
              placeholder="Quantas unidades você contou?"
              value={count.form.counted}
              onChange={(event) => count.updateForm({ counted: event.target.value })}
            />
          </div>

          <Previa difference={difference} />

          {sobra && (
            <div className="space-y-4 rounded-xl border border-border/40 bg-background/40 p-4">
              <p className="text-xs text-muted-foreground">
                A sobra entra como um lote novo. Sem preencher, o sistema usa o fornecedor da última entrada e
                o custo atual do produto.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="contagem-fornecedor">Fornecedor do lote</Label>
                <Select
                  value={count.form.supplierId}
                  onValueChange={(value) => count.updateForm({ supplierId: value })}
                >
                  <SelectTrigger id="contagem-fornecedor" className="h-9">
                    <SelectValue placeholder="Usar o da última entrada" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contagem-custo">Custo unitário</Label>
                <Input
                  id="contagem-custo"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Usar o custo atual"
                  value={count.form.unitCost}
                  onChange={(event) => count.updateForm({ unitCost: event.target.value })}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="contagem-observacao">Observação</Label>
            <Textarea
              id="contagem-observacao"
              rows={2}
              placeholder="Ex.: caixa esquecida no depósito"
              value={count.form.notes}
              onChange={(event) => count.updateForm({ notes: event.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => count.setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!count.countedIsValid || count.isSaving}
              className="hover-elevate gap-2"
            >
              {count.isSaving && <Spinner className="h-4 w-4" />}
              Registrar contagem
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** O desfecho, antes de gravar. Sem número digitado, não diz nada. */
function Previa({ difference }: { difference: number | null }) {
  if (difference === null) return null;

  if (difference === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />O estoque confere. Nenhum documento será gerado.
      </p>
    );
  }

  if (difference > 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
        <ArrowUp className="h-4 w-4 shrink-0" />
        Sobra de {formatQuantity(difference)} — entra como <strong>entrada de ajuste</strong>.
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
      <ArrowDown className="h-4 w-4 shrink-0" />
      Faltam {formatQuantity(-difference)} — sai como <strong>baixa de inventário</strong>.
    </p>
  );
}
