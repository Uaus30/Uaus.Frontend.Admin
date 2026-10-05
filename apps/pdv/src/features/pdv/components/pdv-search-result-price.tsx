import { Layers, Tag, Zap } from "lucide-react";
import { formatCurrency, PROMOTION_KIND_LABEL, type ShelfPrice } from "@workspace/core";

type PdvSearchResultPriceProps = {
  shelf: ShelfPrice;
};

/**
 * O preço de uma linha da busca do balcão, com a promoção que vale agora.
 *
 * Três formas, as do pedido do dono (05/10/2026):
 *
 * - **Relâmpago e Dia a Dia**: o promocional no lugar do preço, o de tabela
 *   riscado em cinza acima ("De R$ 12,90") e o selo do tipo embaixo. Cinza, e
 *   não vermelho: vermelho é "negativo, bloqueado" no vocabulário da casa
 *   (`Uaus.Docs/dominio/convencoes-de-interface.md`).
 * - **Combo**: o preço normal continua o principal — a unidade avulsa sai por
 *   ele — e o resumo da oferta vai no selo ("3 por R$ 20,00").
 * - **Isca do Dia a Dia** (desconto zero): o preço e o selo, sem "de".
 *
 * O promocional sai em verde, a cor do selo do carrinho (`pdv-cart-item-
 * promotion`): é o mesmo cartaz nos dois lugares. O tipo vai escrito e com ícone,
 * nunca só na cor.
 */
export function PdvSearchResultPrice({ shelf }: PdvSearchResultPriceProps) {
  if (shelf.kind === "regular") {
    return <p className="text-xl font-mono font-bold text-primary">{formatCurrency(shelf.price)}</p>;
  }

  if (shelf.kind === "combo") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <p className="text-xl font-mono font-bold text-primary">{formatCurrency(shelf.price)}</p>
        <PromotionSeal icon={Layers} label={shelf.offer} />
      </div>
    );
  }

  const comDesconto = shelf.price < shelf.referencePrice;
  const relampago = shelf.promotion.kind === "flash";
  const limite = shelf.promotion.maxQuantityPerSale;

  return (
    <div className="flex flex-col items-end gap-0.5">
      {comDesconto && (
        <p className="text-xs font-mono text-muted-foreground">
          De <span className="line-through">{formatCurrency(shelf.referencePrice)}</span>
        </p>
      )}
      <p className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
        {comDesconto && <span className="text-xs font-sans font-semibold">por </span>}
        {formatCurrency(shelf.price)}
      </p>
      {/* O limite vai no selo porque é a pergunta seguinte do cliente que pega
          dez: o cartaz fala "por cliente", e o excedente sai a preço cheio. */}
      <PromotionSeal
        icon={relampago ? Zap : Tag}
        label={
          limite != null
            ? `${PROMOTION_KIND_LABEL[shelf.promotion.kind]} · até ${limite}`
            : PROMOTION_KIND_LABEL[shelf.promotion.kind]
        }
      />
    </div>
  );
}

function PromotionSeal({ icon: Icon, label }: { icon: typeof Tag; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
