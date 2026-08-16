import {
  apiDelete,
  apiPost,
  apiPut,
  fetchAllPages,
  type CategoryDto,
  type DepartmentDto,
} from "@workspace/api-client-react";
import { getPaged } from "./core";

export async function getAllDepartments() {
  return fetchAllPages<DepartmentDto>("/Departments");
}

export async function getAllCategories(params?: { departmentId?: number }) {
  return fetchAllPages<CategoryDto>("/Categories", params);
}

export async function getCategoriesPage(params?: {
  search?: string;
  departmentId?: number;
  page?: number;
  limit?: number;
}) {
  return getPaged<CategoryDto>("/Categories", {
    search: params?.search,
    departmentId: params?.departmentId,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
}

export async function getDepartmentsPage(params?: { search?: string; page?: number; limit?: number }) {
  return getPaged<DepartmentDto>("/Departments", {
    search: params?.search,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
}

export async function createCategory(payload: {
  departmentId: number;
  name: string;
  description?: string | null;
}) {
  return apiPost<null>("/Categories", payload);
}

export async function updateCategory(payload: {
  id: number;
  departmentId: number;
  name: string;
  description?: string | null;
}) {
  return apiPut<CategoryDto>("/Categories", payload);
}

export async function deleteCategory(id: number) {
  return apiDelete<null>(`/Categories/${id}`);
}

export async function createDepartment(payload: { name: string; description?: string | null }) {
  return apiPost<null>("/Departments", payload);
}

export async function updateDepartment(payload: { id: number; name: string; description?: string | null }) {
  return apiPut<DepartmentDto>("/Departments", payload);
}

export async function deleteDepartment(id: number) {
  return apiDelete<null>(`/Departments/${id}`);
}
