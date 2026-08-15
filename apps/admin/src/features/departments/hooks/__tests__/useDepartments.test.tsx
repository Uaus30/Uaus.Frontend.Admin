import { renderHook, act } from "@testing-library/react";
import { useDepartments } from "../useDepartments";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/categories.service", () => ({
  getAllCategories: vi.fn(() => Promise.resolve([{ id: 1, name: "Cat 1", departmentId: 10 }])),
  getDepartmentsPage: vi.fn(() => Promise.resolve({
    data: [{ id: 10, name: "Dep 10", description: "Desc 10" }],
    total: 1,
    page: 1,
    limit: 20
  })),
  createDepartment: vi.fn(() => Promise.resolve({ id: 11 })),
  updateDepartment: vi.fn(() => Promise.resolve()),
  deleteDepartment: vi.fn(() => Promise.resolve()),
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

describe("useDepartments Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it("should handle openModal in create mode", () => {
    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.formData.name).toBe("");
  });

  it("should handle openModal in edit mode", () => {
    const { result } = renderHook(() => useDepartments(), { wrapper: createWrapper() });

    const departmentToEdit = {
      id: 10,
      name: "Dep 10",
      description: "Desc 10",
      categoriesCount: 1,
    };

    act(() => {
      result.current.openModal(departmentToEdit);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(10);
    expect(result.current.formData.name).toBe("Dep 10");
    expect(result.current.formData.description).toBe("Desc 10");
  });
});
