import * as React from "react";
import { Search } from "lucide-react";
import { Button, Card, Input, cn } from "@workspace/ui";
import type { ProfitArchetypeName, ProfitBucketDto, ProfitLeaderDto } from "@workspace/api-client-react";
import { BiCardHelp, BiCardHelpExample } from "@/components/bi-card-help";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import { ProfitRow } from "./ProfitRow";
import { ARCHETYPE_ICONS, ARCHETYPE_LABELS } from "../lib/profit-leaders";

/** Quantas linhas aparecem antes do "mostrar mais". */
const PAGINA = 20;

/** A ordem das pastilhas: o que pede ação primeiro, o que já está bem depois. */
const ORDEM_DOS_FILTROS: ProfitArchetypeName[] = ["Declining", "Newcomer", "Rising", "Workhorse", "Steady"];

type ProfitRankingProps = {
  leaders: ProfitLeaderDto[];
  buckets: ProfitBucketDto[];
  median: number;
  counts: Map<ProfitArchetypeName, number>;
  search: string;
  onSearchChange: (value: string) => void;
  archetype: ProfitArchetypeName | null;
  onToggleArchetype: (value: ProfitArchetypeName) => void;
  isFiltered: boolean;
  /** Muda quando o período muda, para a paginação recomeçar. */
  periodKey: string;
};

/**
 * O ranking do 1º ao último que compôs os 50%.
 *
 * <b>Filtrar não renumera.</b> A posição é do corte inteiro; a 12ª linha
 * continua sendo a 12ª dentro de um filtro, porque é isso que ela é. Renumerar
 * faria a busca inventar um ranking que não existe.
 */
export function ProfitRanking({
  leaders,
  buckets,
  median,
  counts,
  search,
  onSearchChange,
  archetype,
  onToggleArchetype,
  isFiltered,
  periodKey,
}: ProfitRankingProps) {
  const [limite, setLimite] = React.useState(PAGINA);

  // A paginação carrega junto TODO recorte a que pertence — inclusive o período,
  // que trocado traz outro conjunto e deixaria a lista expandida no limite do
  // anterior. Ajustado durante o RENDER, e não num efeito: o efeito só correria
  // depois de pintar a lista errada, e o React recomeça este sem commitar.
  const chave = `${periodKey}|${archetype ?? ""}|${search}`;
  const [chaveAnterior, setChaveAnterior] = React.useState(chave);
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setLimite(PAGINA);
  }

  const visiveis = leaders.slice(0, limite);

  return (
    <Card className="border-border/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            O ranking completo
          </h2>
          <BiCardHelp titulo="O ranking completo">
            <p>
              Do 1º ao último produto que, somados, fazem metade do lucro do período. Cada linha traz a conta
              que produziu a posição: <strong className="text-foreground/85">peças × lucro por peça</strong>.
            </p>
            <BiCardHelpExample>
              R$ 237,33 = 293 peças × R$ 0,81 de lucro cada — um produto de giro.
              <br />
              R$ 150,48 = 14 peças × R$ 10,75 de lucro cada — um produto de valor.
              <br />
              Os dois pesam quase o mesmo no ranking e pedem ações opostas: o primeiro não pode faltar; no
              segundo vale procurar variações e dar mais visibilidade.
            </BiCardHelpExample>
            <p>
              <strong className="text-foreground/85">Aqui não existe produto ruim.</strong> Todos chegaram ao
              corte. Os selos âmbar e vermelho não julgam o item: dizem o que olhar nele. Vermelho é reservado
              para quando queda forte e dinheiro parado se somam — se tudo que preocupa fosse vermelho, nada
              seria.
            </p>
            <p>
              O desenho à direita é o lucro por intervalo. O trecho{" "}
              <strong className="text-foreground/85">tracejado</strong> é um intervalo que ainda não fechou —
              em 30 dias, a última semana costuma ter dois dias. Sem a marca, o gráfico de todo produto
              terminaria num mergulho que não aconteceu.
            </p>
            <p>Filtrar não muda a posição: a 12ª linha continua sendo a 12ª dentro de uma busca.</p>
          </BiCardHelp>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(evento) => onSearchChange(evento.target.value)}
            placeholder="Buscar produto, código ou categoria"
            className="h-9 pl-8 text-[13px]"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ORDEM_DOS_FILTROS.filter((valor) => (counts.get(valor) ?? 0) > 0).map((valor) => {
          const Icon = ARCHETYPE_ICONS[valor];
          const ativo = archetype === valor;

          return (
            <button
              key={valor}
              type="button"
              onClick={() => onToggleArchetype(valor)}
              aria-pressed={ativo}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                ativo
                  ? "border-foreground/30 bg-foreground/10 text-foreground"
                  : BI_TONE_PILL.neutro + " hover:bg-muted/60",
              )}
            >
              <Icon className="h-3 w-3" />
              {ARCHETYPE_LABELS[valor]}
              <span className="text-muted-foreground">{counts.get(valor)}</span>
            </button>
          );
        })}
      </div>

      {leaders.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          {isFiltered
            ? "Nenhum campeão corresponde ao filtro."
            : "Nenhum produto deu lucro no período escolhido."}
        </p>
      ) : (
        <>
          <ul className="mt-3.5 flex flex-col gap-2">
            {visiveis.map((leader) => (
              <ProfitRow key={leader.productId} leader={leader} buckets={buckets} median={median} />
            ))}
          </ul>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11.5px] text-muted-foreground">
              {isFiltered
                ? `${leaders.length} de ${counts.size > 0 ? [...counts.values()].reduce((a, b) => a + b, 0) : 0} campeões no filtro`
                : `${leaders.length} ${leaders.length === 1 ? "produto compõe" : "produtos compõem"} metade do lucro`}
            </p>

            {limite < leaders.length && (
              <Button variant="outline" size="sm" onClick={() => setLimite((atual) => atual + PAGINA)}>
                Mostrar mais {Math.min(PAGINA, leaders.length - limite)}
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
