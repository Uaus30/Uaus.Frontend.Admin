import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLogs } from "../useLogs";

// Mock do toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock do serviço de enums
vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([
    { id: 1, name: "Info", value: "info", allowSelect: true },
    { id: 2, name: "Error", value: "error", allowSelect: true },
  ])),
}));

// Mock do API Client para logs
const mockGetLogs = vi.fn(() => ({
  data: {
    data: [
      { id: 1, type: "INFO", message: "Log test message", origin: "System", code: "SYS-001", createdAt: "2026-06-18T22:51:38-03:00" }
    ],
    total: 1,
    page: 1,
    limit: 25,
    totalPages: 1,
  },
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetLogs: () => mockGetLogs(),
}));

// Wrapper de testes para prover o QueryClient
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

describe("useLogs Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(25);
    expect(result.current.draftSearch).toBe("");
    expect(result.current.draftType).toBe("all");
    expect(result.current.draftDateRange).toBeDefined();
  });

  it("deve aplicar os filtros de busca ao chamar handleSearch", () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() });

    act(() => {
      result.current.setDraftSearch("critical error");
      result.current.setDraftType("error");
    });

    expect(result.current.draftSearch).toBe("critical error");
    expect(result.current.draftType).toBe("error");

    act(() => {
      result.current.handleSearch();
    });

    expect(result.current.appliedSearch).toBe("critical error");
    expect(result.current.appliedType).toBe("error");
    expect(result.current.page).toBe(1);
  });
});
