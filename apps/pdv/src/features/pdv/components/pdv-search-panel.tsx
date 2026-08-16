import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Pencil, Search, X } from "lucide-react";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import { Button, Input, ScrollArea } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { adminBaseUrl, adminProductEditUrl, openInNewTab } from "@/lib/admin-links";
import type { ProductSearchState } from "../hooks/use-product-search";

type PdvSearchPanelProps = {
  search: ProductSearchState;
  /** Campo de busca — o balcão devolve o cursor para cá o tempo todo. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Produto escolhido na lista de resultados. */
  onPickProduct: (product: ProductPdvSearchDto) => void;
};

/**
 * Coluna esquerda do PDV: campo de busca e resultados.
 *
 * Produto zerado aparece na lista, mas apagado e sem clique: escondê-lo faria o
 * operador achar que o cadastro sumiu e procurar de novo. Mostrar com "sem
 * estoque" responde a pergunta de uma vez.
 */
export function PdvSearchPanel({ search, inputRef, onPickProduct }: PdvSearchPanelProps) {
  // O lápis some quando não há como saber onde o admin está: abrir outra aba do
  // próprio PDV parece que o painel quebrou. Ver `lib/admin-links`.
  const adminDisponivel = adminBaseUrl() !== null;

  return (
    <div className="flex-1 flex flex-col relative border-r border-border/50 bg-background/50">
      <div className="p-6 border-b border-border/50 bg-card z-20">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search.search(search.query);
          }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            placeholder="Código de barras ou nome do produto..."
            className={`h-14 text-lg font-medium bg-background border-primary/20 focus-visible:ring-primary shadow-inner pl-12 ${
              search.query ? "pr-32" : "pr-24"
            }`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Some com o campo vazio: um "x" que não limpa nada só ocupa espaço
                e faz o operador conferir se clicou. O foco volta para o campo
                porque o balcão trabalha sem tirar a mão do teclado — perder o
                cursor aqui obriga a clicar antes de bipar o próximo produto. */}
            {search.query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  search.clear();
                  inputRef.current?.focus();
                }}
                title="Limpar busca (Esc)"
                aria-label="Limpar busca"
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              className="bg-primary text-primary-foreground font-bold hover:scale-105 active:scale-95 transition-transform"
              disabled={search.isSearching}
            >
              {search.isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "BUSCAR"}
            </Button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {search.results.length > 0 ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col p-6"
            >
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Resultados da Busca
              </h3>
              <ScrollArea className="flex-1">
                <div className="grid grid-cols-1 gap-2">
                  {search.results.map((product) => {
                    const outOfStock = product.stock <= 0;
                    return (
                      <motion.div
                        key={product.id}
                        whileHover={outOfStock ? undefined : { scale: 1.01 }}
                        className={`flex items-center justify-between p-4 rounded-xl border bg-card group transition-all ${
                          outOfStock
                            ? "border-border/30 opacity-50 cursor-not-allowed"
                            : "border-border/50 cursor-pointer hover:border-primary/40"
                        }`}
                        onClick={() => {
                          if (outOfStock) return;
                          onPickProduct(product);
                          search.clear();
                        }}
                      >
                        <div>
                          <h4 className="font-bold text-lg">{product.name}</h4>
                          <p className="text-xs text-muted-foreground font-mono">
                            {product.barcode} · Estoque: {product.stock}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xl font-mono font-bold text-primary">
                              {formatCurrency(product.price)}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold group-hover:text-primary transition-colors">
                              {outOfStock ? "Sem estoque" : "Clique para adicionar"}
                            </p>
                          </div>
                          {/* Atalho para corrigir o cadastro sem sair do caixa —
                              preço errado e estoque furado aparecem justamente
                              aqui, na hora de vender. O stopPropagation impede
                              que o clique também adicione o item ao carrinho. */}
                          <button
                            type="button"
                            hidden={!adminDisponivel}
                            onClick={(event) => {
                              event.stopPropagation();
                              openInNewTab(adminProductEditUrl(product));
                            }}
                            title="Editar no painel administrativo (abre em nova aba)"
                            aria-label={`Editar ${product.name} no painel administrativo`}
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-12"
            >
              <h2 className="text-7xl font-display font-bold text-foreground/20 uppercase tracking-widest">
                Caixa Livre
              </h2>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
