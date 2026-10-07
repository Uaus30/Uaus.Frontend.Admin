import { useEffect, useRef, useState } from "react";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@workspace/core";

type PdvPhoneCartBarProps = {
  /** Unidades no carrinho, somando a quantidade de cada linha. */
  units: number;
  /** O total da venda, já com descontos — o número que o operador dita. */
  total: number;
  /**
   * Muda a cada item que entra no carrinho (o `lastAddedSeq` do store). É a
   * `key` do contador: chave nova remonta o nó, e é isso que reinicia o pulso.
   */
  pulseKey: number;
  /** Leva para a vista do carrinho. */
  onOpenCart: () => void;
};

/**
 * A barra do pé no celular em pé: quantos itens, quanto dá e o caminho para o
 * carrinho.
 *
 * Em pé, a busca e o carrinho são vistas separadas, e o realce da linha que
 * acabou de entrar (`PdvCartItem`) acontece numa vista que não está à mostra.
 * O pulso do contador, com uma vibração curta, é a confirmação do item no lugar
 * dele — onde o olho do operador está.
 *
 * O pulso só vale para item que ENTROU com a barra na tela. Ele é medido contra
 * uma linha de base — o contador quando a barra montou, ou quando o carrinho
 * ficou vazio pela última vez. Sem ela, voltar do carrinho (a barra remonta) ou
 * retomar uma venda em espera (o carrinho volta cheio sem bipe nenhum) faria o
 * contador pulsar dizendo "entrou um item" sem ter entrado nada.
 *
 * Com o carrinho vazio ela não existe: não há o que abrir, e a altura volta
 * para a lista de resultados.
 */
export function PdvPhoneCartBar({ units, total, pulseKey, onOpenCart }: PdvPhoneCartBarProps) {
  const [baseline, setBaseline] = useState(pulseKey);
  // Ajuste durante o render, o padrão do React para estado que acompanha prop:
  // com o carrinho vazio, a base anda junto com o contador.
  if (units === 0 && baseline !== pulseKey) setBaseline(pulseKey);
  const lastVibrated = useRef(pulseKey);

  useEffect(() => {
    if (pulseKey === lastVibrated.current) return;
    lastVibrated.current = pulseKey;
    // Opcional por natureza: o iPhone não vibra pela web, e o Android com o
    // modo silencioso ignora. A confirmação que sempre existe é o pulso.
    navigator.vibrate?.(30);
  }, [pulseKey]);

  if (units === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpenCart}
      aria-label={`Abrir o carrinho: ${units} ${units === 1 ? "item" : "itens"}, ${formatCurrency(total)}`}
      // `pb-[max(...)]`: no iPhone instalado como app, a barra do sistema fica
      // por cima do pé da tela, e o botão sumiria embaixo dela.
      className="flex w-full shrink-0 items-center gap-3 border-t border-border/50 bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-left shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.3)] cursor-pointer active:bg-muted/40"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <ShoppingCart className="h-5 w-5" />
        <span
          key={pulseKey}
          data-testid="phone-cart-count"
          className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-mono text-[11px] font-bold text-primary-foreground ${
            pulseKey !== baseline ? "pdv-count-pulse" : ""
          }`}
        >
          {units}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Carrinho
        </span>
        <span className="block font-mono text-xl font-bold leading-tight">{formatCurrency(total)}</span>
      </span>
      <span className="flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-primary">
        Ver <ChevronRight className="h-5 w-5" />
      </span>
    </button>
  );
}
