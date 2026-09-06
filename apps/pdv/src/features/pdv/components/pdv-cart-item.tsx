import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, Input, useToast } from "@workspace/ui";
import { computeDiscount, formatCurrency, parseAmount, round2 } from "@workspace/core";
import { itemListPrice, usePdvStore } from "@/stores/use-pdv-store";
import { scrollIntoViewVertically } from "@/lib/scroll-into-view";
import { PdvCartItemImage } from "./pdv-cart-item-image";
import { PdvCartItemSurchargeChip, PdvSurchargeReasonDialog } from "./pdv-cart-item-surcharge";
import type { PdvItem } from "../types";

type PdvCartItemProps = {
  item: PdvItem;
};

/**
 * Uma linha do carrinho: quantidade, preço unitário editável e o total do item.
 *
 * ## O campo de preço é a porta ÚNICA da negociação
 *
 * O operador digita o valor combinado com o cliente, e a diferença para o preço
 * de tabela decide o que foi:
 *
 * - **abaixo da tabela** → desconto do item, aplicado direto;
 * - **acima da tabela** → acréscimo, que abre o diálogo pedindo o motivo;
 * - **igual à tabela** → zera os dois.
 *
 * No máximo UM dos dois vive na linha, e é isso que mantém o campo legível: ele
 * sempre mostra o que aquela unidade vai custar, e a diferença para a tabela tem
 * um nome só. Até 06/09/2026 cobrar a mais tinha botão próprio; ele era uma
 * segunda forma de dizer a mesma coisa e obrigava o operador a somar de cabeça o
 * que o cliente ia pagar.
 *
 * O que protege contra a digitação errada deixou de ser a recusa e passou a ser
 * o diálogo: R$ 300,00 no lugar de R$ 30,00 chega como "Acréscimo de R$ 275,00"
 * escrito por extenso, e sair de lá exige escrever um motivo. Antes o mesmo erro
 * só produzia um toast vermelho que não dizia quanto tinha sido digitado.
 *
 * ## O realce do item recém-bipado
 *
 * Substituiu o toast de "item adicionado", em 01/09/2026. O aviso aparecia no
 * canto oposto ao carrinho e durava mais que o bipe seguinte: numa sequência
 * rápida o operador via um aviso empilhado sobre o outro e não sabia qual linha
 * tinha acabado de entrar. O contorno pulsa UMA vez na própria linha — a
 * confirmação acontece onde o item foi parar.
 */
export function PdvCartItem({ item }: PdvCartItemProps) {
  const { toast } = useToast();
  const removeItem = usePdvStore((state) => state.removeItem);
  const updateQuantity = usePdvStore((state) => state.updateQuantity);
  const applyItemDiscount = usePdvStore((state) => state.applyItemDiscount);
  const applyItemSurcharge = usePdvStore((state) => state.applyItemSurcharge);

  /**
   * Acréscimo calculado a partir do preço digitado, à espera do motivo. `null`
   * quando não há diálogo aberto.
   */
  const [pendingSurcharge, setPendingSurcharge] = useState<number | null>(null);

  /**
   * Contador que remonta o campo de preço, que é NÃO controlado.
   *
   * Sem ele, cancelar o diálogo deixaria na tela o número digitado — e o
   * operador acreditaria que ele valeu. Desconto e acréscimo já remontam o campo
   * pela `key`; este cobre o caso em que nada muda no item.
   */
  const [priceResetSeq, setPriceResetSeq] = useState(0);

  /** O que esta unidade custa hoje: tabela, menos o desconto, mais o acréscimo. */
  const effectiveUnitPrice = round2(itemListPrice(item) - item.discount);

  // Zero quando o bipe foi em outra linha. O número (e não um booleano) é o que
  // reinicia a animação quando o MESMO produto é bipado de novo: ele muda, a
  // `key` do contorno muda junto e o pulso recomeça do zero.
  const pulseSeq = usePdvStore((state) => (state.lastAddedItemId === item.id ? state.lastAddedSeq : 0));

  const rootRef = useRef<HTMLDivElement>(null);

  // A linha que recebeu o bipe vem para dentro da área visível. O item novo
  // entra no FIM da lista e, com o carrinho mais alto que a coluna, o pulso
  // acontecia fora da tela: o operador bipava, não via nada mudar e bipava de
  // novo. Rola o mínimo, e SÓ na vertical — o `scrollIntoView` nativo alinha
  // também na horizontal, e foi ele que puxou o carrinho inteiro 20px para a
  // esquerda a cada bipe (ver `lib/scroll-into-view`).
  useEffect(() => {
    if (pulseSeq === 0) return;
    scrollIntoViewVertically(rootRef.current);
  }, [pulseSeq]);

  /** Devolve ao campo o preço que a linha realmente pratica. */
  const restorePriceField = (inputEl?: HTMLInputElement) => {
    if (inputEl) inputEl.value = effectiveUnitPrice.toFixed(2).replace(".", ",");
    setPriceResetSeq((seq) => seq + 1);
  };

  /**
   * Lê o preço digitado e decide o que ele significa: desconto, acréscimo ou
   * preço cheio. A comparação é sempre contra `item.price`, o preço de TABELA —
   * nunca contra o preço em vigor na linha, senão editar duas vezes seguidas
   * empilharia abatimento sobre abatimento.
   *
   * @param inputEl Campo digitado, para devolver o valor anterior quando o
   *   digitado é recusado — deixar o número inválido na tela faria o operador
   *   acreditar que ele valeu.
   */
  const handleUpdateUnitPrice = (valueStr: string, inputEl?: HTMLInputElement) => {
    const val = parseAmount(valueStr);

    if (Number.isNaN(val) || !Number.isFinite(val) || val < 0) {
      toast({
        title: "Valor Inválido",
        description: "Por favor, digite um preço unitário válido.",
        variant: "destructive",
      });
      restorePriceField(inputEl);
      return;
    }

    const digitado = round2(val);

    // Acima da tabela é acréscimo. Nada é aplicado aqui: o diálogo pede o motivo
    // e é ele quem grava — sem motivo o servidor recusaria a venda, e recusar
    // com o cliente no balcão é pior do que perguntar agora.
    if (digitado > item.price) {
      setPendingSurcharge(round2(digitado - item.price));
      return;
    }

    // Daqui para baixo é desconto (ou preço cheio). A conta sai do
    // @workspace/core, o mesmo módulo do diálogo de desconto e do total do
    // carrinho — três caminhos, uma regra só.
    const resultado = computeDiscount({ base: item.price, value: item.price - digitado, type: "value" });

    if ("error" in resultado) {
      toast({
        title: "Valor Inválido",
        description: "Por favor, digite um preço unitário válido.",
        variant: "destructive",
      });
      restorePriceField(inputEl);
      return;
    }

    const discount = resultado.amount;
    applyItemDiscount(item.id, discount);

    // O acréscimo cai junto: o preço digitado ficou na tabela ou abaixo dela, e
    // manter um acréscimo aqui faria a linha cobrar mais do que o operador
    // acabou de combinar com o cliente.
    if ((item.surcharge ?? 0) > 0) applyItemSurcharge(item.id, 0, "");

    toast({
      title: discount > 0 ? "Preço Atualizado" : "Preço Restaurado",
      description:
        discount > 0
          ? `Desconto de ${formatCurrency(discount)} aplicado no item.`
          : "O preço original do item foi restaurado.",
      duration: 2000,
    });
  };

  /** Grava o acréscimo pendente com o motivo escrito no diálogo. */
  const confirmSurcharge = (reason: string) => {
    const amount = pendingSurcharge;
    setPendingSurcharge(null);
    if (amount === null) return;

    applyItemSurcharge(item.id, amount, reason);
    // Desconto e acréscimo não convivem na linha: o preço digitado ficou acima
    // da tabela, então não há abatimento nenhum a preservar.
    if (item.discount > 0) applyItemDiscount(item.id, 0);

    toast({
      title: "Acréscimo aplicado",
      description: `${formatCurrency(amount)} por unidade em ${item.name}.`,
      duration: 2000,
    });
  };

  /** Desiste do acréscimo: a linha e o campo voltam ao que estavam. */
  const cancelSurcharge = () => {
    setPendingSurcharge(null);
    restorePriceField();
  };

  /** Tira o acréscimo da linha pelo X do chip. */
  const removeSurcharge = () => {
    applyItemSurcharge(item.id, 0, "");
    toast({ title: "Acréscimo removido", duration: 2000 });
  };

  return (
    <motion.div
      ref={rootRef}
      // Só esmaece, sem deslizar. A entrada de 20px vinda da direita crescia a
      // área rolável do viewport enquanto durava, e qualquer rolagem naquele
      // instante puxava a lista inteira para o lado — todas as linhas cortadas
      // até a animação terminar. O pulso do contorno já é a confirmação de que
      // o item entrou; o deslize só disputava atenção com ele.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex items-stretch gap-3 p-3 rounded-lg border border-border/40 bg-background/50 group"
    >
      {/* O contorno é uma camada por cima, não a borda da linha: animar a borda
          empurraria o conteúdo meio pixel e a lista inteira tremeria.

          A `key` é o contador do bipe, e é ela que faz o pulso recomeçar quando o
          mesmo produto é lido duas vezes seguidas: chave nova remonta o nó, e
          animação de CSS só reinicia com nó novo.

          O nó fica montado depois de pulsar, em vez de sair por um estado que o
          `onAnimationEnd` desligaria: a classe é transparente em repouso, então
          o que sobra é invisível e não recebe clique — e o componente não
          precisa de `setState` dentro de efeito para nada. */}
      {pulseSeq > 0 && (
        <span
          key={pulseSeq}
          aria-hidden
          data-testid="cart-item-pulse"
          className="pdv-item-pulse pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-emerald-500"
        />
      )}

      {/* Coluna própria, esticada na altura inteira do card (`self-stretch`), e
          não uma miniatura no meio do texto: assim a foto acompanha o card
          quando o nome quebra em duas linhas, e quantidade, preço e total ficam
          SEMPRE à direita dela, na mesma coluna, em todas as linhas do carrinho. */}
      <PdvCartItemImage name={item.name} barcode={item.barcode} imageUrl={item.imageUrl} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="min-w-0 flex-1">
            {/* Nome INTEIRO, quebrando em quantas linhas precisar: é a mesma regra
              da lista de busca. O fim do nome é o que separa duas variações do
              mesmo produto ("...CONICA" × "...RETA"), e truncar escondia
              justamente isso — o operador via duas linhas idênticas no carrinho.

              O código de barras saiu daqui em 01/09/2026 e foi para a legenda da
              foto ampliada: ele ocupava uma faixa em TODA linha do carrinho para
              um dado que só se consulta em caso de dúvida — e a dúvida é
              justamente quando a foto é aberta. */}
            <h4 className="font-bold text-sm leading-tight break-words">{item.name}</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => removeItem(item.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground">Quantidade:</span>
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1 border border-border/30">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
              >
                <Minus className="w-2 h-2" />
              </Button>
              <span className="font-mono text-xs font-bold w-4 text-center">{item.quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  // O saldo é o do momento em que o item entrou no carrinho: vender
                  // acima dele quebraria a venda offline na conferência local.
                  if (item.quantity + 1 > item.availableStock) {
                    toast({
                      title: "Estoque insuficiente",
                      description: `Só há ${item.availableStock} unidade(s) de ${item.name}.`,
                      variant: "destructive",
                    });
                    return;
                  }
                  updateQuantity(item.id, item.quantity + 1);
                }}
              >
                <Plus className="w-2 h-2" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground">Valor Unitário:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-semibold">R$</span>
              <Input
                type="text"
                className="w-16 h-7 text-xs font-mono font-bold px-1.5 py-0 text-center bg-background border-border focus-visible:ring-primary shadow-sm"
                // A `key` força o campo a remontar quando o valor muda por fora
                // (diálogo de desconto, acréscimo confirmado, cancelamento), já
                // que ele é não controlado.
                key={`${item.id}-${item.discount}-${item.surcharge ?? 0}-${priceResetSeq}`}
                defaultValue={effectiveUnitPrice.toFixed(2).replace(".", ",")}
                onBlur={(e) => handleUpdateUnitPrice(e.target.value, e.target)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUpdateUnitPrice((e.target as HTMLInputElement).value, e.target as HTMLInputElement);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
          </div>

          <div className="text-right flex flex-col justify-end items-end h-[52px]">
            <div className="flex flex-col">
              {/* O riscado é o preço ANTES do desconto, e ele inclui o acréscimo:
                  o desconto foi negociado sobre o que a linha custava de fato.
                  Riscar só o preço do produto mostraria um abatimento diferente
                  do que a conta da direita fez. */}
              {item.discount > 0 && (
                <span className="text-[10px] text-emerald-500 line-through leading-none mb-0.5">
                  {formatCurrency(itemListPrice(item) * item.quantity)}
                </span>
              )}
              <span className="font-mono font-bold text-primary leading-none">
                {formatCurrency((itemListPrice(item) - item.discount) * item.quantity)}
              </span>
            </div>
            {item.discount > 0 ? (
              <Button
                variant="link"
                size="sm"
                className="h-4 p-0 text-[10px] text-emerald-500 hover:text-destructive transition-colors font-semibold"
                onClick={() => {
                  applyItemDiscount(item.id, 0);
                  toast({
                    title: "Desconto Removido",
                    description: "O preço original do item foi restaurado.",
                    duration: 2000,
                  });
                }}
              >
                Remover Desconto
              </Button>
            ) : (
              <div className="h-4" />
            )}
          </div>
        </div>

        {/* Linha inteira, abaixo de quantidade/preço/total: o acréscimo carrega
            uma justificativa em texto, que não cabe numa das três colunas. */}
        <PdvCartItemSurchargeChip item={item} onRemove={removeSurcharge} />
      </div>

      <PdvSurchargeReasonDialog
        amount={pendingSurcharge}
        productName={item.name}
        listPrice={item.price}
        currentReason={item.surchargeReason}
        onConfirm={confirmSurcharge}
        onCancel={cancelSurcharge}
      />
    </motion.div>
  );
}
