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

// Mock da navegação. `useSearch` entra aqui porque o hook lê o destino
// carimbado pelo guard de rota em `?redirect=`.
const mockSetLocation = vi.fn();
let queryDoLogin = "";
vi.mock("wouter", () => ({
  useLocation: () => [null, mockSetLocation],
  useSearch: () => queryDoLogin,
}));

// Mock do React Query e API Client de login. As opções da mutation são
// guardadas para o teste poder disparar o `onSuccess` — é lá que mora o
// redirecionamento.
const mockLoginMutate = vi.fn();
let opcoesDaMutation: { mutation: { onSuccess: (data: unknown) => void } };
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useLogin: vi.fn((options) => {
    opcoesDaMutation = options;
    return { mutate: mockLoginMutate, isPending: false };
  }),
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
    queryDoLogin = "";
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

  it("deve voltar para o caminho pedido antes do login", () => {
    // REGRESSÃO: quem clicava em "editar produto" no PDV sem sessão no admin
    // digitava a senha e caía no dashboard — a modal que pediu nunca abria.
    queryDoLogin = "redirect=%2Fprodutos%3Fbusca%3DCaneca%26editar%3D10";
    renderHook(() => useLoginFeature(), { wrapper: createWrapper() });

    act(() => {
      opcoesDaMutation.mutation.onSuccess({ user: { id: 1, role: 1 } });
    });

    expect(mockSetLocation).toHaveBeenCalledWith("/produtos?busca=Caneca&editar=10");
  });

  it("deve cair no dashboard quando não há destino carimbado", () => {
    renderHook(() => useLoginFeature(), { wrapper: createWrapper() });

    act(() => {
      opcoesDaMutation.mutation.onSuccess({ user: { id: 1, role: 1 } });
    });

    expect(mockSetLocation).toHaveBeenCalledWith("/dashboard");
  });

  it("deve ignorar destino externo carimbado à mão na URL", () => {
    // A tela de login viraria ponte de phishing: o link chega com o domínio
    // verdadeiro e a saída para o site do atacante acontece DEPOIS da senha.
    queryDoLogin = `redirect=${encodeURIComponent("https://site-falso.com")}`;
    renderHook(() => useLoginFeature(), { wrapper: createWrapper() });

    act(() => {
      opcoesDaMutation.mutation.onSuccess({ user: { id: 1, role: 1 } });
    });

    expect(mockSetLocation).toHaveBeenCalledWith("/dashboard");
  });
});
