/**
 * Represents the main/parent product group form values.
 * In a variation setup, these fields apply to all variations under the group.
 */
export type ProductGroupForm = {
  /** Selected department ID */
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
 * Represents a dynamic variation draft row in the editor table.
 */
export type VariationDraft = ProductEditorForm & {
  /** Local unique row key (e.g., `temp-123` or `product-456`) */
  key: string;
  /** Specific images associated with this variation/SKU */
  images: LocalImage[];
  /** True if this variation can be deleted (e.g., has no stock or transaction history) */
  canDelete: boolean;
  /** Map of Grade ID to GradeVariant ID (e.g. { [ColorGradeId]: RedVariantId, [SizeGradeId]: LVariantId }) */
  variantMap?: Record<number, number>;
};

/**
 * Represents an option variant under a grade category.
 */
export type GradeVariant = {
  /** Variant Database ID */
  id: number;
  /** Variant text value (e.g. "Vermelho", "G", "Vasco") */
  value: string;
  /** Optional color code in hexadecimal (for visual color selectors) */
  colorHex?: string;
  /** Sorting weight order */
  order?: number;
};

/** Enumeration of supported grade types */
export type GradeType = "Cor" | "Tamanho" | "Modelo" | "Estampa";

/**
 * Represents a product grade category containing variants.
 */
export type Grade = {
  /** Grade Database ID */
  id: number;
  /** Grade display name (e.g. "Tamanho", "Cor") */
  name: string;
  /** Type classification */
  type: GradeType;
  /** Category IDs associated with this grade */
  categoryIds: number[];
  /** Array of available options under this grade */
  variants: GradeVariant[];
};
