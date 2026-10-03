import type { CatalogPieceDto } from "@workspace/api-client-react";

/** Para onde a venda foi depois da peça. */
export type DeltaTone = "up" | "down" | "flat";

export interface UnitsDelta {
  tone: DeltaTone;
  /** "+4", "−2" ou "=" — a diferença em unidades. */
  label: string;
}

/** A diferença entre o depois e o antes, com sinal. */
export function unitsDelta(before: number, after: number): UnitsDelta {
  const difference = after - before;

  if (difference > 0) return { tone: "up", label: `+${difference}` };
  // O sinal de menos tipográfico: o hífen some ao lado de um número pequeno.
  if (difference < 0) return { tone: "down", label: `−${Math.abs(difference)}` };
  return { tone: "flat", label: "=" };
}

/** "1 unidade", "7 unidades". */
export function describeUnits(units: number): string {
  return units === 1 ? "1 unidade" : `${units} unidades`;
}

/**
 * Em que pé está a medição da peça.
 *
 * A semana pela metade é dita com todas as letras: comparar dois dias de
 * "depois" com uma semana de "antes" faria toda peça recente parecer um
 * fracasso, e por isso o servidor já recorta o "antes" no mesmo trecho.
 */
export function describeMeasure(piece: CatalogPieceDto, measureDays: number): string {
  if (piece.isComplete) return `Semana fechada: ${measureDays} dias de cada lado.`;

  if (piece.measuredDays === 0) {
    return "Saiu há menos de um dia: ainda é cedo para comparar.";
  }

  const days = piece.measuredDays === 1 ? "1 dia" : `${piece.measuredDays} dias`;
  return `Medindo: ${days} de ${measureDays}, contra o mesmo trecho da semana anterior.`;
}
