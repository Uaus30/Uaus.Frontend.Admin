import type { ProductPerformanceItemDto } from "@workspace/api-client-react";
import { margemDaLinha } from "./performance";

/**
 * A ordenação manual das duas tabelas de ranking.
 *
 * <b>A ordem que chega do servidor é a nota</b>, e ela é a resposta da tela: os
 * piores sobem da menor nota para a maior, os melhores descem da maior para a
 * menor. Clicar num cabeçalho não troca a pergunta, troca o ângulo — "e se eu
 * olhar pelo dinheiro parado?", "e pelo que dura mais tempo?" —, e por isso a
 * ordenação é LOCAL, sobre as cem linhas que já chegaram classificadas.
 *
 * Pedir ao servidor uma ordem diferente traria outras cem linhas e mudaria o
 * conjunto debaixo do leitor: quem clicou em "Em risco" para ver o dinheiro dos
 * cem piores veria os cem produtos de maior capital em risco da loja, que é
 * outra lista.
 *
 * A coluna `#` continua sendo a posição por NOTA, mesmo com a tabela ordenada
 * por outra coisa. É informação: um `#47` no topo da ordem por estoque diz que
 * aquele produto não está entre os piores pela nota, mas é o que mais ocupa
 * prateleira.
 */

/** As colunas que respondem ao clique. As outras são rótulo, não medida. */
export type RankingSortColumn =
  "produto" | "nota" | "risco" | "vendidos" | "faturamento" | "margem" | "estoque" | "dura";

export type SortDir = "asc" | "desc";

export type RankingSort = {
  coluna: RankingSortColumn;
  direcao: SortDir;
};

/**
 * O número que cada coluna ordena — o MESMO que a linha desenha.
 *
 * Ordenar por um valor que a tela não mostra é a maneira mais rápida de a
 * tabela parecer quebrada: quem clica em "Estoque" está comparando as unidades
 * que está lendo, não o custo que mora no `title`.
 */
const VALOR: Record<Exclude<RankingSortColumn, "produto">, (item: ProductPerformanceItemDto) => number> = {
  nota: (item) => item.score,
  risco: (item) => item.capitalAtRisk,
  vendidos: (item) => item.units,
  faturamento: (item) => item.revenue,

  // A mesma regra que a célula desenha: realizada para quem vendeu, de entrada
  // para quem não vendeu. Ordenar por `item.margin` cru mandaria todo produto
  // parado para o zero, misturando "não vendeu" com "vendeu no empate".
  margem: (item) => margemDaLinha(item).valor ?? 0,

  estoque: (item) => item.stock,

  // "Dura" tem duas pontas que não são número de dias, e as duas são leitura da
  // própria célula: esgotado já acabou (zero), e sem giro não acaba nunca.
  dura: (item) => (item.stock <= 0 ? 0 : (item.coverageDays ?? Number.POSITIVE_INFINITY)),
};

/**
 * Linha sem valor NENHUM para a coluna — vai para o fim nas duas direções.
 *
 * Só a margem tem esse caso, e ele ficou raro: sobra o produto que não vendeu
 * E não tem preço de venda cadastrado, o único em que nem a margem realizada
 * nem a de entrada existem. A célula mostra "—", e ordenar o traço como 0% o
 * misturaria com quem vendeu no empate.
 */
function semValor(item: ProductPerformanceItemDto, coluna: RankingSortColumn): boolean {
  return coluna === "margem" && margemDaLinha(item).valor === null;
}

/** Para que lado a coluna abre no PRIMEIRO clique — a ponta interessante primeiro. */
const DIRECAO_PADRAO: Record<RankingSortColumn, SortDir> = {
  produto: "asc",
  nota: "desc",
  risco: "desc",
  vendidos: "desc",
  faturamento: "desc",
  margem: "desc",
  estoque: "desc",
  dura: "desc",
};

/**
 * A direção do primeiro clique.
 *
 * A nota é a única que depende da tabela, e é o motivo de o parâmetro existir:
 * nos piores, "pior primeiro" é ordem CRESCENTE. Fixar `desc` para as duas
 * faria a lista dos piores abrir pelo menos pior.
 */
export function direcaoInicial(coluna: RankingSortColumn, melhores: boolean): SortDir {
  if (coluna === "nota") return melhores ? "desc" : "asc";
  return DIRECAO_PADRAO[coluna];
}

/** O clique: alterna a direção quando já é a coluna ativa, senão abre a nova. */
export function proximaOrdem(atual: RankingSort, coluna: RankingSortColumn, melhores: boolean): RankingSort {
  if (atual.coluna !== coluna) return { coluna, direcao: direcaoInicial(coluna, melhores) };
  return { coluna, direcao: atual.direcao === "asc" ? "desc" : "asc" };
}

/**
 * Ordena uma cópia da lista.
 *
 * O desempate é a posição de ORIGEM, e é o que torna a ordenação estável: em
 * "Nota" na direção padrão ela devolve exatamente a ordem que o servidor
 * numerou — inclusive entre as linhas que dividem a mesma nota, que o servidor
 * já desempatou por capital em risco e por nome. Sem isso, reordenar pela
 * coluna que já está ativa embaralharia empates sem motivo visível.
 */
export function ordenarRanking(
  produtos: ProductPerformanceItemDto[],
  { coluna, direcao }: RankingSort,
): ProductPerformanceItemDto[] {
  const sinal = direcao === "asc" ? 1 : -1;

  return produtos
    .map((produto, posicao) => ({ produto, posicao }))
    .sort((a, b) => {
      const faltaEmA = semValor(a.produto, coluna);
      const faltaEmB = semValor(b.produto, coluna);
      if (faltaEmA !== faltaEmB) return faltaEmA ? 1 : -1;

      const diferenca = comparar(a.produto, b.produto, coluna) * sinal;
      return diferenca === 0 ? a.posicao - b.posicao : diferenca;
    })
    .map(({ produto }) => produto);
}

function comparar(
  a: ProductPerformanceItemDto,
  b: ProductPerformanceItemDto,
  coluna: RankingSortColumn,
): number {
  if (coluna === "produto") {
    // `localeCompare` com a base do português: "ÁGUA" fica junto de "agua", e
    // não depois de "Z" como faria a comparação por código de caractere.
    return a.productName.localeCompare(b.productName, "pt-BR", { sensitivity: "base" });
  }

  const valorA = VALOR[coluna](a);
  const valorB = VALOR[coluna](b);

  // Subtrair daria `NaN` entre dois "sem giro" (Infinity − Infinity) e o
  // resultado da ordenação passaria a depender do motor do navegador.
  if (valorA === valorB) return 0;
  return valorA < valorB ? -1 : 1;
}
