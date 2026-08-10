import { Grade, ProductEditorForm, VariationDraft } from "../../types";

/**
 * Helper: Reorders an array by shifting an item at `index` left (-1) or right (+1).
 */
export function reorderItems<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const copy = [...list];
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= copy.length) return copy;
  const temp = copy[index];
  copy[index] = copy[nextIndex];
  copy[nextIndex] = temp;
  return copy;
}

/**
 * Helper: Moves an array item from a source index to a destination index.
 */
export function moveItemTo<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...list];
  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);
  return copy;
}

/**
 * Mapper: Converts a raw DTO from the API into a strongly-typed `Grade` model.
 */
export function mapDtoToGrade(dto: any, typeMap: Record<number | string, any>): Grade {
  return {
    id: dto.id,
    name: dto.name,
    type: typeMap[dto.type] || "Tamanho",
    categoryIds: dto.categoryIds || [],
    variants: (dto.variants || []).map((v: any) => ({
      id: v.id,
      value: v.value,
      colorHex: v.colorHex || undefined,
      order: v.order || 0,
    })),
  };
}

/**
 * Helper: Factory to instantiate an empty ProductEditorForm template.
 */
export function createEmptyProductEditor(defaultStatus = ""): ProductEditorForm {
  return {
    id: null,
    name: "",
    description: "",
    price: 0,
    stock: 0,
    minStock: 0,
    status: defaultStatus,
    tagIds: [],
    barcode: "",
  };
}

/**
 * Helper: Factory to instantiate a new VariationDraft layout.
 */
export function createVariationDraft(defaultStatus = "", name = ""): VariationDraft {
  const empty = createEmptyProductEditor(defaultStatus);
  return {
    ...empty,
    key: `temp-${Math.random().toString(36).substring(2, 9)}`,
    name,
    images: [],
    canDelete: true,
  };
}
