import { renderHook, act } from "@testing-library/react";
import { useImages } from "../useImages";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/core", () => ({
  buildPublicImageUrl: vi.fn((url) => `http://public-url${url}`),
  getEnumOptions: vi.fn(() => Promise.resolve([
    { id: 1, name: "Produto", value: "Product", allowSelect: true },
  ])),
}));

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(() => Promise.resolve({ id: 11 })),
  deleteImage: vi.fn(() => Promise.resolve()),
  getImagesPage: vi.fn(() => Promise.resolve({
    data: [{ id: 10, name: "Img 10", url: "/img10.png", type: 1, createdAt: "2026-06-18T22:00:00Z" }],
    total: 1,
    page: 1,
    limit: 20
  })),
  updateImageRecord: vi.fn(() => Promise.resolve()),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
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

describe("useImages Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useImages(), { wrapper: createWrapper() });

    expect(result.current.search).toBe("");
    expect(result.current.typeFilter).toBe("all");
    expect(result.current.page).toBe(1);
    expect(result.current.uploadOpen).toBe(false);
    expect(result.current.renameOpen).toBe(false);
    expect(result.current.uploading).toBe(false);
  });

  it("should reset upload form correctly", () => {
    const { result } = renderHook(() => useImages(), { wrapper: createWrapper() });

    act(() => {
      result.current.setFormName("Test Img");
      result.current.setFormType("1");
      result.current.resetUploadForm();
    });

    expect(result.current.formName).toBe("");
    expect(result.current.file).toBeNull();
    expect(result.current.preview).toBeNull();
  });

  it("should handle handleRenameOpen correctly", () => {
    const { result } = renderHook(() => useImages(), { wrapper: createWrapper() });

    const imageToRename = {
      id: 10,
      name: "Img 10",
      url: "/img10.png",
      type: 1,
      createdAt: "2026-06-18T22:00:00Z",
    };

    act(() => {
      result.current.handleRenameOpen(imageToRename);
    });

    expect(result.current.renameOpen).toBe(true);
    expect(result.current.renameImage).toEqual(imageToRename);
    expect(result.current.renameName).toBe("Img 10");
  });
});
