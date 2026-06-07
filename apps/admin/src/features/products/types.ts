export type ProductGroupForm = {
  departmentId: string;
  categoryId: string;
  productGroupName: string;
  description: string;
  hasVariations: boolean;
  isPublic: boolean;
};

export type ProductEditorForm = {
  id: number | null;
  name: string;
  description?: string;
  price: number;
  stock: number;
  minStock: number;
  status: string;
  tagIds: number[];
  barcode?: string;
};

export type LocalImage = {
  imageId?: number;
  associationId?: number;
  name: string;
  url: string;
  file?: File;
};

export type VariationDraft = ProductEditorForm & {
  key: string;
  images: LocalImage[];
  canDelete: boolean;
  variantMap?: Record<number, number>; // Grade ID -> Variant ID
};

export type GradeVariant = {
  id: number;
  value: string;
  colorHex?: string;
  order?: number;
};

export type GradeType = "Cor" | "Tamanho" | "Modelo" | "Estampa";

export type Grade = {
  id: number;
  name: string;
  type: GradeType;
  categoryIds: number[];
  variants: GradeVariant[];
};
