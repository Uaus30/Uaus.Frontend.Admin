import * as React from "react";
import { Medal } from "lucide-react";
import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ProfitBucketDto, ProfitLeaderDto } from "@workspace/api-client-react";
import { BiCardHelp, BiCardHelpExample } from "@/components/bi-card-help";
import { ArchetypeBadge, AlertBadge } from "./ProfitBadges";
import { ProfitSparkline } from "./ProfitSparkline";
import { MEDALS, readArchetype, readPosition } from "../lib/profit-leaders";

type ProfitPodiumProps = {
  podium: ProfitLeaderDto[];
  buckets: ProfitBucketDto[];
};

/**
 * Alturas por POSIÇÃO, e não por lucro.
 *
 * O pódio é sobre ordem, não sobre magnitude: com barras proporcionais ao lucro,
 * um 1º e um 2º quase empatados produziriam um pódio plano, e um 1º muito à
 * frente esmagaria os outros dois até sumirem. A magnitude está escrita em reais
 * dentro de cada cartão, que é onde ela se lê sem ambiguidade.
 */
const ALTURAS = ["h-24", "h-[4.5rem]", "h-14"];

const MEDALHAS = [
  "from-amber-200 to-amber-400 text-amber-950 dark:from-amber-300 dark:to-amber-500",
  "from-slate-200 to-slate-400 text-slate-900 dark:from-slate-300 dark:to-slate-500",
  "from-orange-200 to-orange-400 text-orange-950 dark:from-orange-300 dark:to-orange-500",
];

/** A ordem em que o pódio se desenha: prata, ouro, bronze. */
const ORDEM_VISUAL = [1, 0, 2];

/**
 * O pódio: as três maiores fatias do lucro do período.
 *
 * <b>O selo de arquétipo sobe junto com a medalha.</b> A medalha é do período
 * escolhido e é honesta; o selo é o que impede que ela seja lida como
 * recomendação de compra. Em 90 dias de produção o ouro é a CAMISETA DO BRASIL,
 * que vendeu 85 peças em junho e 3 em setembro — a medalha é dela por mérito, e
 * "perdendo ritmo" ao lado é o que separa o mérito da recomendação.
 *
 * <b>A animação respeita `prefers-reduced-motion`</b>: com movimento reduzido no
 * sistema, as barras aparecem já na altura final em vez de crescerem.
 */
export function ProfitPodium({ podium, buckets }: ProfitPodiumProps) {
  const [montado, setMontado] = React.useState(false);

  React.useEffect(() => {
    // `setTimeout` e não `requestAnimationFrame`: o segundo não roda em alguns
    // navegadores embutidos, e a barra ficaria presa na altura zero.
    const id = setTimeout(() => setMontado(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (podium.length === 0) return null;

  return (
    <Card className="border-border/60 p-5">
      <div className="flex items-center gap-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          O pódio do período
        </h2>
        <BiCardHelp titulo="O pódio do período">
          <p>
            Os três produtos que mais lucro deixaram no período escolhido. A altura marca a colocação, não o
            tamanho: o valor em reais está escrito em cada cartão.
          </p>
          <p>
            <strong className="text-foreground/85">A medalha é do período, não do futuro.</strong> Um produto
            de temporada pode ganhar o ouro e já ter parado de vender — por isso o selo de situação sobe junto
            com a medalha. Medalha é mérito do que passou; o selo é o que dizer sobre o que vem.
          </p>
          <BiCardHelpExample>
            Em 90 dias, o 1º lugar foi a camiseta da Copa: 85 peças em junho e 3 em setembro. Ganhou a medalha
            com razão — e o selo "perdendo ritmo" ao lado evita que isso vire pedido de compra.
          </BiCardHelpExample>
          <p>Trocar o período troca o pódio. É a primeira coisa a conferir antes de decidir por ele.</p>
        </BiCardHelp>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3 md:items-end">
        {ORDEM_VISUAL.filter((indice) => podium[indice]).map((indice) => (
          <Degrau
            key={podium[indice]!.productId}
            leader={podium[indice]!}
            buckets={buckets}
            indice={indice}
            montado={montado}
          />
        ))}
      </div>
    </Card>
  );
}

type DegrauProps = {
  leader: ProfitLeaderDto;
  buckets: ProfitBucketDto[];
  indice: number;
  montado: boolean;
};

function Degrau({ leader, buckets, indice, montado }: DegrauProps) {
  return (
    <div className="flex flex-col">
      <div className="rounded-xl border border-border/60 bg-card p-3.5">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold shadow-sm",
              MEDALHAS[indice],
            )}
          >
            {leader.rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Medal className="h-3 w-3" />
              {MEDALS[indice]}
            </p>
            <p
              className="mt-0.5 truncate text-[13.5px] font-semibold leading-snug"
              title={leader.productName}
            >
              {leader.productName}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-[22px] font-semibold leading-none">{formatCurrency(leader.profit)}</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">{readPosition(leader)}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <ArchetypeBadge leader={leader} />
          <AlertBadge leader={leader} />
        </div>

        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{readArchetype(leader)}</p>

        {leader.history.length > 0 && (
          <div className="mt-2 text-foreground/60">
            <ProfitSparkline
              history={leader.history}
              buckets={buckets}
              label={`Evolução do lucro de ${leader.productName} no período`}
            />
          </div>
        )}
      </div>

      {/* O degrau. Some no empilhamento vertical do celular, onde não há pódio
          para desenhar — três barras uma embaixo da outra não formam ordem. */}
      <div
        style={{ transitionDelay: `${(2 - indice) * 110}ms` }}
        className={cn(
          "mt-2 hidden rounded-t-lg bg-gradient-to-b md:block",
          "origin-bottom transition-transform duration-700 ease-out motion-reduce:transition-none",
          montado ? "scale-y-100" : "scale-y-0",
          ALTURAS[indice],
          MEDALHAS[indice],
        )}
        aria-hidden="true"
      />
    </div>
  );
}
