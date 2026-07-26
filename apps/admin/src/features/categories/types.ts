/**
 * Represents the structure of a Department.
 */
export type Department = {
  /** Department Database ID */
  id: number;
  /** Department name */
  name: string;
};

/**
 * Represents the form values for creating or editing a Category.
 */
export type CategoryForm = {
  /** Selected department ID */
  departmentId: string;
  /** Category name */
  name: string;
  /** Optional category description */
  description: string;
};

/**
 * Represents a Category model with enriched relation values.
 */
export type EnrichedCategory = {
  /** Category Database ID */
  id: number;
  /** Associated department ID */
  departmentId: number;
  /** Category name */
  name: string;
  /** Optional category description */
  description?: string | null;
  /** Associated department object if fetched, otherwise null */
  department: Department | null;
  /** Produtos ativos vinculados, contados pela API na própria listagem */
  productCount: number;
};

export type { CategoryReport, CatalogReportProduct as CategoryReportProduct } from "@/services/mappers";
