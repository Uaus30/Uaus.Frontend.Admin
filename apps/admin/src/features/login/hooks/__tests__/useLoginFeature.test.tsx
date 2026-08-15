import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLoginFeature } from "../useLoginFeature";

// Mock do toast
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

// Mock da navegação
const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => [null, mockSetLocation],
}));

// Mock do React Query e API Client de login
const mockLoginMutate = vi.fn();
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useLogin: vi.fn(() => ({
    mutate: mockLoginMutate,
    isPending: false,
  })),
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

describe("useLoginFeature Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar com credenciais em branco e sem pendências", () => {
    const { result } = renderHook(() => useLoginFeature(), { wrapper: createWrapper() });

    expect(result.current.identifier).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.isPending).toBe(false);
  });

  it("deve alterar os campos de credenciais corretamente", () => {
    const { result } = renderHook(() => useLoginFeature(), { wrapper: createWrapper() });

    act(() => {
      result.current.setIdentifier("admin");
      result.current.setPassword("123456");
    });

    expect(result.current.identifier).toBe("admin");
    expect(result.current.password).toBe("123456");
  });

  it("deve chamar mutate de login ao submeter as credenciais", () => {
    const { result } = renderHook(() => useLoginFeature(), { wrapper: createWrapper() });

    act(() => {
      result.current.setIdentifier("admin@uaus.com.br");
      result.current.setPassword("supersecret");
    });

    act(() => {
      result.current.submitLogin();
    });

    expect(mockLoginMutate).toHaveBeenCalledWith({
      data: {
        login: "admin@uaus.com.br",
        password: "supersecret",
      },
    });
  });
});
