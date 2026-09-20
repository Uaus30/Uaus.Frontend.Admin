import { Link } from "wouter";
import { buildPublicImageUrl, useGetStorefrontFlashPromotion } from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import { useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";
import { productDetailPath } from "@/routes";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { formatCountdown, useCountdown } from "../hooks/useCountdown";

/**
 * O banner da relâmpago — o primeiro bloco da home, acima do carrossel.
 *
 * ## Por que ele fica no topo
 *
 * A relâmpago dura horas e é a **única coisa da página com prazo**. Tudo o mais
 * na home (hero, carrossel, destaques) continua igual amanhã.
 *
 * ## Por que ele SOME em vez de mostrar erro
 *
 * Sem promoção, com falha de rede ou com a contagem zerada, o bloco
 * simplesmente não existe — mesma regra da seção de destaques. Um "não foi
 * possível carregar" no topo da home dá a impressão de site quebrado por algo
 * que o visitante nem sabia que existia. E "não há relâmpago hoje" é o caso da
 * maior parte da semana: a loja faz uma.
 *
 * ## O relógio do site não é a vigência
 *
 * A contagem para às 18h porque é quando a loja fecha, e anunciar "termina às
 * 23:59" mandaria a cliente para uma porta fechada. A **vigência** vai até onde
 * o cadastro disser: às 18h05 o banner some, mas o preço continua valendo no
 * caixa — e o card do produto continua com o selo e o "de/por".
 *
 * ## Preto com laranja aqui é MARCA
 *
 * O vocabulário de cores da casa (verde/âmbar/vermelho/cinza) fala de ESTADO e
 * continua valendo na retaguarda. Aqui a cor é identidade — a mesma dos cartazes
 * que a loja publica no grupo de WhatsApp —, e isso vale só na vitrine.
 */
export function FlashPromotionBanner() {
  const { data } = useGetStorefrontFlashPromotion();
  const restante = useCountdown(data?.promotion.endsInSeconds);
  const reduzirMovimento = useReducedMotion();

  if (!data || restante <= 0) return null;

  const { promotion } = data;
  const faixa = promotion.priceMax != null && promotion.priceMax > promotion.price;

  return (
    <section className="bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Link
          href={productDetailPath(data.productGroupId)}
          className="group flex flex-col items-center gap-6 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 transition-colors hover:border-amber-400/60 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none sm:flex-row sm:p-8"
        >
          {/* O raio é SVG do bundle: nenhuma imagem remota no topo da home, que
              é o primeiro paint no 4G da cidade. */}
          <span className="flex shrink-0 items-center gap-2 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-black tracking-wider text-neutral-950 uppercase">
            <Zap
              className={`h-4 w-4 fill-neutral-950 ${reduzirMovimento ? "" : "motion-safe:animate-pulse"}`}
            />
            Promoção relâmpago
          </span>

          {data.imageUrl && (
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-white p-2">
              <ProductImage
                src={buildPublicImageUrl(data.imageUrl)}
                alt={data.name}
                className="h-full w-full object-contain"
              />
            </div>
          )}

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="font-display text-2xl font-black tracking-tight uppercase sm:text-3xl">
              {data.name}
            </h2>

            <p className="mt-1 text-sm text-neutral-300">
              {promotion.referencePrice != null && (
                <>
                  de <span className="line-through">{formatCurrency(promotion.referencePrice)}</span>{" "}
                </>
              )}
              {faixa ? "a partir de" : "por apenas"}{" "}
              <strong className="font-display text-2xl text-amber-400">
                {formatCurrency(promotion.price)}
              </strong>
            </p>

            {promotion.maxQuantityPerSale != null && promotion.maxQuantityPerSale > 0 && (
              <p className="mt-1 text-xs text-neutral-400">
                Limite de {promotion.maxQuantityPerSale} por cliente
              </p>
            )}
          </div>

          <div className="shrink-0 text-center">
            <p className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Termina em</p>
            {/* `tabular-nums` para o número não dançar a cada segundo. */}
            <p className="font-display text-3xl font-black tabular-nums text-amber-400">
              {formatCountdown(restante)}
            </p>
            <p className="text-[10px] text-neutral-500">a loja fecha às 18h</p>
          </div>
        </Link>
      </div>
    </section>
  );
}
