import type { ReactNode } from "react";
import { Layers, Tag, Zap } from "lucide-react";
import { formatCurrency, PROMOTION_KIND_LABEL, type ShelfPrice } from "@workspace/core";

type ShelfPriceViewProps = {
  shelf: ShelfPrice;
  /** Classe do preço principal quando ele NÃO é promocional — a cor de cada tela. */
  priceClassName?: string;
  /**
   * Substitui o preço de tabela por outro conteúdo — a listagem de produtos põe
   * ali o campo da edição rápida, que continua editando o preço de TABELA.
   * `struck` diz que ele está na linha do "De", riscado e pequeno.
   */
  renderReferencePrice?: (price: number, struck: boolean) => ReactNode;
  /** Alinhamento do bloco. A listagem alinha à esquerda; o detalhe também. */
  align?: "start" | "end";
};

/**
 * O preço de um produto com a promoção que vale agora, no admin.
 *
 * As formas do pedido do dono (05/10/2026):
 *
 * - **Relâmpago e Dia a Dia**: o promocional no lugar do preço, o de tabela
 *   riscado em cinza ACIMA ("De R$ 12,90") e o selo do tipo EMBAIXO. Os de cima e
 *   de baixo são menores — menos destaque, e cabem na célula.
 * - **Combo**: o preço normal continua o principal, e o selo embaixo resume a
 *   oferta ("3 por R$ 20,00", "R$ 6,50 pra 2+").
 * - **Isca do Dia a Dia** (desconto zero): o preço e o selo, sem "de".
 *
 * Cinza no riscado, e não vermelho: vermelho é "negativo, bloqueado" no
 * vocabulário de cores (`Uaus.Docs/dominio/convencoes-de-interface.md`). O
 * promocional e o selo saem em verde, o mesmo cartaz que o PDV mostra no
 * carrinho e na busca; o tipo vai escrito e com ícone, nunca só na cor.
 */
export function ShelfPriceView({
  shelf,
  priceClassName = "font-medium text-orange-500",
  renderReferencePrice,
  align = "start",
}: ShelfPriceViewProps) {
  const alinhamento = align === "end" ? "items-end text-right" : "items-start";
  const tabela = (price: number) =>
    renderReferencePrice ? (
      renderReferencePrice(price, false)
    ) : (
      <span className={priceClassName}>{formatCurrency(price)}</span>
    );

  if (shelf.kind === "regular") return <>{tabela(shelf.price)}</>;

  if (shelf.kind === "combo") {
    return (
      <div className={`flex flex-col gap-0.5 ${alinhamento}`}>
        {tabela(shelf.price)}
        <PromotionSeal icon={Layers} label={shelf.offer} />
      </div>
    );
  }

  const comDesconto = shelf.price < shelf.referencePrice;
  const selo = (
    <PromotionSeal
      icon={shelf.promotion.kind === "flash" ? Zap : Tag}
      label={PROMOTION_KIND_LABEL[shelf.promotion.kind]}
    />
  );

  if (!comDesconto) {
    return (
      <div className={`flex flex-col gap-0.5 ${alinhamento}`}>
        {tabela(shelf.price)}
        {selo}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 leading-tight ${alinhamento}`}>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        De{" "}
        {renderReferencePrice ? (
          renderReferencePrice(shelf.referencePrice, true)
        ) : (
          <span className="line-through">{formatCurrency(shelf.referencePrice)}</span>
        )}
      </span>
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="text-[11px] font-medium">por </span>
        {formatCurrency(shelf.price)}
      </span>
      {selo}
    </div>
  );
}

/** O selo da promoção: ícone e rótulo, no verde do cartaz. */
export function PromotionSeal({ icon: Icon, label }: { icon: typeof Tag; label: string }) {
  return (
    <span className="inline-flex w-max items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px text-[10px] font-bold uppercase leading-4 text-emerald-600 dark:text-emerald-400">
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
