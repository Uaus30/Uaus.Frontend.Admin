import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUsers } from "../useUsers";

// Mock do toast
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

// Mock do serviço de enums
vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([
    { id: 1, name: "Administrador", value: "admin", allowSelect: true },
    { id: 2, name: "Usuário Comum", value: "user", allowSelect: true },
  ])),
}));

// Mock do API Client para usuários
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  getGetUsersQueryKey: () => ["users"],
  useGetUsers: vi.fn(() => ({
    data: {
      data: [
        { id: 1, firstName: "João", lastName: "Silva", username: "joaosilva", email: "joao@test.com", role: 1, status: 1 }
      ],
      total: 1,
      page: 1,
      limit: 50,
    },
    isLoading: false,
    refetch: () => mockRefetch(),
  })),
  useCreateUser: vi.fn(() => ({
    mutate: mockCreateUser,
    isPending: false,
  })),
  useUpdateUser: vi.fn(() => ({
    mutate: mockUpdateUser,
    isPending: false,
  })),
  useDeleteUser: vi.fn(() => ({
    mutate: mockDeleteUser,
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

describe("useUsers Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.deleteId).toBeNull();
  });

  it("deve abrir modal de cadastro com formulário limpo", () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    act(() => {
      result.current.openCreate();
    });

    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.form.fullName).toBe("");
  });

  it("deve abrir modal de edição carregando os dados do usuário", () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    const userToEdit = {
      id: 1,
      firstName: "João",
      lastName: "Silva",
      username: "joaosilva",
      email: "joao@test.com",
      role: 1,
      status: 1,
    };

    act(() => {
      result.current.openEdit(userToEdit);
    });

    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.editingId).toBe(1);
    expect(result.current.form.fullName).toBe("João Silva");
    expect(result.current.form.username).toBe("joaosilva");
  });

  it("deve disparar a mutação createUser ao submeter formulário de criação", () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    const payload = {
      fullName: "Pedro Souza",
      username: "pedrosouza",
      email: "pedro@test.com",
      password: "initial-password",
      role: "1",
      status: "1",
    };

    act(() => {
      result.current.handleSubmitUser(payload);
    });

    expect(mockCreateUser).toHaveBeenCalledWith({
      data: {
        firstName: "Pedro",
        lastName: "Souza",
        username: "pedrosouza",
        email: "pedro@test.com",
        password: "initial-password",
        role: 1,
        // REGRESSÃO: o cadastro NÃO enviava o status. A modal oferece o campo e
        // já o preenche com o padrão, mas o valor escolhido era descartado —
        // criar um usuário inativo produzia um usuário ativo. A edição sempre
        // mandou. Apareceu ao trocar `data: unknown` pelo tipo real do payload.
        status: 1,
      },
    });
  });

  it("deve disparar a mutação deleteUser ao remover usuário", () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleDeleteUser(1);
    });

    expect(mockDeleteUser).toHaveBeenCalledWith({ id: 1 });
  });
});
