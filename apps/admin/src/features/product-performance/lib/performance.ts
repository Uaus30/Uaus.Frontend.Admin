import { CopyPlus, Flame, Minus, PackagePlus, Sparkles, Sprout, TrendingUp, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProductActionCode, ProductPerformanceClass } from "@workspace/api-client-react";
import type { BiTone } from "@/lib/bi-tone";

/**
 * O vocabulário da tela: como cada faixa e cada ação se chamam, com que cor e
 * com que ícone aparecem.
 *
 * As cores saem de `@/lib/bi-tone`, que é a paleta comum das três telas de BI —
 * verde é positivo, âmbar é atenção, vermelho é negativo, cinza é "não dá para
 * julgar". Cor e ícone andam sempre juntos: cor sozinha some para quem não
 * distingue verde de âmbar e some para todo mundo numa impressão em preto e
 * branco, e esta é uma tela que se imprime para levar ao balcão.
 *
 * A faixa do meio ("Regular") fica sem cor de propósito.
 */

type Descricao = {
  rotulo: string;
  tom: BiTone;
  icone: LucideIcon;
  /** Uma frase explicando a faixa — vai no `title` e no manual da tela. */
  explicacao: string;
};

export const CLASS_INFO: Record<ProductPerformanceClass, Descricao> = {
  Standout: {
    rotulo: "Destaque",
    tom: "bom",
    icone: Sparkles,
    explicacao: "Nota 70 ou mais: gira, lucra e vende com regularidade acima da loja.",
  },
  Steady: {
    rotulo: "Regular",
    tom: "neutro",
    icone: Minus,
    explicacao: "Nota de 40 a 69: vende, sem puxar nem atrapalhar o resultado.",
  },
  Weak: {
    rotulo: "Fraco",
    tom: "atencao",
    icone: TrendingUp,
    explicacao: "Nota abaixo de 40: vendeu, mas fica atrás da loja em giro, margem ou resultado.",
  },
  Stalled: {
    rotulo: "Parado",
    tom: "ruim",
    icone: XCircle,
    explicacao: "Tinha estoque e não vendeu nenhuma unidade no período.",
  },
  New: {
    rotulo: "Novo",
    tom: "mudo",
    icone: Sprout,
    explicacao: "Entrou há poucos dias e nunca vendeu — ainda não teve chance, e fica fora dos rankings.",
  },
  None: {
    rotulo: "—",
    tom: "mudo",
    icone: Minus,
    explicacao: "Sem classificação.",
  },
};

export const ACTION_INFO: Record<ProductActionCode, Descricao> = {
  RaisePrice: {
    rotulo: "Subir preço",
    tom: "atencao",
    icone: TrendingUp,
    explicacao:
      "Produto bom vendendo com margem apertada. O preço é que está errado — e corrigi-lo rende sem depender de vender mais nada.",
  },
  Restock: {
    rotulo: "Repor",
    tom: "atencao",
    icone: PackagePlus,
    explicacao:
      "Produto bom cujo saldo acaba antes da próxima compra. Faltar aqui custa a venda que já estava acontecendo.",
  },
  Replicate: {
    rotulo: "Comprar semelhantes",
    tom: "bom",
    icone: CopyPlus,
    explicacao:
      "Gira acima da loja com margem saudável. É o perfil que vale procurar de novo no fornecedor — mais do mesmo, e parecidos.",
  },
  Burn: {
    rotulo: "Queimar estoque",
    tom: "ruim",
    icone: Flame,
    explicacao:
      "Prende dinheiro, gira abaixo da loja e o saldo dá para mais de um ano. Baixe o preço, monte combo, leve para promoção — o objetivo é virar caixa.",
  },
  None: {
    rotulo: "Manter",
    tom: "mudo",
    icone: Minus,
    explicacao: "Nada a decidir agora sobre este produto.",
  },
};

/**
 * A cor da nota, na mesma escala de tom da faixa.
 *
 * Sai dos MESMOS cortes que o backend usa para classificar (70 e 40), e não de
 * uma régua própria da tela: dois cortes diferentes fariam a pílula verde
 * aparecer ao lado do rótulo "Regular".
 */
export function tomDaNota(nota: number, standout: number, steady: number): BiTone {
  if (nota >= standout) return "bom";
  if (nota >= steady) return "neutro";
  if (nota > 0) return "atencao";
  return "ruim";
}

/**
 * A cobertura de estoque em palavras: "acaba em 5 dias", "3 meses", "mais de 2
 * anos".
 *
 * Um número cru de dias é preciso e ilegível — "1.035 dias" não se compara com
 * "próxima compra" de cabeça. É a mesma tradução que o relatório de estoque
 * baixo faz na coluna "Dura".
 */
export function coberturaLegivel(dias: number | null | undefined, estoque: number): string {
  if (estoque <= 0) return "esgotado";
  if (dias == null) return "sem giro";
  if (dias < 1) return "acaba hoje";
  if (dias <= 60) return `${Math.round(dias)} dias`;
  if (dias <= 720) return `${Math.round(dias / 30)} meses`;
  return `${(dias / 365).toFixed(1)} anos`;
}

/** Cobertura curta é atenção; cobertura de mais de um ano é dinheiro dormindo. */
export function tomDaCobertura(
  dias: number | null | undefined,
  estoque: number,
  curta: number,
  excessiva: number,
): BiTone {
  if (estoque <= 0) return "atencao";
  if (dias == null) return "ruim";
  if (dias <= curta) return "atencao";
  if (dias >= excessiva) return "ruim";
  return "neutro";
}
