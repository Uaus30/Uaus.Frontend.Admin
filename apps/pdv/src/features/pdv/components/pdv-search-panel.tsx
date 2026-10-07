import { useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Pencil, ScanBarcode, Search, X } from "lucide-react";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import {
  BarcodeScannerDialog,
  Button,
  Input,
  ScrollArea,
  canUseCamera,
  type ScanFeedback,
} from "@workspace/ui";
import { Hint } from "@/components/hint";
import { adminBaseUrl, adminProductEditUrl, openInNewTab } from "@/lib/admin-links";
import type { ProductSearchState } from "../hooks/use-product-search";
import { useSearchResultPrice } from "../hooks/use-search-result-price";
import { PdvCartItemImage } from "./pdv-cart-item-image";
import { PdvSearchResultPrice } from "./pdv-search-result-price";

/** Moldura da miniatura na lista: um quadrado de 48px, como sempre foi. */
const RESULT_FRAME_CLASS =
  "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50";

type PdvSearchPanelProps = {
  search: ProductSearchState;
  /** Campo de busca — o balcão devolve o cursor para cá o tempo todo. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** A API está respondendo. Muda o que a busca vazia explica ao operador. */
  online: boolean;
  /** Produto escolhido na lista de resultados. */
  onPickProduct: (product: ProductPdvSearchDto) => void;
  /**
   * Celular (deitado ou em pé): menos respiro, campo e linhas menores, sem o
   * título da lista e sem o lápis do admin. Ver "No celular" abaixo.
   */
  compact?: boolean;
  /**
   * Recebe cada código lido pela câmera e responde o aviso. Só no celular
   * (`compact`), onde não há leitor de mão — ver `useCameraScan`.
   */
  onScanCode?: (code: string) => Promise<ScanFeedback> | ScanFeedback;
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
 * Passar o mouse (ou tocar) na miniatura AMPLIA a foto, com o mesmo componente
 * do carrinho: 48px bastam para reconhecer o produto, não para escolher entre
 * duas variações pela cor da tampa. O clique na foto NÃO adiciona ao carrinho —
 * o `stopPropagation` do embrulho segura o clique da linha, senão tocar para
 * ampliar venderia o item.
 *
 * Busca sem resultado também fica **aqui**, no lugar do primeiro item, e não num
 * toast: o operador está olhando para a lista, não para o canto da tela.
 *
 * **O preço da linha já vem com a promoção** (05/10/2026): "De R$ 12,90 / por R$
 * 9,90" com o selo do tipo, ou o selo do combo embaixo do preço normal — ver
 * `PdvSearchResultPrice`. Antes o preço promocional só aparecia depois de o item
 * entrar no carrinho, e o operador respondia ao cliente com o preço de tabela.
 *
 * ## No celular (07/10/2026)
 *
 * Deitado, a altura é ~390px e o balcão gastava 104px só com o campo de busca.
 * No `compact` o campo tem 44px (com letra de 16px, senão o iPhone amplia a
 * tela ao tocar), as linhas da lista encolhem, o título "Resultados da Busca"
 * sai (a lista se explica sozinha) e o lápis do admin também: no app instalado
 * ele abriria o navegador por cima da venda.
 *
 * Ao lado do campo fica a **câmera**, que faz o papel do leitor de mão (só com
 * câmera utilizável: HTTPS e permissão — `canUseCamera`). E escolher um produto
 * da lista **fecha o teclado** em vez de devolver o cursor: no balcão o cursor
 * volta para o próximo bipe; no celular ele reabriria o teclado por cima do
 * produto que acabou de entrar.
 */
export function PdvSearchPanel({
  search,
  inputRef,
  online,
  onPickProduct,
  compact = false,
  onScanCode,
}: PdvSearchPanelProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const cameraAvailable = compact && onScanCode !== undefined && canUseCamera();
  // O lápis some quando não há como saber onde o admin está: abrir outra aba do
  // próprio PDV parece que o painel quebrou. Ver `lib/admin-links`. No celular
  // ele some sempre (ver acima).
  const adminDisponivel = !compact && adminBaseUrl() !== null;
  // O preço da lista é o que o carrinho vai cobrar: promoção aplicada, com a
  // lista e o relógio da venda em curso (ver `useSearchResultPrice`).
  const priceOf = useSearchResultPrice();

  return (
    <div className="flex-1 min-w-0 flex flex-col relative border-r border-border/50 bg-background/50">
      <div className={`${compact ? "p-2" : "p-6"} border-b border-border/50 bg-card z-20`}>
        {/* O formulário continua existindo sem botão de buscar: a digitação já
            dispara sozinha a partir de 3 caracteres, mas o Enter é a única saída
            para um termo mais curto que isso ("oi", "kg"). Um botão que só
            repete o que o debounce acabou de fazer ocupava um terço do campo. */}
        <div className="flex items-center gap-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void search.search(search.query);
            }}
            className="relative min-w-0 flex-1"
          >
            <Search
              className={`absolute ${compact ? "left-3" : "left-4"} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground`}
            />
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
              placeholder={compact ? "Código ou nome do produto" : "Código de barras ou nome do produto..."}
              enterKeyHint="search"
              className={`${compact ? "h-11 text-base pl-10" : "h-14 text-lg pl-12"} font-medium bg-background border-primary/20 focus-visible:ring-primary shadow-inner ${
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
                <Hint label="Limpar busca (Esc)" side="bottom">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      search.clear();
                      inputRef.current?.focus();
                    }}
                    aria-label="Limpar busca"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </Hint>
              )}
            </div>
          </form>

          {cameraAvailable && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setScannerOpen(true)}
              aria-label="Ler o código de barras pela câmera"
              className="h-11 w-11 shrink-0 border-primary/30 text-primary"
            >
              <ScanBarcode className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {cameraAvailable && onScanCode && (
        <BarcodeScannerDialog
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          title="Ler pela câmera"
          description="Aponte para o código de barras. Cada produto lido entra no carrinho."
          onDetected={onScanCode}
        />
      )}

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
              className={`absolute inset-0 flex flex-col ${compact ? "p-2" : "p-6"}`}
            >
              {!compact && (
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                  Resultados da Busca
                </h3>
              )}
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
                        data-testid="search-result"
                        whileHover={outOfStock ? undefined : { scale: 1.01 }}
                        className={`flex items-center justify-between gap-3 ${compact ? "p-2.5" : "p-4"} rounded-xl border bg-card group transition-all ${
                          outOfStock
                            ? "border-border/30 cursor-not-allowed"
                            : "border-border/50 cursor-pointer hover:border-primary/40"
                        }`}
                        // O card é uma div: o `mousedown` nela tira o cursor do
                        // campo de busca antes de o clique chegar. Cancelar o
                        // padrão mantém o cursor onde estava, sem o campo piscar
                        // (e sem o teclado virtual do touchscreen fechar e abrir).
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          if (outOfStock) return;
                          onPickProduct(product);
                          search.clear();
                          // Cinto e suspensório do `onMouseDown` acima: o
                          // próximo bipe do leitor digita no campo focado, e o
                          // operador tinha que clicar no campo a cada produto
                          // escolhido pela lista. O retorno mora AQUI, e não a
                          // cada mudança do carrinho, porque refocar em toda
                          // mudança roubaria o cursor de quem está editando a
                          // quantidade ou o preço de uma linha (ver
                          // `usePdvCounter`). O caminho do leitor nunca perde o
                          // cursor: ele entra pelo Enter do próprio campo.
                          // No celular é o contrário: fecha o teclado (ver acima).
                          if (compact) inputRef.current?.blur();
                          else inputRef.current?.focus();
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
                        <div
                          className={`flex items-start ${compact ? "gap-2.5" : "gap-4"} min-w-0 ${outOfStock ? "opacity-50" : ""}`}
                        >
                          {/* O embrulho segura o clique da ampliação para ele não
                              subir até o onClick da linha e adicionar o produto. */}
                          <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                            <PdvCartItemImage
                              name={product.name}
                              barcode={product.barcode}
                              imageUrl={product.imageUrl}
                              side="right"
                              frameClassName={RESULT_FRAME_CLASS}
                            />
                          </div>
                          <div className="min-w-0">
                            {/*
                              Nome INTEIRO, em quantas linhas precisar. Truncar
                              com reticências escondia justamente o fim do nome,
                              que é onde mora a diferença entre duas variações do
                              mesmo produto ("...CONICA" × "...RETA"): o operador
                              via dois resultados idênticos e tinha que adivinhar.
                              Card mais alto é preço barato por isso.
                            */}
                            <h4
                              className={`font-bold ${compact ? "text-sm" : "text-lg"} leading-tight break-words`}
                            >
                              {product.name}
                            </h4>
                            <p className="text-xs text-muted-foreground font-mono">
                              {product.barcode} · Estoque: {product.stock}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className={`text-right ${outOfStock ? "opacity-50" : ""}`}>
                            <PdvSearchResultPrice shelf={priceOf(product)} />
                            {/* No celular, só o "Sem estoque": "toque para adicionar"
                                em toda linha é o que o operador já sabe. */}
                            {(!compact || outOfStock) && (
                              <p className="text-[10px] text-muted-foreground uppercase font-bold group-hover:text-primary transition-colors">
                                {outOfStock ? "Sem estoque" : "Clique para adicionar"}
                              </p>
                            )}
                          </div>
                          {/* Atalho para corrigir o cadastro sem sair do caixa —
                              preço errado e estoque furado aparecem justamente
                              aqui, na hora de vender. O stopPropagation impede
                              que o clique também adicione o item ao carrinho. */}
                          <Hint label="Editar no painel administrativo (abre em nova aba)" side="left">
                            <button
                              type="button"
                              hidden={!adminDisponivel}
                              onClick={(event) => {
                                event.stopPropagation();
                                openInNewTab(adminProductEditUrl(product));
                              }}
                              aria-label={`Editar ${product.name} no painel administrativo`}
                              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </Hint>
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
              className={`absolute inset-0 flex flex-col items-center justify-center text-center ${compact ? "p-4" : "p-12"}`}
            >
              {/* Um degrau menor que o original: na escala de fonte maior ele
                  encostava nas bordas do painel. */}
              <h2
                className={`${compact ? "text-3xl" : "text-6xl"} font-display font-bold text-foreground/20 uppercase tracking-widest`}
              >
                Caixa Livre
              </h2>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
