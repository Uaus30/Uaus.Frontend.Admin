/**
 * Represents a single Category item in the catalog.
 */
export type Category = {
  /** Category Database ID */
  id: number;
  /** Category display name */
  name: string;
  /** Associated department ID */
  departmentId: number;
};

/**
 * Represents the form values for creating or editing a Department.
 */
export type DepartmentForm = {
  /** Department name */
  name: string;
  /** Optional department description */
  description: string;
};

/**
 * Represents a Department model enriched with child statistics values.
 */
export type EnrichedDepartment = {
  /** Department Database ID */
  id: number;
  /** Department name */
  name: string;
  /** Optional department description */
  description?: string | null;
  /** Number of categories linked to this department */
  categoriesCount: number;
};
