import * as React from "react";
import { Crown, Medal } from "lucide-react";
import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ProfitBucketDto, ProfitLeaderDto } from "@workspace/api-client-react";
import { BiCardHelp, BiCardHelpExample } from "@/components/bi-card-help";
import { ArchetypeBadge, AlertBadge } from "./ProfitBadges";
import { ProfitSparkline } from "./ProfitSparkline";
import { ARCHETYPE_ICONS, FALLBACK_ICON, MEDALS, readArchetype, readPosition } from "../lib/profit-leaders";

type ProfitPodiumProps = {
  podium: ProfitLeaderDto[];
  buckets: ProfitBucketDto[];
};

/**
 * Identidade visual por POSIÇÃO — índice 0 é sempre o 1º lugar (ouro).
 *
 * <b>Prata é AZUL, não cinza.</b> Decisão deliberada, a partir de uma referência
 * visual trazida pelo dono: o cinza de medalha não lê bem como destaque num
 * cartão escuro, e o azul distingue o 2º lugar do texto neutro do resto da
 * tela sem disputar com o dourado do 1º.
 */
const ACCENT = [
  {
    borda: "border-amber-400/70",
    fundo: "from-amber-500/10",
    medalha: "from-amber-200 to-amber-500 text-amber-950",
    tom: "text-amber-400",
    preco: "text-amber-400",
  },
  {
    borda: "border-blue-500/60",
    fundo: "from-blue-500/10",
    medalha: "from-sky-100 to-blue-300 text-blue-950",
    tom: "text-blue-400",
    preco: "text-blue-100",
  },
  {
    borda: "border-orange-700/60",
    fundo: "from-orange-500/10",
    medalha: "from-orange-200 to-orange-500 text-orange-950",
    tom: "text-orange-400",
    preco: "text-orange-400",
  },
] as const;

/**
 * Onde cada posição cai no grid em telas médias+: prata à esquerda, ouro no
 * centro, bronze à direita.
 *
 * A ORDEM NO DOM continua sendo a do rank (ouro, prata, bronze) — é ela que o
 * leitor de tela lê e é ela que empilha certo no celular, onde a pergunta muda
 * de "quem é o 1º" (centralidade) para "por onde eu desço a lista" (ordem). Só
 * a posição VISUAL muda com `order`, a partir de `md:`.
 */
const ORDEM_DESKTOP = ["md:order-2", "md:order-1", "md:order-3"];

/** Atraso da entrada, por posição VISUAL (esquerda→direita): prata, ouro, bronze. */
const ATRASO_MS = [100, 0, 200];

/**
 * O pódio: as três maiores fatias do lucro do período.
 *
 * <b>O selo de arquétipo sobe junto com a medalha.</b> A medalha é do período
 * escolhido e é honesta; o selo é o que impede que ela seja lida como
 * recomendação de compra. Em 90 dias de produção o ouro é a CAMISETA DO BRASIL,
 * que vendeu 85 peças em junho e 3 em setembro — a medalha é dela por mérito, e
 * "perdendo ritmo" ao lado é o que separa o mérito da recomendação.
 *
 * <b>Nenhum "degrau" físico embaixo do cartão.</b> A versão anterior desenhava
 * uma barra crescendo por baixo de cada cartão, proporcional à posição — mas
 * altura de barra é um eixo que este pódio não tem (ele não é sobre magnitude,
 * é sobre ordem, e a ordem já está escrita no cartão: centro + moldura dourada
 * = 1º). O destaque agora vem do próprio cartão: borda mais grossa, brilho e
 * uma pequena elevação no do meio.
 *
 * <b>A animação de entrada e o pulso da coroa respeitam
 * `prefers-reduced-motion`</b>, como o resto da tela.
 */
export function ProfitPodium({ podium, buckets }: ProfitPodiumProps) {
  const [montado, setMontado] = React.useState(false);

  React.useEffect(() => {
    // `setTimeout` e não `requestAnimationFrame`: o segundo não roda em alguns
    // navegadores embutidos, e o cartão ficaria preso na entrada.
    const id = setTimeout(() => setMontado(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (podium.length === 0) return null;

  return (
    <Card className="relative overflow-hidden border-border/60 p-5">
      {/* Glow decorativo, sem informação nenhuma — por isso `aria-hidden`. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(251,191,36,0.07),transparent_60%)]"
      />

      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
          <Crown className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <h2 className="text-[19px] font-extrabold tracking-tight">
              <span className="text-foreground">Pódio</span>{" "}
              <span className="bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent">
                do período
              </span>
            </h2>
            <BiCardHelp titulo="O pódio do período">
              <p>
                Os três produtos que mais lucro deixaram no período escolhido. A posição no meio e o contorno
                dourado marcam o 1º lugar — o valor em reais, que decide a ordem, está escrito em cada cartão.
              </p>
              <p>
                <strong className="text-foreground/85">A medalha é do período, não do futuro.</strong> Um
                produto de temporada pode ganhar o ouro e já ter parado de vender — por isso o selo de
                situação sobe junto com a medalha. Medalha é mérito do que passou; o selo é o que dizer sobre
                o que vem.
              </p>
              <BiCardHelpExample>
                Em 90 dias, o 1º lugar foi a camiseta da Copa: 85 peças em junho e 3 em setembro. Ganhou a
                medalha com razão — e o selo "perdendo ritmo" ao lado evita que isso vire pedido de compra.
              </BiCardHelpExample>
              <p>Trocar o período troca o pódio. É a primeira coisa a conferir antes de decidir por ele.</p>
            </BiCardHelp>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Os três produtos que mais lucro deixaram no período.
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid gap-4 md:grid-cols-3 md:items-center">
        {podium.map((leader, indice) => (
          <CartaoDoPodio
            key={leader.productId}
            leader={leader}
            buckets={buckets}
            indice={indice}
            montado={montado}
          />
        ))}
      </div>
    </Card>
  );
}

type CartaoDoPodioProps = {
  leader: ProfitLeaderDto;
  buckets: ProfitBucketDto[];
  /** 0 = 1º lugar (ouro), 1 = 2º (prata), 2 = 3º (bronze). */
  indice: number;
  montado: boolean;
};

function CartaoDoPodio({ leader, buckets, indice, montado }: CartaoDoPodioProps) {
  const ouro = indice === 0;
  const cor = ACCENT[indice] ?? ACCENT[2];
  const IconeDeTendencia = ARCHETYPE_ICONS[leader.archetype] ?? FALLBACK_ICON;
  const IconeDoSelo = ouro ? Crown : Medal;

  return (
    <div
      style={{ transitionDelay: `${ATRASO_MS[indice] ?? 0}ms` }}
      className={cn(
        "relative rounded-2xl border bg-gradient-to-b to-card p-5",
        "transition-all duration-500 ease-out motion-reduce:transition-none",
        "hover:-translate-y-1 hover:shadow-lg",
        cor.fundo,
        cor.borda,
        ouro ? "border-2 shadow-[0_0_28px_-6px_rgba(251,191,36,0.4)] md:-translate-y-2" : "border",
        ORDEM_DESKTOP[indice],
        montado ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      {ouro && (
        <Crown
          aria-hidden="true"
          className="absolute -top-5 left-1/2 h-7 w-7 -translate-x-1/2 text-amber-400 animate-pulse motion-reduce:animate-none"
        />
      )}

      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[17px] font-extrabold shadow-sm",
            cor.medalha,
          )}
        >
          {leader.rank}
        </span>
        <p className={cn("flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider", cor.tom)}>
          <IconeDoSelo className="h-3.5 w-3.5" />
          {MEDALS[indice]}
        </p>
      </div>

      {/* Duas linhas com reticências, e não uma: nome de produto aqui passa de
          60 caracteres com a variação entre colchetes, e cortar na primeira
          linha esconderia justamente a parte que distingue duas variações. */}
      <p
        className="mt-3 line-clamp-2 text-[15px] font-bold uppercase leading-snug text-foreground"
        title={leader.productName}
      >
        {leader.productName}
      </p>

      <p className={cn("mt-2 text-[28px] font-extrabold leading-none tracking-tight", cor.preco)}>
        {formatCurrency(leader.profit)}
      </p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{readPosition(leader)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ArchetypeBadge leader={leader} />
        <AlertBadge leader={leader} />
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <IconeDeTendencia className="mt-0.5 h-3 w-3 shrink-0" />
        {readArchetype(leader)}
      </p>

      {leader.history.length > 0 && (
        <div className={cn("mt-3", cor.tom)}>
          <ProfitSparkline
            history={leader.history}
            buckets={buckets}
            width={240}
            height={44}
            className="w-full"
            label={`Evolução do lucro de ${leader.productName} no período`}
          />
        </div>
      )}
    </div>
  );
}
