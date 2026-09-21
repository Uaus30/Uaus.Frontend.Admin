import { formatDateInput } from "@workspace/ui";
import type {
  ChangeStatusName,
  ComparisonDimension,
  EventKindName,
  RevenueFactorName,
} from "@workspace/api-client-react";
import { COMPARISON_DIMENSION } from "@workspace/api-client-react";
import type { BiTone } from "@/lib/bi-tone";
import { formatBrazilianDate } from "@/features/dashboard/utils";

/** Os dois intervalos que a tela compara, no formato que a API espera. */
export type ComparisonRange = {
  previousStartDate: string;
  previousEndDate: string;
  currentStartDate: string;
  currentEndDate: string;
  label: string;
};

export type ComparisonPreset = "30d" | "90d" | "mes" | "mesFechado";

export const COMPARISON_PRESET_LABELS: Record<ComparisonPreset, string> = {
  "30d": "30 dias vs 30 anteriores",
  "90d": "90 dias vs 90 anteriores",
  mes: "Este mês vs o mesmo trecho do passado",
  mesFechado: "Mês passado vs o anterior",
};

/**
 * O padrão da tela.
 *
 * Trinta dias contra trinta, e não os noventa das outras telas de BI: aqui o
 * período não classifica ninguém, é um dos lados de uma subtração — e noventa
 * contra noventa diluem justamente a mudança recente que a tela procura.
 */
export const DEFAULT_COMPARISON_PRESET: ComparisonPreset = "30d";

/**
 * Resolve o preset em quatro datas.
 *
 * A conversão passa por `formatDateInput`, nunca por `toISOString()`: o backend
 * compara datas no horário de Brasília, e uma data em UTC joga o dia para trás
 * (armadilha 2 do CLAUDE.md).
 */
export function resolveComparisonPreset(preset: ComparisonPreset, today = new Date()): ComparisonRange {
  const label = COMPARISON_PRESET_LABELS[preset];

  if (preset === "mes" || preset === "mesFechado") {
    return resolveMonthPreset(preset, today, label);
  }

  const days = preset === "30d" ? 30 : 90;

  const currentEnd = new Date(today);
  const currentStart = addDays(currentEnd, -(days - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    previousStartDate: formatDateInput(previousStart),
    previousEndDate: formatDateInput(previousEnd),
    currentStartDate: formatDateInput(currentStart),
    currentEndDate: formatDateInput(currentEnd),
    label,
  };
}

/**
 * Os dois presets de mês.
 *
 * **"Este mês" corta os DOIS lados no mesmo número de dias.** Cortar só o lado
 * de referência era o defeito: em 31/03 a tela comparava 01/03–31/03 (31 dias)
 * com 01/02–28/02 (28 dias) e anunciava como crescimento os três dias de venda a
 * mais — cerca de R$ 1.000 no ritmo desta loja, que a ponte ainda creditava a
 * "dias abertos". Acontecia em 7 a 8 dias por ano: 29 a 31/03 contra fevereiro,
 * e todo dia 31 contra mês de 30.
 *
 * O corte é `min(dia de hoje, último dia do mês anterior)`, e por isso o período
 * em análise pode não chegar até hoje. As duas datas ficam escritas no cabeçalho
 * justamente para isso não passar despercebido.
 */
function resolveMonthPreset(preset: "mes" | "mesFechado", today: Date, label: string): ComparisonRange {
  if (preset === "mesFechado") {
    const currentStart = startOfMonth(addMonths(today, -1));
    const currentEnd = endOfMonth(currentStart);
    const previousStart = startOfMonth(addMonths(currentStart, -1));

    return {
      previousStartDate: formatDateInput(previousStart),
      previousEndDate: formatDateInput(endOfMonth(previousStart)),
      currentStartDate: formatDateInput(currentStart),
      currentEndDate: formatDateInput(currentEnd),
      label,
    };
  }

  const currentStart = startOfMonth(today);
  const previousStart = startOfMonth(addMonths(today, -1));

  const dias = Math.min(today.getDate(), endOfMonth(previousStart).getDate());

  const currentEnd = new Date(currentStart);
  currentEnd.setDate(dias);

  const previousEnd = new Date(previousStart);
  previousEnd.setDate(dias);

  return {
    previousStartDate: formatDateInput(previousStart),
    previousEndDate: formatDateInput(previousEnd),
    currentStartDate: formatDateInput(currentStart),
    currentEndDate: formatDateInput(currentEnd),
    label,
  };
}

/**
 * Acomoda o intervalo que o usuário NÃO mexeu, para os dois nunca se cruzarem
 * nem inverterem de ordem.
 *
 * Chamada sempre que ele mexe num dos dois calendários. Sem ela, mexer primeiro
 * no calendário "Depois" — metade das ordens naturais de edição — produzia
 * intervalos sobrepostos, a API recusava com 400 e **todos os blocos da tela
 * sumiam**, sem dizer que quem precisava mudar era o outro calendário.
 *
 * **O lado que acabou de ser escolhido é lei sempre que couber**, e por isso a
 * função precisa saber qual foi: uma normalização que só ordena os dois pela data
 * acabava transformando o período que o usuário escolheu para ANALISAR no período
 * de REFERÊNCIA — resposta correta para outra pergunta.
 *
 * A exceção é mexer no "Antes" sem espaço à frente para o "Depois" caber inteiro.
 * Aí os **papéis trocam**: o intervalo escolhido é o mais recente dos dois, logo é
 * ele o que está em análise, e a referência recua para os dias anteriores. Encaixar
 * o "Depois" no espaço que sobrou seria pior — escolher um "Antes" que termina
 * ontem produzia uma comparação de 30 dias contra **um** dia parcial, com a tela
 * anunciando −97% e a ponte creditando a queda a "dias abertos": verdadeiro,
 * inútil, e inventado pela normalização, não pela escolha de quem lê.
 *
 * O label vira "Períodos ajustados..." quando os papéis trocam, porque o
 * calendário que a pessoa estava operando passa a mostrar outro intervalo.
 */
export function normalizeRange(
  range: ComparisonRange,
  fixo: "previous" | "current",
  hoje = new Date(),
): ComparisonRange {
  const { previousStartDate, previousEndDate, currentStartDate, currentEndDate } = range;

  if (previousEndDate < currentStartDate) return range;

  const hojeIso = formatDateInput(hoje);

  // Mexeu no "Depois": a referência recua para terminar na véspera dele. Esta
  // direção nunca produz data futura — só anda para trás.
  if (fixo === "current") {
    const duracao = diffDays(previousStartDate, previousEndDate);
    const fim = addDays(parseIsoDate(currentStartDate), -1);

    return {
      ...range,
      previousEndDate: formatDateInput(fim),
      previousStartDate: formatDateInput(addDays(fim, -duracao)),
    };
  }

  // Mexeu no "Antes": o período em análise vai para a frente dele — mas NUNCA
  // além de hoje. Os dois calendários têm `maxDate` em hoje justamente para o
  // usuário não escolher data futura; deixar a normalização criá-la faria a tela
  // anunciar −100% e nomear a "causa" de um período que ainda não aconteceu.
  const inicio = formatDateInput(addDays(parseIsoDate(previousEndDate), 1));
  const duracao = diffDays(currentStartDate, currentEndDate);

  // Cabe inteiro à frente? Só então o "Depois" anda. Encolhê-lo para caber no
  // que sobrou é o penhasco: um dia a mais na escolha do "Antes" separava uma
  // comparação de 30 dias contra 30 de uma de 30 contra 1.
  if (inicio <= hojeIso && diffDays(inicio, hojeIso) >= duracao) {
    return {
      ...range,
      currentStartDate: inicio,
      currentEndDate: formatDateInput(addDays(parseIsoDate(inicio), duracao)),
    };
  }

  // Não coube: o intervalo escolhido é o mais recente dos dois, então é ELE o
  // período em análise, e a referência recua para os dias imediatamente
  // anteriores, com a duração que tinha.
  return {
    ...range,
    previousStartDate: formatDateInput(addDays(parseIsoDate(previousStartDate), -(duracao + 1))),
    previousEndDate: formatDateInput(addDays(parseIsoDate(previousStartDate), -1)),
    currentStartDate: previousStartDate,
    currentEndDate: previousEndDate,
    label: "Períodos ajustados para caberem no calendário",
  };
}

/** Dias entre duas datas `yyyy-MM-dd`, sem passar por fuso. */
function diffDays(inicio: string, fim: string): number {
  return Math.round((parseIsoDate(fim).getTime() - parseIsoDate(inicio).getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * `yyyy-MM-dd` para `Date` local.
 *
 * `new Date("2026-09-01")` seria interpretado como UTC e voltaria um dia no
 * Brasil — a mesma armadilha do `toISOString()`, na direção contrária.
 */
function parseIsoDate(value: string): Date {
  const [ano, mes, dia] = value.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/** O intervalo escrito em português, para o cabeçalho. */
export function describeRange(start: string, end: string): string {
  return `${formatBrazilianDate(start)} a ${formatBrazilianDate(end)}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return result;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// ------------------------------------------------------------------ rótulos

export const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  [COMPARISON_DIMENSION.Category]: "Categoria",
  [COMPARISON_DIMENSION.Department]: "Departamento",
  [COMPARISON_DIMENSION.Product]: "Produto",
  [COMPARISON_DIMENSION.Supplier]: "Fornecedor",
};

/**
 * O plural e o gênero de cada dimensão, escritos à mão.
 *
 * Existe porque `${rotulo}s` produzia "outras **fornecedors**" e "a mesma
 * **produto**" — errado em três das quatro dimensões, no painel e no manual.
 * Português não pluraliza por concatenação, e estas são quatro palavras: uma
 * tabela é mais barata que uma regra.
 */
export const DIMENSION_WORDS: Record<
  ComparisonDimension,
  { singular: string; plural: string; artigoOutras: string; artigoMesma: string }
> = {
  [COMPARISON_DIMENSION.Category]: {
    singular: "categoria",
    plural: "categorias",
    artigoOutras: "outras",
    artigoMesma: "a mesma",
  },
  [COMPARISON_DIMENSION.Department]: {
    singular: "departamento",
    plural: "departamentos",
    artigoOutras: "outros",
    artigoMesma: "o mesmo",
  },
  [COMPARISON_DIMENSION.Product]: {
    singular: "produto",
    plural: "produtos",
    artigoOutras: "outros",
    artigoMesma: "o mesmo",
  },
  [COMPARISON_DIMENSION.Supplier]: {
    singular: "fornecedor",
    plural: "fornecedores",
    artigoOutras: "outros",
    artigoMesma: "o mesmo",
  },
};

/** Nome curto de cada fator da ponte — o que a barra leva ao lado. */
export const FACTOR_LABELS: Record<RevenueFactorName, string> = {
  OpenDays: "Dias abertos",
  SalesPerDay: "Cupons por dia",
  UnitsPerSale: "Peças por cupom",
  RevenuePerUnit: "Valor por peça",
  Unattributed: "Venda sem item",
};

/** O que cada fator quer dizer, em uma linha, dentro da própria barra. */
export const FACTOR_MEANING: Record<RevenueFactorName, string> = {
  OpenDays: "quantos dias a loja vendeu",
  SalesPerDay: "o movimento: quantas pessoas passaram no caixa",
  UnitsPerSale: "o tamanho da cesta",
  RevenuePerUnit: "o valor do que sai da prateleira",
  Unattributed: "cobrado sem item no sistema — defeito de dado, não de venda",
};

/** Como o fator é escrito: dias e cupons são contagem, o resto é dinheiro. */
export const FACTOR_KIND: Record<RevenueFactorName, "inteiro" | "decimal" | "moeda"> = {
  OpenDays: "inteiro",
  SalesPerDay: "decimal",
  UnitsPerSale: "decimal",
  RevenuePerUnit: "moeda",
  Unattributed: "moeda",
};

export const STATUS_LABELS: Record<ChangeStatusName, string> = {
  Grew: "Cresceu",
  Shrank: "Encolheu",
  Entered: "Entrou",
  Left: "Saiu",
  Stable: "Estável",
};

export const EVENT_LABELS: Record<EventKindName, string> = {
  Vanished: "Carregava e sumiu",
  Emerged: "Apareceu e carregou",
};

/**
 * A cor de uma variação em reais.
 *
 * Verde para cima e vermelho para baixo, o vocabulário do sistema inteiro
 * (`Uaus.Docs/dominio/convencoes-de-interface.md`). O zero é neutro de
 * propósito: pintar o que não mudou gasta o contraste que faz os extremos
 * saltarem, e é justamente o extremo que esta tela existe para mostrar.
 */
export function deltaTone(value: number): BiTone {
  if (value > 0) return "bom";
  if (value < 0) return "ruim";
  return "neutro";
}

/**
 * A cor do status da linha.
 *
 * "Saiu" é vermelho mesmo quando a perda é pequena, e "entrou" é verde mesmo
 * quando o ganho é: os dois falam de SORTIMENTO, não de resultado — uma linha
 * que some do catálogo é uma decisão a revisar, e ela não aparece em nenhum
 * ranking por valor.
 */
export function statusTone(status: ChangeStatusName): BiTone {
  switch (status) {
    case "Grew":
    case "Entered":
      return "bom";
    case "Shrank":
    case "Left":
      return "ruim";
    default:
      return "neutro";
  }
}
