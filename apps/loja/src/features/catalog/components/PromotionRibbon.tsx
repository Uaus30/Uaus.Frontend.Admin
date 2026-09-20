import { Zap } from "lucide-react";
import { PROMOTION_TYPE, enumCode, type StorefrontPromotionDto } from "@workspace/api-client-react";

/**
 * A etiqueta "Promoção" do card.
 *
 * ## Por que ela não é uma `Tag` cadastrada
 *
 * Etiqueta cadastrada teria que ser posta e tirada à mão toda semana — que é
 * exatamente o trabalho manual que a feature de promoções existe para acabar.
 * Esta é **resolvida no backend** a partir da vigência, e some sozinha quando a
 * promoção acaba.
 *
 * ## Preto com laranja aqui é MARCA, não estado
 *
 * O vocabulário de cores da casa (verde/âmbar/vermelho/cinza) fala de estado, e
 * ele continua valendo em toda a retaguarda. Na vitrine, o preto com laranja e o
 * raio são a identidade visual da relâmpago — a mesma dos cartazes que a loja
 * publica no grupo de WhatsApp —, e o cliente reconhece o selo antes de ler.
 * Isto vale **só** na loja pública.
 */
export function PromotionRibbon({ promotion }: { promotion: StorefrontPromotionDto }) {
  const relampago = enumCode(promotion.type, PROMOTION_TYPE) === PROMOTION_TYPE.Flash;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-bold tracking-wide text-amber-400 uppercase shadow-sm">
      <Zap className="h-3 w-3 fill-amber-400" />
      {relampago ? "Relâmpago" : "Promoção"}
    </span>
  );
}
