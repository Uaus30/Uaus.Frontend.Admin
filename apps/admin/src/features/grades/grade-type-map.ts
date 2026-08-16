import type { EnumOptionDto, GradeDto } from "@workspace/api-client-react";
import type { Grade, GradeType } from "./types";

/**
 * Tradução entre o enum de grade do backend e o rótulo em português da tela.
 *
 * O backend manda o tipo de três jeitos conforme o endpoint — código numérico
 * (`1`), nome PascalCase (`"Size"`) e às vezes minúsculo (`"size"`). O mapa
 * cobre os três porque uma grade que caísse fora dele apareceria na tabela como
 * "Tamanho" independentemente do que é, e o operador só descobriria ao abrir.
 *
 * O catálogo dinâmico (`/Grades/enums/grade-type`) tem precedência: se um tipo
 * novo entrar no backend, ele passa a valer sem release do front. A tabela fixa
 * fica de piso para o intervalo em que o enum ainda não respondeu.
 */
const FALLBACK_FROM_API: Record<number | string, GradeType> = {
  1: "Tamanho",
  2: "Cor",
  3: "Modelo",
  4: "Estampa",
  Size: "Tamanho",
  Color: "Cor",
  Model: "Modelo",
  Print: "Estampa",
  size: "Tamanho",
  color: "Cor",
  model: "Modelo",
  print: "Estampa",
};

const FALLBACK_TO_API: Record<GradeType, number> = {
  Tamanho: 1,
  Cor: 2,
  Modelo: 3,
  Estampa: 4,
};

/** Mapa código/valor do backend → rótulo da tela. */
export function buildTypeMapFromApi(options: EnumOptionDto[]): Record<number | string, GradeType> {
  const map = { ...FALLBACK_FROM_API };
  options.forEach((option) => {
    const name = option.name as GradeType;
    map[option.id] = name;
    map[option.value] = name;
    map[option.value.toLowerCase()] = name;
  });
  return map;
}

/** Mapa rótulo da tela → código do backend. */
export function buildTypeMapToApi(options: EnumOptionDto[]): Record<GradeType, number> {
  const map = { ...FALLBACK_TO_API };
  options.forEach((option) => {
    map[option.name as GradeType] = option.id;
  });
  return map;
}

/**
 * Converte o DTO da API no modelo `Grade` da tela.
 *
 * `displayOrder` vira `order` porque a tabela ordena por ele e o drag-and-drop
 * reescreve a posição; manter os dois nomes vivos na mesma tela foi o que fez a
 * ordem salva divergir da ordem exibida.
 */
export function mapDtoToGrade(dto: GradeDto, typeMap: Record<number | string, GradeType>): Grade {
  return {
    id: dto.id,
    name: dto.name,
    type: typeMap[dto.type] || "Tamanho",
    categoryIds: dto.categoryIds || [],
    variants: dto.options.map((option) => ({
      id: option.id,
      value: option.value,
      colorHex: option.colorHex || undefined,
      order: option.displayOrder,
    })),
  };
}
