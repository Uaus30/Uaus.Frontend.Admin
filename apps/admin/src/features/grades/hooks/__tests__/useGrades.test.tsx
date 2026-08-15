import { renderHook, act } from "@testing-library/react";
import { useGrades } from "../useGrades";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/grades.service", () => ({
  createGrade: vi.fn(() => Promise.resolve({ id: 11 })),
  updateGrade: vi.fn(() => Promise.resolve()),
  deleteGrade: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([
    { id: 1, name: "Tamanho", value: "Size", allowSelect: true },
    { id: 2, name: "Cor", value: "Color", allowSelect: true },
  ])),
}));

vi.mock("@/services/categories.service", () => ({
  getAllCategories: vi.fn(() => Promise.resolve([
    { id: 101, name: "Calçados", departmentId: 10 },
  ])),
  getAllDepartments: vi.fn(() => Promise.resolve([
    { id: 10, name: "Calçados Dept" },
  ])),
}));

// Mock api client react hook
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetGrades: vi.fn(() => ({
    data: [
      {
        id: 1,
        name: "Grade Tamanho",
        type: 1,
        categoryIds: [101],
        options: [{ id: 1, value: "P", displayOrder: 0 }],
      },
    ],
    isLoading: false,
  })),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

// Helper wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useGrades Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useGrades(), { wrapper: createWrapper() });

    expect(result.current.search).toBe("");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
    expect(result.current.gradeType).toBe("Tamanho");
  });

  it("should handle openModal in create mode", () => {
    const { result } = renderHook(() => useGrades(), { wrapper: createWrapper() });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.selectedCategoryIds).toEqual([]);
    expect(result.current.variants).toEqual([]);
  });

  it("should handle openModal in edit mode", () => {
    const { result } = renderHook(() => useGrades(), { wrapper: createWrapper() });

    const gradeToEdit = {
      id: 1,
      name: "Grade Tamanho",
      type: "Tamanho" as const,
      categoryIds: [101],
      variants: [{ id: 1, value: "P", order: 0 }],
    };

    act(() => {
      result.current.openModal(gradeToEdit);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(1);
    expect(result.current.selectedCategoryIds).toEqual([101]);
    expect(result.current.variants).toEqual([{ id: 1, value: "P", order: 0 }]);
  });
});
