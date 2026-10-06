import { ExternalLink } from "lucide-react";
import { cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ProfitBucketDto, ProfitLeaderDto } from "@workspace/api-client-react";
import { BI_TONE_FILL, BI_TONE_TEXT } from "@/lib/bi-tone";
import { productDetailPathname } from "@/features/products/product-detail-route";
import { adminNewTabProps } from "@/lib/installed-app";
import { ArchetypeBadge, AlertBadge } from "./ProfitBadges";
import { ProfitSparkline } from "./ProfitSparkline";
import {
  archetypeAction,
  highlightLevel,
  leaderTone,
  readAlert,
  readArchetype,
  readPerUnit,
  readPosition,
} from "../lib/profit-leaders";

type ProfitRowProps = {
  leader: ProfitLeaderDto;
  buckets: ProfitBucketDto[];
  /** Mediana de lucro por peça do corte — a régua da segunda leitura. */
  median: number;
};

/**
 * Uma linha do ranking, em quatro andares: a posição, <b>o motivo dela</b>, o
 * que o produto é, e o que fazer a respeito.
 *
 * O segundo andar é o pedido central do dono: "R$ 237,33" sozinho não distingue
 * 293 peças a R$ 0,81 de 14 peças a R$ 10,75, e os dois pedem ações opostas —
 * reposição e ponto de venda num caso, variação e exposição no outro.
 */
export function ProfitRow({ leader, buckets, median }: ProfitRowProps) {
  const tom = leaderTone(leader);
  const destaque = highlightLevel(leader);
  const alerta = readAlert(leader);
  const porPeca = readPerUnit(leader, median);

  return (
    <li
      className={cn(
        "relative flex gap-2.5 rounded-xl border bg-card p-3 pl-3.5 transition-colors sm:gap-3.5 sm:p-3.5 sm:pl-4",
        destaque === "forte"
          ? "border-emerald-500/40 bg-emerald-500/[0.04]"
          : "border-border/60 hover:border-border",
      )}
    >
      {/* A faixa lateral repete o tom da pílula. Nunca sozinha: o texto da
          pílula diz a mesma coisa em palavras. */}
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-3 left-0 w-1 rounded-full", BI_TONE_FILL[tom])}
      />

      <span
        className={cn(
          "mt-0.5 w-7 shrink-0 text-right text-[14px] font-semibold tabular-nums sm:w-9 sm:text-[15px]",
          destaque ? BI_TONE_TEXT[tom] : "text-muted-foreground",
        )}
      >
        {leader.rank}º
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className="break-words text-[14px] font-semibold leading-snug sm:truncate"
                title={leader.productName}
              >
                {leader.productName}
              </p>
              {/* Abre em nova aba, e não navega dentro do admin: a tela de BI
                  não pode se perder por causa de um clique de conferência. É
                  o mesmo padrão de `PurchaseLinkField` — âncora simples, sem
                  o roteador da SPA. No app do iPhone abre na mesma janela
                  (ver `adminNewTabProps`). */}
              <a
                href={productDetailPathname(leader.productGroupId)}
                {...adminNewTabProps()}
                aria-label={`Abrir ${leader.productName} no cadastro, em nova aba`}
                title="Abrir no cadastro do produto"
                className="-m-1.5 shrink-0 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {[leader.categoryName, leader.supplierName].filter(Boolean).join(" · ") || "sem categoria"}
            </p>
          </div>

          {/* O gráfico (132px) não cabe no celular: espremido no miolo, ele
              invadia a coluna do lucro. Lá o número vem por extenso logo abaixo. */}
          {leader.history.length > 0 && (
            <div className={cn("hidden shrink-0 sm:block", BI_TONE_TEXT[tom])}>
              <ProfitSparkline
                history={leader.history}
                buckets={buckets}
                label={`Evolução do lucro de ${leader.productName} no período`}
              />
            </div>
          )}
        </div>

        {/* Celular: o lucro e o estoque saem da coluna da direita e vêm para
            cá. Com a coluna (w-24) e a posição (w-9), sobravam ~93px para o
            nome numa tela de 375 (06/10/2026). */}
        <p className="mt-1.5 text-[13px] sm:hidden">
          <span className="font-semibold">{formatCurrency(leader.profit)}</span>
          <span className="text-muted-foreground">
            {" · "}
            {leader.stock > 0 ? `${leader.stock} em casa` : "sem estoque"}
          </span>
        </p>

        <p className="mt-2 text-[13px] font-medium">
          {readPosition(leader)}
          <span className="ml-2 font-normal text-muted-foreground">
            · {leader.share.toFixed(1).replace(".", ",")}% do lucro · margem{" "}
            {leader.marginPercentage.toFixed(0)}%
          </span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ArchetypeBadge leader={leader} />
          <AlertBadge leader={leader} />
          <span className="text-[11.5px] text-muted-foreground">{archetypeAction(leader.archetype)}</span>
        </div>

        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          {readArchetype(leader)}
          {alerta && <span className={cn("ml-1", BI_TONE_TEXT[tom])}>{alerta}</span>}
        </p>

        {porPeca && <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{porPeca}</p>}
      </div>

      {/* Do `sm` para cima. No celular o lucro e o estoque vêm embaixo do nome
          (acima): o estoque é informação de decisão — se dá para esperar a
          próxima compra ou não — e não pode sumir. */}
      <div className="hidden w-28 shrink-0 text-right sm:block">
        <p className="text-[15px] font-semibold leading-none">{formatCurrency(leader.profit)}</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          {leader.units} {leader.units === 1 ? "peça" : "peças"}
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {leader.sales} {leader.sales === 1 ? "venda" : "vendas"}
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {leader.stock > 0 ? `${leader.stock} em casa` : "sem estoque"}
        </p>
      </div>
    </li>
  );
}
