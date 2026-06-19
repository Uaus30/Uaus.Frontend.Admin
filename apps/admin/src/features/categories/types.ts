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
  /** Label indicating number of associated products (mocked representation) */
  productCountLabel: string;
};

/**
 * Mock representation of category sales report data.
 */
export type CategoryReportProduct = {
  id: number;
  name: string;
  price: number;
  stock: number;
  totalSales: number;
  totalRevenue: number;
};

/**
 * Mock representation of category sales report summary.
 */
export type CategoryReport = {
  category: {
    name: string;
  };
  totalRevenue: number;
  totalSales: number;
  totalStock: number;
  products: CategoryReportProduct[];
};
