import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, Loader2, Pencil, Search, X } from "lucide-react";
import { buildPublicImageUrl, type ProductPdvSearchDto } from "@workspace/api-client-react";
import { Button, Input, ScrollArea } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { adminBaseUrl, adminProductEditUrl, openInNewTab } from "@/lib/admin-links";
import type { ProductSearchState } from "../hooks/use-product-search";

type PdvSearchPanelProps = {
  search: ProductSearchState;
  /** Campo de busca — o balcão devolve o cursor para cá o tempo todo. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** A API está respondendo. Muda o que a busca vazia explica ao operador. */
  online: boolean;
  /** Produto escolhido na lista de resultados. */
  onPickProduct: (product: ProductPdvSearchDto) => void;
};

/**
 * Coluna esquerda do PDV: campo de busca e resultados.
 *
 * Produto zerado aparece na lista — no fim dela, apagado e sem clique. Escondê-lo
 * faria o operador achar que o cadastro sumiu e procurar de novo; deixá-lo no
 * meio empurrava para fora da tela o item vendável. Mostrar por último e com
 * "sem estoque" responde a pergunta de uma vez. O que fica apagado é o CONTEÚDO
 * da linha, não a linha inteira: o lápis precisa continuar clicável ali, porque
 * "sem estoque" é justamente um dos cadastros que alguém vai querer corrigir.
 *
 * A miniatura vem do próprio resultado da busca (`imageUrl`), sem requisição
 * extra. Offline ela não existe — o snapshot da base local não guarda foto — e a
 * linha cai no ícone de imagem ausente, igual a um produto sem foto cadastrada.
 *
 * Busca sem resultado também fica **aqui**, no lugar do primeiro item, e não num
 * toast: o operador está olhando para a lista, não para o canto da tela.
 */
export function PdvSearchPanel({ search, inputRef, online, onPickProduct }: PdvSearchPanelProps) {
  // O lápis some quando não há como saber onde o admin está: abrir outra aba do
  // próprio PDV parece que o painel quebrou. Ver `lib/admin-links`.
  const adminDisponivel = adminBaseUrl() !== null;

  return (
    <div className="flex-1 flex flex-col relative border-r border-border/50 bg-background/50">
      <div className="p-6 border-b border-border/50 bg-card z-20">
        {/* O formulário continua existindo sem botão de buscar: a digitação já
            dispara sozinha a partir de 3 caracteres, mas o Enter é a única saída
            para um termo mais curto que isso ("oi", "kg"). Um botão que só
            repete o que o debounce acabou de fazer ocupava um terço do campo. */}
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
            // Esc limpa igual ao "x". O balcão trabalha sem tirar a mão do
            // teclado: sem isso, recomeçar a busca é apagar tecla a tecla ou
            // largar o leitor para pegar o mouse.
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              search.clear();
            }}
            placeholder="Código de barras ou nome do produto..."
            className={`h-14 text-lg font-medium bg-background border-primary/20 focus-visible:ring-primary shadow-inner pl-12 ${
              search.query ? "pr-20" : ""
            }`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {search.isSearching && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
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
          </div>
        </form>
      </div>

      {/* `data-calculator-anchor`: é ESTE retângulo — o espaço do "Caixa Livre" —
          que a calculadora flutuante mede para nascer no canto superior direito
          dele. Um atributo, e não uma posição fixa no código da calculadora,
          porque a área desce quando aparece a faixa de offline ou a de ambiente
          de desenvolvimento, e encolhe junto com o controle de tamanho da fonte. */}
      <div data-calculator-anchor className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {search.results.length > 0 || search.notFound ? (
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
              {/* O `-mx-3` + `px-3` alarga a área de rolagem para fora e devolve
                  as linhas para a posição original. Sem essa folga de 12px, a
                  linha que cresce 1% no hover encosta na borda do viewport e é
                  CORTADA nos dois lados — some um pedaço do preço, justo no item
                  que o operador está mirando. A alternativa seria tirar o
                  `scale`, mas é ele que diz qual linha o clique vai pegar.

                  12px, e não 8px: a folga precisa cobrir METADE do crescimento,
                  e 1% de uma coluna de 2000px já são 10px. */}
              <ScrollArea className="flex-1 -mx-3">
                <div className="grid grid-cols-1 gap-2 px-3">
                  {search.notFound && (
                    <div className="p-6 rounded-xl border border-dashed border-border/60 bg-card/50 text-center">
                      <p className="font-bold uppercase tracking-wider text-muted-foreground">
                        Nenhum produto encontrado
                      </p>
                      {/* Offline "não encontrei" quase sempre quer dizer "a base
                          local está velha", e essa diferença decide se o
                          operador procura outro termo ou vai atrás do
                          catálogo. */}
                      {!online && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          A busca rodou na base local. Confira no badge OFFLINE se o catálogo foi baixado.
                        </p>
                      )}
                    </div>
                  )}
                  {search.results.map((product) => {
                    const outOfStock = product.stock <= 0;
                    return (
                      <motion.div
                        key={product.id}
                        whileHover={outOfStock ? undefined : { scale: 1.01 }}
                        className={`flex items-center justify-between gap-3 p-4 rounded-xl border bg-card group transition-all ${
                          outOfStock
                            ? "border-border/30 cursor-not-allowed"
                            : "border-border/50 cursor-pointer hover:border-primary/40"
                        }`}
                        onClick={() => {
                          if (outOfStock) return;
                          onPickProduct(product);
                          search.clear();
                        }}
                      >
                        {/* O esmaecido do produto zerado mora AQUI, e não na
                            linha: `opacity` cria contexto de composição e um
                            filho não consegue ser mais opaco que o pai — com ele
                            na linha, o lápis herdava os 50% e parecia
                            desabilitado justamente quando é mais necessário. */}
                        {/* `items-start` porque o nome agora quebra em várias
                            linhas: centralizado, a miniatura descia junto e o
                            card ficava desalinhado com o preço da direita. */}
                        <div className={`flex items-start gap-4 min-w-0 ${outOfStock ? "opacity-50" : ""}`}>
                          {product.imageUrl ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={buildPublicImageUrl(product.imageUrl)}
                              alt={product.name}
                              className="w-12 h-12 shrink-0 rounded-lg border border-border/50 object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="min-w-0">
                            {/*
                              Nome INTEIRO, em quantas linhas precisar. Truncar
                              com reticências escondia justamente o fim do nome,
                              que é onde mora a diferença entre duas variações do
                              mesmo produto ("...CONICA" × "...RETA"): o operador
                              via dois resultados idênticos e tinha que adivinhar.
                              Card mais alto é preço barato por isso.
                            */}
                            <h4 className="font-bold text-lg leading-tight break-words">{product.name}</h4>
                            <p className="text-xs text-muted-foreground font-mono">
                              {product.barcode} · Estoque: {product.stock}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className={`text-right ${outOfStock ? "opacity-50" : ""}`}>
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
              {/* Um degrau menor que o original: na escala de fonte maior ele
                  encostava nas bordas do painel. */}
              <h2 className="text-6xl font-display font-bold text-foreground/20 uppercase tracking-widest">
                Caixa Livre
              </h2>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
