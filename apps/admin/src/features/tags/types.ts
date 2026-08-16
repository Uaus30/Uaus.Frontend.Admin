import type { TagDto } from "@workspace/api-client-react";

/**
 * Tipos da feature de etiquetas.
 *
 * Regra do repositório: `types.ts` REEXPORTA o DTO do api-client e define
 * apenas o que é de formulário ou de view. `EnrichedTag` era uma cópia manual
 * do `TagDto` sem o `updatedAt` — duas verdades sobre a mesma resposta, e foi
 * por isso que o hook precisava de `map((tag: any) => ...)` para conseguir
 * espalhar o que a API devolvia.
 */

export type { TagDto };

/**
 * Representa os valores do formulário para criação ou edição de uma Etiqueta (Tag).
 */
export type TagForm = {
  /** Nome da etiqueta */
  name: string;
  /** Cor hexadecimal da etiqueta */
  color: string;
  /** Se a etiqueta deve ser visível publicamente no catálogo */
  isPublic: boolean;
};

/**
 * Etiqueta como a tela a usa.
 *
 * Deriva do DTO em vez de repetir seus campos: um campo novo no backend passa a
 * existir aqui sozinho, e um campo removido vira erro de compilação em vez de
 * `undefined` silencioso na tela.
 */
export type EnrichedTag = TagDto & {
  /** Produtos ativos marcados com a etiqueta, contados pela API na própria listagem */
  productCount: number;
};

export type { TagReport, CatalogReportProduct as TagReportProduct } from "@/services/mappers";
