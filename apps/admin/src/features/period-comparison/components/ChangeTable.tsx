import * as React from "react";
import { Search, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  cn,
} from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ComparisonDimension, DimensionChangeDto } from "@workspace/api-client-react";
import { BiColumnHeader } from "@/components/bi-column-header";
import { BiCardHelp, BiCardHelpExample } from "@/components/bi-card-help";
import { BI_TONE_PILL, BI_TONE_TEXT } from "@/lib/bi-tone";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { DIMENSION_LABELS, STATUS_LABELS, deltaTone, statusTone } from "../lib/comparison";
import type { ChangeSort } from "../hooks/usePeriodComparison";

/**
 * Quantas linhas por vez.
 *
 * A API devolve no máximo 61 (60 mais o balde "outras N"), então a paginação
 * existe para caber na tela, não para segurar volume.
 */
const PAGINA = 40;

/** O manual deste cartão. */
function ChangesHelp({ rotulo }: { rotulo: string }) {
  return (
    <BiCardHelp titulo="Quem mudou">
      <p>
        A mesma diferença do topo da tela, agora repartida entre as {rotulo}s.{" "}
        <strong className="text-foreground/85">A coluna Δ soma exatamente essa diferença</strong> — é isso que
        separa esta tabela de um ranking: um ranking mostra os maiores, esta mostra todos os reais, até o
        último centavo.
      </p>

      <p>
        A ordem padrão é <strong className="text-foreground/85">da maior perda para o maior ganho</strong>, ao
        contrário de todo ranking do sistema. A pergunta que traz alguém aqui quase sempre é sobre o que
        faltou. Clique em qualquer cabeçalho para reordenar.
      </p>

      <BiCardHelpExample>
        <p>
          Uma {rotulo} que caiu de R$ 2.234 para R$ 351 aparece com{" "}
          <strong className="text-foreground/85">Δ −R$ 1.883</strong>. A coluna{" "}
          <strong className="text-foreground/85">valor por peça</strong> ao lado é o que separa duas situações
          muito diferentes: vender menos peças, ou vender as mesmas mais barato.
        </p>
      </BiCardHelpExample>

      <p>
        <strong className="text-foreground/85">Situação</strong> fala de sortimento, não de resultado: "Saiu"
        é a linha que parou de vender; "Entrou", a que começou. As duas merecem uma olhada mesmo quando o
        valor é pequeno — não aparecem em nenhum ranking por dinheiro.
      </p>

      <p>
        Linhas em <em>itálico</em> são agrupamentos, não {rotulo}s: "Outras N linhas" é o que não coube nas 60
        maiores variações, e "Sem item identificado" é faturamento cobrado sem produto por trás (defeito de
        dado das vendas migradas do Mais PDV). Ficam visíveis para a coluna continuar fechando.
      </p>

      <p>
        <strong className="text-foreground/85">Com a busca ativa a soma deixa de valer</strong> — o cabeçalho
        avisa. Filtrada, a coluna soma só o que está na tela.
      </p>
    </BiCardHelp>
  );
}

type ChangeTableProps = {
  changes: DimensionChangeDto[];
  dimension: ComparisonDimension;
  search: string;
  onSearchChange: (value: string) => void;
  sort: ChangeSort;
  onSort: (coluna: ChangeSort["coluna"]) => void;
  /** Identifica o recorte de datas em vigor — entra no reset da paginação. */
  periodKey: string;
};

/**
 * Bloco 2 — quem mudou: a mesma diferença repartida entre as linhas da
 * dimensão, da maior perda para o maior ganho.
 *
 * A ordem padrão é crescente pelo Δ, ou seja, <b>a maior perda no topo</b>. É o
 * contrário de todo ranking do sistema, e de propósito: a pergunta que traz
 * alguém a esta tela quase sempre é sobre o que faltou.
 */
export function ChangeTable({
  changes,
  dimension,
  search,
  onSearchChange,
  sort,
  onSort,
  periodKey,
}: ChangeTableProps) {
  const [limite, setLimite] = React.useState(PAGINA);
  const rotulo = DIMENSION_LABELS[dimension];

  // A paginação carrega junto TODO recorte a que pertence — inclusive o período,
  // que ficara de fora: trocar as datas trazia outro conjunto de linhas e a
  // tabela continuava expandida no limite do conjunto anterior.
  const chave = `${dimension}|${search}|${sort.coluna}|${sort.ordem}|${periodKey}`;
  const [chaveAnterior, setChaveAnterior] = React.useState(chave);
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setLimite(PAGINA);
  }

  const visiveis = changes.slice(0, limite);
  const linhasReais = changes.filter((linha) => !linha.isBucket).length;

  function ordem(coluna: ChangeSort["coluna"]) {
    return sort.coluna === coluna ? sort.ordem : null;
  }

  return (
    <Card className="border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-[15px] font-semibold">Quem mudou</h2>
            <ChangesHelp rotulo={rotulo.toLowerCase()} />
          </div>
          {/* A promessa da soma vale para a lista INTEIRA. Repeti-la com a busca
              ativa era afirmar o contrário do que a tela mostra: filtrada, a
              coluna soma um subconjunto — e é justamente aí que alguém confere. */}
          {/* A contagem exclui os baldes: "Sem item identificado" e "Outras N
              linhas" não são categorias, e contá-los como tal faz o total da tela
              discordar do catálogo. */}
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {formatInteger(linhasReais)} {linhasReais === 1 ? "linha" : "linhas"} por {rotulo.toLowerCase()}
            {search.trim()
              ? " — filtrado: a coluna Δ soma só o que está na busca"
              : " — a soma da coluna Δ é a diferença do período"}
          </p>
        </div>

        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(evento) => onSearchChange(evento.target.value)}
            placeholder={`Buscar ${rotulo.toLowerCase()}...`}
            className="h-9 bg-background pl-9 pr-8"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange("")}
              aria-label="Limpar a busca"
              className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <BiColumnHeader className="min-w-[220px]">{rotulo}</BiColumnHeader>
              <BiColumnHeader
                alinhamento="right"
                dica="Faturamento no período de referência."
                onOrdenar={() => onSort("previousRevenue")}
                ordem={ordem("previousRevenue")}
              >
                Antes
              </BiColumnHeader>
              <BiColumnHeader
                alinhamento="right"
                dica="Faturamento no período em análise."
                onOrdenar={() => onSort("currentRevenue")}
                ordem={ordem("currentRevenue")}
              >
                Depois
              </BiColumnHeader>
              <BiColumnHeader
                alinhamento="right"
                dica="Quanto esta linha somou ou tirou do faturamento. É o que a tela reparte."
                onOrdenar={() => onSort("delta")}
                ordem={ordem("delta")}
              >
                Δ em reais
              </BiColumnHeader>
              <BiColumnHeader
                alinhamento="right"
                dica="Peças vendidas no período em análise."
                onOrdenar={() => onSort("currentUnits")}
                ordem={ordem("currentUnits")}
              >
                Peças
              </BiColumnHeader>
              <BiColumnHeader
                alinhamento="right"
                dica="Faturamento dividido pelas peças da linha, nos dois períodos. Separa vender menos de vender mais barato."
                onOrdenar={() => onSort("currentAveragePrice")}
                ordem={ordem("currentAveragePrice")}
              >
                Valor por peça
              </BiColumnHeader>
              <BiColumnHeader alinhamento="center">Situação</BiColumnHeader>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.map((linha) => {
              const tone = deltaTone(linha.revenueDelta);

              return (
                <TableRow key={`${linha.id ?? "residual"}-${linha.name}`}>
                  <TableCell className="min-w-[220px]">
                    {/* Balde não é linha da dimensão: sem o itálico, "Outras 45
                        linhas" ordenado por faturamento sobe ao topo com a cara
                        da maior categoria da loja. */}
                    <p
                      className={cn(
                        "truncate text-[13px] font-medium",
                        linha.isBucket && "italic text-muted-foreground",
                      )}
                    >
                      {linha.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatPercent(linha.previousShare, 1)} → {formatPercent(linha.currentShare, 1)} do
                      faturamento
                    </p>
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(linha.previousRevenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(linha.currentRevenue)}
                  </TableCell>

                  <TableCell className={cn("text-right font-semibold tabular-nums", BI_TONE_TEXT[tone])}>
                    {linha.revenueDelta > 0 ? "+" : ""}
                    {formatCurrency(linha.revenueDelta)}
                    {linha.revenueDeltaPercentage != null && (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        ({formatPercent(linha.revenueDeltaPercentage, 0)})
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatInteger(linha.previousUnits)} → {formatInteger(linha.currentUnits)}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {linha.previousUnits > 0 ? formatCurrency(linha.previousAveragePrice) : "—"}
                    {" → "}
                    {linha.currentUnits > 0 ? formatCurrency(linha.currentAveragePrice) : "—"}
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={cn("text-[11px]", BI_TONE_PILL[statusTone(linha.status)])}
                    >
                      {STATUS_LABELS[linha.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {limite < changes.length && (
        <div className="flex justify-center border-t border-border/60 p-3">
          <Button variant="outline" size="sm" onClick={() => setLimite((atual) => atual + PAGINA)}>
            Mostrar mais ({formatInteger(changes.length - limite)} restantes)
          </Button>
        </div>
      )}

      {changes.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma linha para este recorte.</p>
      )}
    </Card>
  );
}
