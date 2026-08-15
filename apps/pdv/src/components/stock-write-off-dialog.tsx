import { useCallback, useEffect, useRef, useState } from "react";
import {
  SELECTABLE_STOCK_WRITE_OFF_REASONS,
  STOCK_WRITE_OFF_REASON,
  STOCK_WRITE_OFF_REASON_LABEL,
  type ProductPdvSearchDto,
} from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import { AlertTriangle, FileText, Loader2, Minus, PackageMinus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { ScrollArea } from "@workspace/ui";
import { useToast } from "@/hooks/use-toast";
import { useOfflinePdv } from "@/hooks/use-offline-pdv";
import { searchProducts } from "@/lib/product-search";
import {
  addDraftItem,
  findDraftShortages,
  removeDraftItem,
  setDraftQuantity,
  toWriteOffItems,
  totalDraftQuantity,
  type WriteOffDraftItem,
} from "@/lib/write-off-draft";
import { LocalStockError, newClientReference } from "@/services/sales.service";
import { registerWriteOff } from "@/services/stock-write-off.service";

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
 * A busca de produtos é a mesma do balcão (`lib/product-search.ts`), o que
 * garante o mesmo fallback para a base local quando a internet cai — e é
 * justamente aí que a baixa mais acontece, com o operador registrando o que
 * quebrou enquanto espera a conexão voltar.
 */
export function StockWriteOffDialog({ open, onOpenChange, onRegistered }: StockWriteOffDialogProps) {
  const { toast } = useToast();
  // Sem sessão: a baixa não pertence a turno nenhum, e passar uma sessão aqui só
  // acionaria o download de snapshot que é responsabilidade da tela principal.
  const { online, hasLocalDatabase, refreshCounts } = useOfflinePdv(null);

  const [reason, setReason] = useState<number>(STOCK_WRITE_OFF_REASON.Consumption);
  const [items, setItems] = useState<WriteOffDraftItem[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductPdvSearchDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  /**
   * Chave de idempotência da baixa em andamento, gerada na primeira tentativa e
   * reutilizada nas retentativas do mesmo rascunho.
   *
   * Igual à venda: se o POST chegou ao servidor mas a resposta voltou como erro
   * (504 do proxy), o clique seguinte em "Confirmar" reenvia a MESMA chave e o
   * servidor devolve a baixa já gravada em vez de baixar o estoque duas vezes.
   * Descartada quando a baixa confirma ou o rascunho é abandonado.
   */
  const writeOffReferenceRef = useRef<string | null>(null);

  const shortages = findDraftShortages(items);

  /**
   * Abre e fecha o diálogo, descartando o rascunho na saída.
   *
   * Um diálogo fechado não guarda rascunho: reabrir com a lista da vez anterior
   * faria o operador baixar duas vezes o mesmo produto sem perceber. A limpeza
   * mora aqui — e não num efeito — porque este é o único caminho de fechamento,
   * inclusive Esc e clique fora.
   */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setReason(STOCK_WRITE_OFF_REASON.Consumption);
        setItems([]);
        setNotes("");
        setSearchQuery("");
        setSearchResults([]);
        // O rascunho morreu; a chave morre com ele.
        writeOffReferenceRef.current = null;
      }

      onOpenChange(next);
    },
    [onOpenChange],
  );

  /** Acrescenta o produto à lista e limpa a busca. */
  const pickProduct = useCallback((product: ProductPdvSearchDto) => {
    setItems((current) => addDraftItem(current, product));
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const executeSearch = useCallback(
    async (query: string) => {
      const term = query.trim();
      if (!term) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const found = await searchProducts(term, { online });

        // Leitura de código de barras: match exato e único entra direto, como no
        // balcão. O operador bipa o produto quebrado sem tirar a mão do leitor.
        const exact = found.filter((product) => product.barcode === term);
        if (exact.length === 1) {
          pickProduct(exact[0]);
          return;
        }

        setSearchResults(found);
      } catch (error) {
        toast({
          title: "Erro na busca",
          description: describeApiError(error),
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    },
    [online, pickProduct, toast],
  );

  useEffect(() => {
    if (!open) return;
    if (searchQuery.trim().length < 3) return;

    const timer = setTimeout(() => void executeSearch(searchQuery), 600);
    return () => clearTimeout(timer);
  }, [open, searchQuery, executeSearch]);

  /**
   * Grava a baixa: no servidor com conexão, na fila local sem ela.
   *
   * A conferência de estoque acontece antes de qualquer escrita, com o saldo que
   * a busca trouxe. O backend recusa baixa acima do saldo, e offline essa recusa
   * só apareceria na sincronização — horas depois, quando ninguém mais lembra o
   * que foi realmente jogado fora.
   */
  const handleConfirm = async () => {
    if (items.length === 0) {
      toast({ title: "Nenhum produto na lista", variant: "destructive" });
      return;
    }

    if (shortages.length > 0) {
      toast({
        title: "Quantidade acima do estoque",
        description: shortages
          .map((item) => `${item.name}: pedido ${item.quantity}, disponível ${item.availableStock}`)
          .join(" · "),
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    if (!online && !hasLocalDatabase) {
      toast({
        title: "Base local indisponível",
        description:
          "O PDV nunca baixou a base local neste navegador e não pode registrar a baixa offline. Aguarde a conexão voltar.",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    setSaving(true);
    try {
      // A chave é do rascunho, não da tentativa: reutilizada num reenvio após
      // erro de gateway para o servidor reconhecer a baixa já gravada.
      writeOffReferenceRef.current ??= newClientReference();

      const saved = await registerWriteOff(
        { reason, items: toWriteOffItems(items), notes },
        { offline: !online, clientReference: writeOffReferenceRef.current },
      );

      await refreshCounts();
      // Uma baixa que ficou na fila não mudou nada no servidor; recarregar dali
      // só geraria requisição condenada a falhar.
      if (!saved.offline) await onRegistered?.();

      toast({
        title: saved.offline ? "Baixa registrada offline" : "Baixa registrada",
        description: saved.offline
          ? `${saved.totalQuantity} unidade(s) baixadas por ${STOCK_WRITE_OFF_REASON_LABEL[reason]}. Sobe para o servidor quando a conexão voltar.`
          : `${saved.totalQuantity} unidade(s) baixadas por ${STOCK_WRITE_OFF_REASON_LABEL[reason]}.`,
        duration: saved.offline ? 6000 : 3000,
        className: saved.offline
          ? "bg-amber-500 text-amber-950 border-none"
          : "bg-emerald-500 text-white border-none",
      });

      handleOpenChange(false);
    } catch (error) {
      // A conferência da base local recusou. A mesma regra vale no servidor, e
      // deixar passar só adiaria o "não" para a sincronização.
      if (error instanceof LocalStockError) {
        toast({
          title: "Estoque insuficiente na base local",
          description: error.shortages
            .map((item) => `${item.productName}: pedido ${item.requested}, disponível ${item.available}`)
            .join(" · "),
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      toast({
        title: "Não foi possível registrar a baixa",
        description:
          describeApiError(error),
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setSaving(false);
    }
  };

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
        <ScrollArea className="min-h-0 flex-1 p-6">
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
                  void executeSearch(searchQuery);
                }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="writeOffSearch"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Código de barras ou nome do produto..."
                  className="h-11 pl-10"
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                )}
              </form>

              {searchResults.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/50 p-1">
                  {searchResults.map((product) => (
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Itens da baixa
                </Label>
                {items.length > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {totalDraftQuantity(items)} unidade(s)
                  </span>
                )}
              </div>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 py-8 text-center text-xs italic text-muted-foreground">
                  Busque o produto acima para incluí-lo na baixa.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const short = item.quantity > item.availableStock;

                    return (
                      <div
                        key={item.productId}
                        className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                          short ? "border-destructive/40 bg-destructive/5" : "border-border/40 bg-background/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold leading-tight">{item.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {item.barcode} · Estoque: {item.availableStock}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-muted/30 p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 cursor-pointer"
                              onClick={() =>
                                setItems((current) =>
                                  setDraftQuantity(current, item.productId, item.quantity - 1),
                                )
                              }
                            >
                              <Minus className="h-2 w-2" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              className="h-7 w-14 px-1 text-center font-mono text-xs font-bold"
                              value={item.quantity}
                              onChange={(event) =>
                                setItems((current) =>
                                  setDraftQuantity(current, item.productId, Number(event.target.value)),
                                )
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 cursor-pointer"
                              onClick={() =>
                                setItems((current) =>
                                  setDraftQuantity(current, item.productId, item.quantity + 1),
                                )
                              }
                            >
                              <Plus className="h-2 w-2" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                            title="Tirar o produto da baixa"
                            onClick={() =>
                              setItems((current) => removeDraftItem(current, item.productId))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {shortages.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[11px] font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {shortages.map((item) => item.name).join(", ")} — a quantidade passa do estoque
                    disponível. O servidor recusaria a baixa.
                  </span>
                </div>
              )}
            </div>

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
                Sem conexão: a baixa fica na fila local, já descontada do estoque local, e sobe
                quando o servidor voltar.
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="flex shrink-0 justify-end gap-3 border-t border-border/50 bg-muted/10 p-4">
          <Button variant="ghost" className="cursor-pointer" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="cursor-pointer gap-2 font-bold"
            onClick={handleConfirm}
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


