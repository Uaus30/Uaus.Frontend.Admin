import { renderHook, act } from "@testing-library/react";
import { useTags } from "../useTags";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/tags.service", () => ({
  getTagsPage: vi.fn(() => Promise.resolve({
    data: [{ id: 10, name: "Tag 10", color: "#ff0000", isPublic: true, createdAt: "2026-06-18T22:00:00Z" }],
    total: 1,
    page: 1,
    limit: 20
  })),
  createTag: vi.fn(() => Promise.resolve({ id: 11 })),
  updateTag: vi.fn(() => Promise.resolve()),
  deleteTag: vi.fn(() => Promise.resolve()),
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

describe("useTags Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useTags(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("");
    expect(result.current.sortBy).toBe("createdAt");
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it("should handle openModal in create mode", () => {
    const { result } = renderHook(() => useTags(), { wrapper: createWrapper() });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.formData.name).toBe("");
    expect(result.current.formData.isPublic).toBe(false);
  });

  it("should handle openModal in edit mode", () => {
    const { result } = renderHook(() => useTags(), { wrapper: createWrapper() });

    const tagToEdit = {
      id: 10,
      name: "Tag 10",
      color: "#ff0000",
      isPublic: true,
      createdAt: "2026-06-18T22:00:00Z",
      productCount: 0,
    };

    act(() => {
      result.current.openModal(tagToEdit);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(10);
    expect(result.current.formData.name).toBe("Tag 10");
    expect(result.current.formData.color).toBe("#ff0000");
    expect(result.current.formData.isPublic).toBe(true);
  });
});
