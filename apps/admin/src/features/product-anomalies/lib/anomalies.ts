import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CircleDollarSign,
  Copy,
  EyeOff,
  FilePen,
  Ghost,
  Hourglass,
  ImageMinus,
  ImageOff,
  PackageX,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { formatCurrency, formatQuantity, formatShortDate } from "@workspace/core";
import type {
  ProductAnomalyDto,
  ProductAnomalyRowDto,
  ProductAnomalyTypeName,
} from "@workspace/api-client-react";
import type { BiTone } from "@/lib/bi-tone";

/** Tudo que a tela precisa saber de um tipo de anomalia. */
export type AnomalyMeta = {
  label: string;
  icon: LucideIcon;
  /**
   * Vermelho é "perde dinheiro ou trava a venda agora"; âmbar é "atenção". É o
   * vocabulário do sistema inteiro (`convencoes-de-interface.md`) — se tudo que
   * preocupa fosse vermelho, nada seria.
   */
  tone: BiTone;
  /** O que fazer no cadastro para a anomalia sumir da lista. */
  fix: string;
};

/**
 * A ordem das pastilhas e das etiquetas: a mesma prioridade do backend, do que
 * perde dinheiro ao que só confunde.
 */
export const ANOMALY_ORDER: ProductAnomalyTypeName[] = [
  "PriceBelowCost",
  "DraftWithStock",
  "PhantomStock",
  "MarkedOutOfStock",
  "ZeroCost",
  "InactiveWithStock",
  "MissingPhoto",
  "HiddenFromStorefront",
  "DuplicateName",
  "NeverSold",
  "NoRecentSales",
  "SmallPhoto",
];

/**
 * As etiquetas de produto parado — as que o interruptor "ignorar saldo menor
 * que 2" esconde. Um livro de título único fica um ano na prateleira sem
 * vender, e não é anomalia: é o negócio (pedido do dono, 30/09/2026).
 */
export const IDLE_TYPES: ReadonlySet<ProductAnomalyTypeName> = new Set(["NeverSold", "NoRecentSales"]);

/** Saldo a partir do qual o produto parado conta, com o interruptor ligado. */
export const IDLE_MIN_STOCK = 2;

export const ANOMALY_META: Record<ProductAnomalyTypeName, AnomalyMeta> = {
  PriceBelowCost: {
    label: "Preço abaixo do custo",
    icon: TrendingDown,
    tone: "ruim",
    fix: "Ajuste o preço de venda no cadastro. Se o custo é que está errado, corrija-o no detalhe da última entrada, na aba Estoque.",
  },
  DraftWithStock: {
    label: "Rascunho com estoque",
    icon: FilePen,
    tone: "ruim",
    fix: "Mude a situação para Ativo: o PDV não oferece produto em rascunho.",
  },
  PhantomStock: {
    label: "Estoque fantasma",
    icon: Ghost,
    tone: "atencao",
    fix: "Conte a prateleira na aba Estoque, em Contagem Física. Se não houver nada, a contagem lança a baixa e o produto sai da lista.",
  },
  MarkedOutOfStock: {
    label: "Marcado “Sem estoque”",
    icon: PackageX,
    tone: "atencao",
    fix: "Mude a situação para Ativo: o site só mostra produto Ativo.",
  },
  ZeroCost: {
    label: "Custo zerado",
    icon: CircleDollarSign,
    tone: "atencao",
    fix: "Corrija o custo na última entrada: aba Estoque, olho da entrada mais recente. Custo zero em entrada anterior só se corrige por script.",
  },
  InactiveWithStock: {
    label: "Inativo com estoque",
    icon: Archive,
    tone: "atencao",
    fix: "Reative o produto, ou lance a baixa (perda, doação ou consumo) se as unidades não serão vendidas.",
  },
  MissingPhoto: {
    label: "Sem foto",
    icon: ImageOff,
    tone: "atencao",
    fix: "Ponha a foto na galeria do produto.",
  },
  HiddenFromStorefront: {
    label: "Fora do site",
    icon: EyeOff,
    tone: "atencao",
    fix: "Ligue “Exibir no site” no cadastro: foto, estoque e situação já estão prontos.",
  },
  DuplicateName: {
    label: "Nome repetido",
    icon: Copy,
    tone: "atencao",
    fix: "Diferencie os nomes (referência, volume, cor): no balcão, as duas linhas ficam idênticas.",
  },
  NeverSold: {
    label: "Nunca vendeu",
    icon: Hourglass,
    tone: "atencao",
    fix: "Confira se está na gôndola e com preço. Se não vai sair, promova ou dê baixa — capital parado.",
  },
  NoRecentSales: {
    label: "Parou de vender",
    icon: CalendarClock,
    tone: "neutro",
    fix: "Confira a gôndola e o preço; se a procura passou, promova antes de repor.",
  },
  SmallPhoto: {
    label: "Foto pequena",
    icon: ImageMinus,
    tone: "neutro",
    fix: "Troque a capa por uma foto maior: a atual fica de fora do catálogo de divulgação em PDF, onde borraria.",
  },
};

/**
 * Tipo que o backend passou a mandar e esta tela ainda não conhece. A API
 * serializa enum pelo NOME, e um nome novo sem fallback derrubaria a rota
 * inteira pelo ErrorBoundary — por uma etiqueta.
 */
export const FALLBACK_META: AnomalyMeta = {
  label: "Anomalia",
  icon: AlertTriangle,
  tone: "neutro",
  fix: "Abra o produto para conferir o cadastro.",
};

export function anomalyMeta(type: string): AnomalyMeta {
  return ANOMALY_META[type as ProductAnomalyTypeName] ?? FALLBACK_META;
}

/** Posição do tipo na prioridade; desconhecido vai para o fim. */
export function anomalyRank(type: string): number {
  const posicao = ANOMALY_ORDER.indexOf(type as ProductAnomalyTypeName);
  return posicao === -1 ? ANOMALY_ORDER.length : posicao;
}

function unidades(valor: number | null | undefined): string {
  const quantidade = valor ?? 0;
  return `${formatQuantity(quantidade)} ${quantidade === 1 ? "unidade" : "unidades"}`;
}

function dias(valor: number | null | undefined): string {
  const quantidade = valor ?? 0;
  return `${formatQuantity(quantidade)} ${quantidade === 1 ? "dia" : "dias"}`;
}

/**
 * O produto parado que o interruptor esconde: cadastro com uma unidade só
 * (título único, peça única). O saldo é o do CADASTRO, somado das variações
 * (decisão do dono, 30/09/2026): uma camiseta com P, M e G de uma unidade cada
 * tem três peças paradas, e é capital parado que ele quer ver. Vale só para as
 * etiquetas de produto parado — nas outras, uma unidade com preço errado
 * continua errada.
 */
export function isSingleUnitIdle(anomaly: ProductAnomalyDto, row: ProductAnomalyRowDto): boolean {
  return IDLE_TYPES.has(anomaly.type) && row.stock < IDLE_MIN_STOCK;
}

/** "1 a cada 10" — a fatia do produto nas vendas da loja, em linguagem de balcão. */
function umACada(vendasDoProduto: number, vendasDaLoja: number): string {
  if (vendasDoProduto <= 0) return "";
  return ` (1 a cada ${formatQuantity(Math.max(1, Math.round(vendasDaLoja / vendasDoProduto)))})`;
}

/**
 * A frase de evidência da etiqueta, montada com os números que a regra mediu.
 * É ela que faz a etiqueta ser conferível: sem a conta, "estoque fantasma" é
 * uma acusação sem prova.
 */
export function describeAnomaly(anomaly: ProductAnomalyDto, row: ProductAnomalyRowDto): string {
  switch (anomaly.type) {
    case "PriceBelowCost": {
      const preco = anomaly.price ?? 0;
      const custo = Math.max(anomaly.costPrice ?? 0, anomaly.lotCost ?? 0);
      const lote =
        anomaly.lotCost != null
          ? ` · um lote antigo de ${formatCurrency(anomaly.lotCost)} ainda tem saldo, e a venda o consome primeiro`
          : "";
      return `Preço ${formatCurrency(preco)} · custo ${formatCurrency(anomaly.costPrice ?? 0)}${lote} — cada venda perde ${formatCurrency(Math.max(0, custo - preco))} por unidade.`;
    }
    case "DraftWithStock":
      return `${unidades(anomaly.stock)} em rascunho — o balcão não oferece este produto.`;
    case "PhantomStock": {
      const f = anomaly.phantom;
      if (!f) return `${unidades(anomaly.stock)} no sistema e as vendas pararam.`;
      return (
        `Vendia em ${formatQuantity(f.windowSales)} de ${formatQuantity(f.windowStoreSales)} vendas da loja` +
        `${umACada(f.windowSales, f.windowStoreSales)}. Desde ${formatShortDate(f.silenceSince)}, a loja fez ` +
        `${formatQuantity(f.storeSalesSinceSilence)} vendas sem ele — no ritmo, seriam ~${formatQuantity(Math.round(f.expectedSales))}. ` +
        `No sistema: ${unidades(anomaly.stock)}.`
      );
    }
    case "MarkedOutOfStock":
      return `${unidades(anomaly.stock)}, mas a situação é “Sem estoque” — o site esconde.`;
    case "ZeroCost": {
      const zeradas = anomaly.zeroCostUnits ?? 0;
      if (!zeroCostIsCorrectable(anomaly)) {
        const data = anomaly.zeroCostEntryDate ? ` de ${formatShortDate(anomaly.zeroCostEntryDate)}` : "";
        return (
          `${unidades(zeradas)} num lote de custo R$ 0,00 da entrada #${anomaly.zeroCostEntryId}${data}, anterior à última — ` +
          "saem com 100% de margem no BI até acabar, e a tela só corrige a última entrada."
        );
      }

      const entrada =
        anomaly.lastEntryId != null
          ? ` · entrada #${anomaly.lastEntryId}${anomaly.lastEntryDate ? ` de ${formatShortDate(anomaly.lastEntryDate)}` : ""}`
          : "";
      return zeradas > 0
        ? `${unidades(zeradas)} com custo R$ 0,00${entrada} — o BI conta 100% de margem nelas.`
        : `Custo do cadastro R$ 0,00${entrada}.`;
    }
    case "InactiveWithStock":
      return `${unidades(anomaly.stock)} num produto inativo — ninguém vende estas unidades.`;
    case "MissingPhoto":
      return `${unidades(row.stock)} na prateleira sem foto.`;
    case "HiddenFromStorefront":
      return `Tem foto e ${unidades(row.stock)}, e “Exibir no site” está desligado.`;
    case "DuplicateName": {
      const outros = anomaly.duplicateGroupIds?.length ?? 0;
      return outros === 1
        ? "Outro cadastro tem o mesmo nome."
        : `Outros ${outros} cadastros têm o mesmo nome.`;
    }
    case "NeverSold": {
      const compra = anomaly.firstPurchaseAt
        ? ` Comprado em ${formatShortDate(anomaly.firstPurchaseAt)}`
        : "";
      return `${unidades(anomaly.stock)} na prateleira há ${dias(anomaly.daysWithoutSales)} e nenhuma venda.${compra ? `${compra}.` : ""}`;
    }
    case "NoRecentSales": {
      const venda = anomaly.lastSaleAt ? ` Última venda em ${formatShortDate(anomaly.lastSaleAt)}.` : "";
      return `${unidades(anomaly.stock)} e ${dias(anomaly.daysWithoutSales)} sem vender.${venda}`;
    }
    case "SmallPhoto": {
      const vendidas = anomaly.unitsSold ?? 0;
      const venda = vendidas > 0 ? `Vendeu ${unidades(vendidas)} no período.` : "Não vendeu no período.";
      return `Capa de ${anomaly.photoWidth ?? 0} × ${anomaly.photoHeight ?? 0} px. ${venda}`;
    }
    default:
      return anomalyMeta(anomaly.type).fix;
  }
}

/**
 * A ordem de trabalho da etiqueta "Foto pequena": do que mais vende para o que
 * menos vende. São centenas de fotos para refazer (cerca de 290 em 03/10/2026),
 * e a que rende primeiro é a do produto que mais sai. O servidor já manda nessa
 * ordem quem só tem esta etiqueta; aqui entram também os cadastros que têm
 * outra anomalia junto, e que viriam no topo por ela.
 */
export function sortBySmallPhotoSales(rows: readonly ProductAnomalyRowDto[]): ProductAnomalyRowDto[] {
  const vendidas = (row: ProductAnomalyRowDto) =>
    row.anomalies.find((anomaly) => anomaly.type === "SmallPhoto")?.unitsSold ?? 0;

  // `sort` é estável: no empate vale a ordem do servidor.
  return [...rows].sort((a, b) => vendidas(b) - vendidas(a));
}

/**
 * O custo zerado se corrige PELA TELA? Só quando o zero está na última entrada da
 * variação — a única cujo custo o detalhe da entrada deixa corrigir (decisão do
 * dono, 23/09/2026). Zero numa entrada anterior (uma compra nova, ou a sobra de
 * uma contagem, entrou por cima) só se corrige por script, e a etiqueta não pode
 * oferecer um atalho que leva a um lápis que não existe.
 */
export function zeroCostIsCorrectable(anomaly: ProductAnomalyDto): boolean {
  return anomaly.zeroCostEntryId == null || anomaly.zeroCostEntryId === anomaly.lastEntryId;
}

/**
 * A variação a mostrar ao lado da etiqueta: só em cadastro com variações, e só
 * quando a anomalia é de uma delas. Em produto simples o nome da variação é o do
 * próprio cadastro, e repeti-lo seria ruído.
 */
export function variationLabel(anomaly: ProductAnomalyDto, row: ProductAnomalyRowDto): string | null {
  if (!row.hasVariations || anomaly.productId == null || !anomaly.productName) return null;
  return anomaly.productName;
}
