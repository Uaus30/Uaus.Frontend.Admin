import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  fetchAllPages,
  type GradeDto,
} from "@workspace/api-client-react";
import { getPaged } from "./core";

export async function getAllGrades() {
  return fetchAllPages<GradeDto>("/Grades");
}

export async function getGradesByCategoryId(categoryId: number) {
  return apiGet<GradeDto[]>(`/Grades/category/${categoryId}`);
}

export async function getGradesPage(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return getPaged<GradeDto>("/Grades", {
    search: params?.search,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
}

export async function createGrade(payload: {
  type: number;
  categoryIds: number[];
  options: Array<{ value: string; colorHex?: string | null; displayOrder: number }>;
}) {
  return apiPost<GradeDto>("/Grades", payload);
}

export async function updateGrade(payload: {
  id: number;
  type: number;
  categoryIds: number[];
  options: Array<{ id?: number; value: string; colorHex?: string | null; displayOrder: number }>;
}) {
  return apiPut<GradeDto>("/Grades", payload);
}

export async function deleteGrade(id: number) {
  return apiDelete<null>(`/Grades/${id}`);
}
