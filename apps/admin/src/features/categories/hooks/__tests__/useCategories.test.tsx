import { renderHook, act } from "@testing-library/react";
import { useCategories } from "../useCategories";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/categories.service", () => ({
  getAllDepartments: vi.fn(() => Promise.resolve([{ id: 1, name: "Dep 1" }])),
  getCategoriesPage: vi.fn(() => Promise.resolve({
    data: [{ id: 10, name: "Cat 10", departmentId: 1, description: "Desc 10" }],
    total: 1,
    page: 1,
    limit: 20
  })),
  createCategory: vi.fn(() => Promise.resolve({ id: 11 })),
  updateCategory: vi.fn(() => Promise.resolve()),
  deleteCategory: vi.fn(() => Promise.resolve()),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock workspace query keys
vi.mock("@workspace/api-client-react", () => ({
  getGetCategoriesQueryKey: () => ["categories"],
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

describe("useCategories Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("");
    expect(result.current.departmentFilter).toBe("all");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it("should handle openModal in create mode", () => {
    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.formData.name).toBe("");
  });

  it("should handle openModal in edit mode", () => {
    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

    const categoryToEdit = {
      id: 10,
      departmentId: 1,
      name: "Cat 10",
      description: "Desc 10",
      department: { id: 1, name: "Dep 1" },
      productCountLabel: "Mockado",
    };

    act(() => {
      result.current.openModal(categoryToEdit);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(10);
    expect(result.current.formData.name).toBe("Cat 10");
    expect(result.current.formData.description).toBe("Desc 10");
  });
});
