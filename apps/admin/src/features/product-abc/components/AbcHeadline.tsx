import { Card, cn } from "@workspace/ui";
import type { ProductAbcSummaryDto } from "@workspace/api-client-react";
import { formatPercent } from "@/features/supplier-performance/lib/format";
import { readConcentration, readConcentrationIndex } from "../lib/abc";

type AbcHeadlineProps = {
  summary: ProductAbcSummaryDto;
  /** Nome do critério em português, para a frase dizer de que resultado se fala. */
  criterionLabel: string;
};

/** Onde a régua começa e termina — 10% a 60% dos produtos para os 80% do valor. */
const ESCALA_MIN = 10;
const ESCALA_MAX = 60;

/** A posição da regra clássica na régua, em percentual da largura. */
const PARETO = 20;

/**
 * A leitura que dá nome à tela.
 *
 * A regra de Pareto diz que 20% dos produtos fazem 80% do valor. Quase nenhuma
 * loja é exatamente isso — e a distância entre o previsto e o medido é a
 * informação, não um erro de medição. Por isso a tela mostra o número da loja em
 * tamanho de manchete e marca onde a regra clássica cairia, em vez de repetir
 * "80/20" como se fosse verdade.
 */
export function AbcHeadline({ summary, criterionLabel }: AbcHeadlineProps) {
  const leitura = readConcentration(summary.shareOfProductsForEightyPercent);

  const posicao = Math.max(
    0,
    Math.min(100, ((summary.shareOfProductsForEightyPercent - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)) * 100),
  );
  const posicaoPareto = ((PARETO - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)) * 100;

  return (
    <Card className="border-border/60 p-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              "text-[52px] font-semibold leading-none tracking-tight",
              leitura.tom === "concentrada" && "text-orange-400",
              leitura.tom === "pareto" && "text-primary",
              leitura.tom === "distribuida" && "text-sky-400",
            )}
          >
            {leitura.titulo}
          </span>
          <span className="text-sm text-muted-foreground">
            produtos
            <br />
            para {criterionLabel.toLowerCase()}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] leading-relaxed text-foreground/85">{leitura.frase}</p>

          {/* A régua: onde a loja cai entre uma cauda curta e uma cauda longa,
              com a regra clássica marcada para a comparação ser visual.

              O rótulo da regra vai ACIMA da barra, e os das pontas abaixo: os
              20% caem perto da ponta esquerda da escala, e os três na mesma
              linha se sobrepõem. */}
          <div className="mt-5">
            <div className="relative mb-1 h-4 text-[10.5px] text-muted-foreground">
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${posicaoPareto}%` }}
              >
                regra 20/80
              </span>
            </div>

            <div className="relative h-2 rounded-full bg-gradient-to-r from-orange-500/40 via-primary/30 to-sky-500/40">
              <span
                className="absolute -top-1 h-4 w-px bg-muted-foreground/70"
                style={{ left: `${posicaoPareto}%` }}
                aria-hidden
              />
              <span
                className="absolute -top-1.5 h-5 w-1.5 rounded-full bg-foreground shadow"
                style={{ left: `calc(${posicao}% - 3px)` }}
                aria-hidden
              />
            </div>

            <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
              <span>{ESCALA_MIN}% · poucos campeões</span>
              <span>{ESCALA_MAX}% · cauda longa</span>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-border/50 xl:border-l xl:pl-6">
          <Numero rotulo="os 20% maiores fazem" valor={formatPercent(summary.shareFromTopFifthOfProducts)} />
          <Numero
            rotulo="concentração"
            valor={summary.concentrationIndex.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            nota={readConcentrationIndex(summary.concentrationIndex)}
          />
        </dl>
      </div>
    </Card>
  );
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 text-xl font-semibold tracking-tight">{valor}</dd>
      {nota && <dd className="text-[11px] text-muted-foreground">{nota}</dd>}
    </div>
  );
}
