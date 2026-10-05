import { Layers, Tag, Zap } from "lucide-react";
import {
  describeComboOffer,
  formatCurrency,
  PROMOTION_KIND_LABEL,
  resolveShelfPromotion,
  shelfPrice,
  type PromotionRule,
} from "@workspace/core";
import { PromotionSeal } from "@/components/shelf-price";
import { useShelfPrice } from "@/hooks/use-shelf-price";

type ProductPromotionNoticeProps = {
  /** Grupo do produto aberto. Nulo no cadastro novo — aí não há promoção. */
  productGroupId: number | null | undefined;
  /**
   * Preço de tabela do produto SIMPLES, para o "De/por". Nulo no grupo com
   * variações: cada uma tem o seu, e o aviso fala da regra.
   */
  price: number | null;
};

/**
 * O aviso de que o produto está em promoção AGORA, no detalhe do produto.
 *
 * O campo de preço continua sendo o preço de TABELA — é ele que se edita, e a
 * promoção é derivada dele a cada leitura (`Uaus.Docs/dominio/promocoes.md`).
 * Sem o aviso, quem abre o cadastro no sábado vê R$ 12,90 enquanto o caixa cobra
 * R$ 9,90, e "corrige" o preço achando que a etiqueta está errada.
 *
 * Mesma regra e mesma lista da listagem e do balcão (`useShelfPrice`).
 */
export function ProductPromotionNotice({ productGroupId, price }: ProductPromotionNoticeProps) {
  const { rules, now } = useShelfPrice();
  const promocao = resolveShelfPromotion(rules, productGroupId, now);
  if (!promocao) return null;

  const Icone = promocao.kind === "flash" ? Zap : promocao.kind === "combo" ? Layers : Tag;

  return (
    <div
      role="status"
      className="space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PromotionSeal icon={Icone} label={`Promoção ${PROMOTION_KIND_LABEL[promocao.kind]}`} />
        <span className="text-muted-foreground">{describeValidity(promocao)}</span>
      </div>
      <p className="font-medium text-foreground">{describeEffect(promocao, price)}</p>
    </div>
  );
}

/** "vale até 11/10 às 18:00 · limite de 6 por cliente", ou "sem prazo". */
function describeValidity(promotion: PromotionRule): string {
  const ate = promotion.validUntil
    ? `vale até ${formatLocalInstant(promotion.validUntil)}`
    : "sem prazo para acabar";
  return promotion.maxQuantityPerSale != null
    ? `${ate} · limite de ${promotion.maxQuantityPerSale} por cliente`
    : ate;
}

/** O que a promoção faz com o preço deste produto, numa frase. */
function describeEffect(promotion: PromotionRule, price: number | null): string {
  if (promotion.kind === "combo") {
    const oferta = describeComboOffer(
      {
        quantity: promotion.comboQuantity ?? 0,
        discountKind: promotion.discountKind,
        discountValue: promotion.discountValue,
      },
      price ?? undefined,
    );
    return `${oferta} — a unidade avulsa continua no preço de tabela.`;
  }

  if (price != null) {
    const shelf = shelfPrice(price, promotion);
    if (shelf.kind === "unit" && shelf.price < shelf.referencePrice) {
      return `De ${formatCurrency(shelf.referencePrice)} por ${formatCurrency(shelf.price)} no caixa.`;
    }
    if (shelf.kind === "unit") return "Destaque sem desconto: o preço de tabela é o preço da promoção.";
    return "O preço promocional não fica abaixo do de tabela, e o caixa cobra o de tabela.";
  }

  if (promotion.discountKind === "percentage") {
    return promotion.discountValue > 0
      ? `${promotion.discountValue.toLocaleString("pt-BR")}% de desconto em cada variação, no caixa.`
      : "Destaque sem desconto: o preço de cada variação é o preço da promoção.";
  }

  return `${formatCurrency(promotion.discountValue)} em todas as variações, no caixa.`;
}

/**
 * "11/10 às 18:00" a partir do instante local sem fuso da API. Fatiado como
 * texto, e não por `new Date`: o instante já está no horário da loja, e não há
 * fuso nenhum a converter.
 */
function formatLocalInstant(instant: string): string {
  const [data, hora = ""] = instant.split("T");
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes} às ${hora.slice(0, 5)}`;
}
