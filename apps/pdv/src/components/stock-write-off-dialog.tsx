import {
  SELECTABLE_STOCK_WRITE_OFF_REASONS,
  STOCK_WRITE_OFF_REASON_LABEL,
} from "@workspace/api-client-react";
import { FileText, Loader2, PackageMinus, Search } from "lucide-react";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { WriteOffItemsList } from "@/features/pdv/components/write-off-items-list";
import { useStockWriteOffDraft } from "@/features/pdv/hooks/use-stock-write-off-draft";

type StockWriteOffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado depois de uma baixa gravada no servidor (não na fila offline). */
  onRegistered?: () => void | Promise<void>;
};

/**
 * Baixa de estoque: saída de mercadoria **sem venda** — consumo interno, perda
 * ou doação.
 *
 * Mora num diálogo próprio, aberto pelo menu sanduíche, e não no checkout: a
 * tela de finalização já é o momento mais tenso do balcão e não pode ganhar mais
 * um campo. Baixa também não tem nada a ver com pagamento — é movimento de
 * estoque, não de dinheiro.
 *
 * Nada é impresso: a baixa não tem comprovante.
 *
 * O rascunho e a gravação vivem em `features/pdv/hooks/use-stock-write-off-draft.ts`;
 * aqui fica só a montagem da tela.
 */
export function StockWriteOffDialog({ open, onOpenChange, onRegistered }: StockWriteOffDialogProps) {
  const {
    online,
    reason,
    setReason,
    items,
    notes,
    setNotes,
    saving,
    shortages,
    search,
    pickProduct,
    changeQuantity,
    removeItem,
    handleOpenChange,
    confirm,
  } = useStockWriteOffDraft({ open, onOpenChange, onRegistered });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-[640px]">
        <div className="shrink-0 border-b border-border/50 bg-primary/10 p-6">
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-bold">
            <PackageMinus className="h-6 w-6 text-primary" /> Baixa de Estoque
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Saída de mercadoria sem venda. Não gera cupom nem entra no caixa.
          </DialogDescription>
        </div>

        {/* `min-h-0` é o que permite a área rolar: sem ele um filho `flex-1` não
            encolhe abaixo do próprio conteúdo. */}
        {/* Rolagem NATIVA: o viewport do `ScrollArea` do Radix depende de
            `height: 100%`, que não resolve dentro de um diálogo de altura
            `max-h` (indefinida para porcentagem). Com mais conteúdo do que cabe
            na tela ele crescia até a altura do conteúdo e o excedente era
            CORTADO, sem barra e sem rolagem — ver o histórico de vendas. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Motivo
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {/* Inventário não aparece: ele é gerado só pela importação da
                    contagem, o único caminho autorizado a baixar acima do saldo. */}
                {SELECTABLE_STOCK_WRITE_OFF_REASONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={reason === option ? "default" : "outline"}
                    className="h-11 cursor-pointer font-semibold"
                    onClick={() => setReason(option)}
                  >
                    {STOCK_WRITE_OFF_REASON_LABEL[option]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="writeOffSearch"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Produto
              </Label>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void search.search(search.query);
                }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="writeOffSearch"
                  value={search.query}
                  onChange={(event) => search.setQuery(event.target.value)}
                  placeholder="Código de barras ou nome do produto..."
                  className="h-11 pl-10"
                  autoComplete="off"
                />
                {search.isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                )}
              </form>

              {search.results.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/50 p-1">
                  {search.results.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => pickProduct(product)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{product.name}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {product.barcode}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        Estoque: {product.stock}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <WriteOffItemsList
              items={items}
              shortages={shortages}
              onChangeQuantity={changeQuantity}
              onRemove={removeItem}
            />

            <div className="space-y-2">
              <Label
                htmlFor="writeOffNotes"
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <FileText className="h-4 w-4 text-primary" /> Observação (opcional)
              </Label>
              <textarea
                id="writeOffNotes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="O que aconteceu com a mercadoria..."
                className="min-h-[70px] w-full resize-none rounded-lg border border-input bg-background/50 p-3 text-sm outline-none transition-colors focus:border-primary focus-visible:ring-primary/50"
              />
            </div>

            {!online && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                Sem conexão: a baixa fica na fila local, já descontada do estoque local, e sobe quando o
                servidor voltar.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-border/50 bg-muted/10 p-4">
          <Button variant="ghost" className="cursor-pointer" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="cursor-pointer gap-2 font-bold"
            onClick={() => void confirm()}
            disabled={saving || items.length === 0 || shortages.length > 0}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageMinus className="h-4 w-4" />}
            Confirmar Baixa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
