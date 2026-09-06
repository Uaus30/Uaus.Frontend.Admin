import { formatCurrency } from "@workspace/core";
import type { SupplierPerformanceDto, SupplierPerformanceParametersDto } from "@workspace/api-client-react";
import { formatDaysAgo, formatPercent, plural } from "./format";

/** Um motivo pronto para virar chip na linha do ranking. */
export interface MotivoDaNota {
  tipo: "bom" | "ruim";
  texto: string;
  /**
   * O quanto o fato DESTOA da loja. É a ordem de exibição — e não o valor
   * absoluto do componente. Sem isso, "margem 0,5 pp acima da média" virava
   * manchete numa linha que tinha 262 dias de estoque parado para contar.
   */
  peso: number;
}

/** Quantos motivos cabem na linha sem virar parede de texto. */
const MAX_MOTIVOS = 3;

/**
 * Por que este fornecedor está onde está — em português, não em nota.
 *
 * A listagem mostrava as quatro notas parciais como números soltos
 * (`margem 58`) ao lado da margem real (`42,2%`), e as duas coisas com o mesmo
 * nome e valores diferentes só confundiam. As notas parciais continuam
 * existindo, mas na tela de detalhe, onde há espaço para dizer de onde saem.
 */
export function motivosDaNota(
  fornecedor: SupplierPerformanceDto,
  parametros: SupplierPerformanceParametersDto,
  posicaoNoLucro: number,
  totalDeAtivos: number,
): MotivoDaNota[] {
  if (fornecedor.sales === 0) {
    return [
      {
        tipo: "ruim",
        peso: Number.MAX_SAFE_INTEGER,
        texto:
          fornecedor.stockCost > 0
            ? `Nenhuma venda no período · ${formatCurrency(fornecedor.stockCost)} parados em ${plural(fornecedor.stockUnits, "unidade", "unidades")}`
            : `Nenhuma venda e nenhum estoque no período · última venda ${formatDaysAgo(fornecedor.daysWithoutSelling)}`,
      },
    ];
  }

  const lista: MotivoDaNota[] = [];

  const deltaMargem = fornecedor.margin - parametros.storeMargin;
  lista.push({
    tipo: deltaMargem >= 0 ? "bom" : "ruim",
    peso: Math.abs(deltaMargem) * 4,
    texto:
      deltaMargem >= 0
        ? `Margem de ${formatPercent(fornecedor.margin)}, ${formatPercent(Math.abs(deltaMargem))
            .replace("%", "")
            .trim()} pp acima da média da loja`
        : `Margem de ${formatPercent(fornecedor.margin)}, ${formatPercent(Math.abs(deltaMargem))
            .replace("%", "")
            .trim()} pp abaixo da média da loja`,
  });

  const deltaMix = fornecedor.hitRate - parametros.storeHitRate;
  lista.push({
    tipo: deltaMix >= 0 ? "bom" : "ruim",
    peso: Math.abs(deltaMix) * 1.5,
    texto: `${deltaMix >= 0 ? "" : "Só "}${formatPercent(fornecedor.hitRate, 0)} dos produtos vendem com boa margem (${fornecedor.goodProducts} de ${fornecedor.judgedProducts}) — a loja gira ${formatPercent(parametros.storeHitRate, 0)}`,
  });

  if (fornecedor.coverageDays !== null) {
    const rapido = fornecedor.scoreBreakdown.turnover >= 60;
    const dias = Math.round(fornecedor.coverageDays);
    lista.push({
      tipo: rapido ? "bom" : "ruim",
      // A mesma régua da nota, e não um corte próprio: com um limite separado, o
      // fornecedor de melhor giro da loja aparecia com aviso vermelho por estar
      // onze dias acima da linha.
      peso: Math.min(
        55,
        (Math.abs(dias - parametros.healthyCoverageDays) / parametros.healthyCoverageDays) * 25,
      ),
      texto: rapido
        ? `Estoque escoa em ${dias} dias no ritmo atual`
        : `${dias} dias para escoar o estoque atual`,
    });
  }

  if (posicaoNoLucro <= 3) {
    lista.push({
      tipo: "bom",
      peso: 45 - posicaoNoLucro * 5,
      texto: `${formatCurrency(fornecedor.profit)} de lucro no período — ${posicaoNoLucro}º maior da loja`,
    });
  } else if (fornecedor.scoreBreakdown.result < 60) {
    lista.push({
      tipo: "ruim",
      peso: 20 + (posicaoNoLucro / Math.max(1, totalDeAtivos)) * 20,
      texto: `${formatCurrency(fornecedor.profit)} de lucro — ${formatPercent(fornecedor.scoreBreakdown.result, 0)} do lucro médio por fornecedor`,
    });
  }

  if (fornecedor.stalledProducts > 0 && fornecedor.stalledStockCost > 0) {
    lista.push({
      tipo: "ruim",
      peso: (fornecedor.stalledStockCost / Math.max(1, fornecedor.stockCost)) * 60,
      texto: `${formatCurrency(fornecedor.stalledStockCost)} parados em ${plural(fornecedor.stalledProducts, "produto", "produtos")} sem venda no período`,
    });
  }

  if (fornecedor.daysWithoutSelling !== null && fornecedor.daysWithoutSelling > 14) {
    lista.push({
      tipo: "ruim",
      peso: fornecedor.daysWithoutSelling,
      texto: `Sem vender ${formatDaysAgo(fornecedor.daysWithoutSelling)}`,
    });
  }

  if (fornecedor.repricedProducts > 0 && fornecedor.averageCostIncreasePercent) {
    lista.push({
      tipo: "ruim",
      peso: Math.min(
        60,
        (fornecedor.repricedProducts / Math.max(1, fornecedor.judgedProducts)) *
          100 *
          (fornecedor.averageCostIncreasePercent / 10),
      ),
      texto: `${plural(fornecedor.repricedProducts, "produto subiu", "produtos subiram")} de custo na última compra (média +${formatPercent(fornecedor.averageCostIncreasePercent, 0)})`,
    });
  }

  return escolherOsDoisLados(lista);
}

/**
 * Os três motivos mais notáveis, garantindo os dois lados quando os dois
 * existem: um fornecedor bom com três avisos vermelhos passa a impressão errada,
 * e um ruim com três elogios também.
 */
function escolherOsDoisLados(lista: MotivoDaNota[]): MotivoDaNota[] {
  const ordenada = [...lista].sort((a, b) => b.peso - a.peso);
  const escolhidos = ordenada.slice(0, MAX_MOTIVOS);

  const faltando = (["bom", "ruim"] as const).find(
    (tipo) => !escolhidos.some((m) => m.tipo === tipo) && ordenada.some((m) => m.tipo === tipo),
  );

  if (faltando && escolhidos.length === MAX_MOTIVOS) {
    escolhidos[MAX_MOTIVOS - 1] = ordenada.find((m) => m.tipo === faltando)!;
  }

  return escolhidos;
}
