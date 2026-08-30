import type { EnumValue, GradeTypeCode } from "@workspace/api-client-react";

/** Imagem já associada ao produto representante da linha. */
export type ProductTableRowImage = {
  /** Id da ASSOCIAÇÃO (`ProductImage`), não do arquivo. */
  associationId: number;
  /**
   * Datas da associação. Não aparecem em lugar nenhum da tela — existem porque a
   * troca da imagem principal precisa remontar `ProductImageDto` para o
   * `syncProductImages`, e fabricar data ali seria inventar dado.
   */
  createdAt: string;
  updatedAt: string | null;
  imageId: number;
  displayOrder: number;
  image: {
    id: number;
    name: string;
    url: string;
  };
};

/**
 * Uma LINHA da tabela de produtos, do jeito que a tela usa.
 *
 * Substitui o `EnrichedProduct` nesta tela. O `EnrichedProduct` é
 * `ProductDto & { productGroup, category, department, tags, images }` com os DTOs
 * COMPLETOS — e o endereço agregado devolve só o que a linha mostra. Montar os
 * DTOs completos a partir dele exigiria inventar `productCount`, `isPublic`,
 * `uuid`, `type` e `version`; campo inventado com cara de campo real é a próxima
 * armadilha, não uma conveniência de tipagem.
 *
 * Os nomes do GRUPO e do PRODUTO vivem em campos separados de propósito — ver
 * {@link ProductTableRow.name} e {@link ProductTableRow.productName}.
 */
export type ProductTableRow = {
  /**
   * Id do PRODUTO representante. **Zero quando o grupo ainda não tem produto
   * ativo** — o grupo é criado antes do primeiro produto, e a linha aparece
   * mesmo assim para o cadastro recém-começado não sumir da listagem.
   */
  id: number;
  productGroupId: number;
  /**
   * Nome EXIBIDO na tabela: o do grupo. É o que o usuário reconhece; o produto
   * representante pode se chamar "Caneca 300ml" dentro do grupo "Caneca".
   */
  name: string;
  /**
   * Nome verdadeiro do produto representante.
   *
   * A edição rápida de preço faz PUT no produto e tem que devolver ESTE nome.
   * Mandar {@link ProductTableRow.name} renomearia o produto silenciosamente, com
   * registro no histórico — e o nome errado vazaria para o cupom e para o PDV.
   */
  productName: string;
  description: string | null;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  /** Enum ProductStatus — pode vir como número ou nome; leia com `enumCode`. */
  status: EnumValue;
  /** Produtos ativos do grupo. Grupo sem variações tem 1. */
  variationCount: number;
  productGroup: {
    id: number;
    name: string;
    description: string | null;
    hasVariations: boolean;
    showOnSite: boolean;
  };
  category: { id: number; name: string };
  department: { id: number; name: string };
  tags: Array<{ id: number; name: string; color: string }>;
  /** Em ordem de exibição; a primeira é a principal. */
  images: ProductTableRowImage[];
};

/**
 * Represents the main/parent product group form values.
 * In a variation setup, these fields apply to all variations under the group.
 */
export type ProductGroupForm = {
  /** ID do departamento escolhido. */
  departmentId: string;
  /** Selected category ID */
  categoryId: string;
  /** Name of the product group (e.g. "T-shirt Basic") */
  productGroupName: string;
  /** Short description of the product group */
  description: string;
  /** Whether the product group has active variations/SKUs */
  hasVariations: boolean;
  /** Visibility status: true to display publically on the site */
  isPublic: boolean;
};

/**
 * Represents the core editor form state for a single product/SKU.
 * For simple products, this represents the product itself.
 */
export type ProductEditorForm = {
  /** Database ID, null for unsaved new products */
  id: number | null;
  /** Product/SKU display name */
  name: string;
  /** Optional SKU-specific description */
  description?: string;
  /** Sales price in Brazilian Reais (R$) */
  price: number;
  /** Current stock quantity (usually read-only or adjusted via entries) */
  stock: number;
  /** Minimum stock warning threshold */
  minStock: number;
  /** Status option ID (e.g. "Ativo", "Inativo") */
  status: string;
  /** Associated tag/label IDs */
  tagIds: number[];
  /** Optional EAN-8/EAN-13 barcode value */
  barcode?: string;
};

/**
 * Represents an image loaded or selected in the local frontend state.
 */
export type LocalImage = {
  /** Database ID if already uploaded to the catalog */
  imageId?: number;
  /** Database association ID linking this image to the specific product */
  associationId?: number;
  /** Short file name */
  name: string;
  /** Local blob URL (for previews of selected files) or CDN public URL */
  url: string;
  /** Original File instance (if selected from disk and pending API upload) */
  file?: File;
};

/**
 * Estrutura de dynamic variation draft row in the editor table.
 */
export type VariationDraft = ProductEditorForm & {
  /** Local unique row key (e.g., `temp-123` or `product-456`) */
  key: string;
  /** Specific images associated with this variation/SKU */
  images: LocalImage[];
  /** True if this variation can be deleted (e.g., has no stock or transaction history) */
  canDelete: boolean;
  /**
   * Valores de grade desta variação, na ordem de exibição.
   *
   * São eles que dão nome à variação: o `name` guarda o nome do GRUPO, igual
   * para todas, e o que a tela e a venda mostram é o composto
   * "NOME [VALOR1, VALOR2]". Duas variações do mesmo grupo não podem ter a
   * mesma combinação — é o que a validação do salvamento cobra.
   */
  values: VariationValue[];
};

/**
 * Valor de grade que identifica uma variação: "Cor = AZUL".
 *
 * Substituiu o `variantMap` (grade -> id da opção do catálogo global) quando o
 * catálogo de grades foi removido, em 30/08/2026. A opção deixou de ter id
 * porque deixou de existir fora do produto.
 */
export type VariationValue = {
  gradeType: GradeTypeCode;
  value: string;
};

/**
 * Uma grade escolhida para o produto e os valores dela NESTE produto.
 *
 * É o que a modal de variações edita. Os valores não saem de catálogo nenhum:
 * "Cor" pode ter duas opções aqui e cinco no produto vizinho, e é justamente
 * isso que o desenho antigo — catálogo global com CRUD — não permitia sem
 * cadastrar uma grade por combinação.
 */
export type ProductGrade = {
  type: GradeTypeCode;
  /** Na ordem em que o operador digitou; é ela que ordena a matriz. */
  values: string[];
};
