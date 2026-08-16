import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRow } from "../../types";
import { useUsers } from "../useUsers";

/**
 * Usuário como a API o entrega: enum pelo NOME, não pelo número.
 *
 * O mock antigo devolvia `role: 1`, e por isso o teste passava enquanto a modal
 * de edição abria com Papel e Status vazios na tela real.
 */
const usuarioDaApi: UserRow = {
  id: 1,
  firstName: "João",
  lastName: "Silva",
  username: "joaosilva",
  email: "joao@test.com",
  role: "Admin",
  status: "Pending",
};

// Mock do toast
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

// Mock dos enums, respondendo por caminho: papel e status têm listas diferentes,
// e um mock único faria o teste do filtro de status validar a lista de papéis.
vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn((path: string) =>
    Promise.resolve(
      path.includes("user-role")
        ? [
            { id: 0, name: "Nenhum", value: "None", allowSelect: false },
            { id: 1, name: "Administrador", value: "Admin", allowSelect: true },
            { id: 2, name: "Vendedor", value: "Seller", allowSelect: true },
          ]
        : [
            { id: 0, name: "Nenhum", value: "None", allowSelect: false },
            { id: 1, name: "Pendente", value: "Pending", allowSelect: true },
            { id: 2, name: "Ativo", value: "Active", allowSelect: true },
            { id: 3, name: "Bloqueado", value: "Bloqued", allowSelect: true },
            { id: 4, name: "Inativo", value: "Inactive", allowSelect: true },
          ],
    ),
  ),
}));

// Mock do API Client para usuários
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockResetPassword = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetUsers: vi.fn(() => ({
    data: {
      data: [
        {
          id: 1,
          firstName: "João",
          lastName: "Silva",
          username: "joaosilva",
          email: "joao@test.com",
          // Como a API manda de verdade: o NOME do membro do enum em C#, não o
          // número. O mock antes dizia 1/1, e por isso o teste nunca viu o campo
          // Papel abrir em branco na tela real.
          role: "Admin",
          status: "Pending",
        },
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
  useResetUserPassword: vi.fn(() => ({
    mutate: mockResetPassword,
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

    act(() => {
      result.current.openEdit(usuarioDaApi);
    });

    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.editingId).toBe(1);
    expect(result.current.form.fullName).toBe("João Silva");
    expect(result.current.form.username).toBe("joaosilva");
  });

  it("preenche Papel e Status com o enum que a API manda por NOME", () => {
    // REGRESSÃO: a API serializa enum pelo nome do membro em C#
    // (JsonStringEnumConverter), então chega `role: "Admin"`. O hook fazia
    // `String(user.role)` e o formulário ficava com "Admin", enquanto as opções
    // do <Select> valem "1" e "2" — os dois campos abriam EM BRANCO na modal de
    // edição, sem erro nenhum, e salvar assim rebaixava o papel do usuário.
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    act(() => {
      result.current.openEdit(usuarioDaApi);
    });

    expect(result.current.form.role).toBe("1");
    expect(result.current.form.status).toBe("1");
  });

  it("não oferece Ativo para quem ainda não trocou a senha", async () => {
    // Sair de Pendente é ter trocado a senha do primeiro acesso, e o servidor
    // recusa a promoção pela edição. Deixar a opção só renderia erro ao salvar.
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.selectableStatusOptions.length).toBeGreaterThan(0));

    act(() => {
      result.current.openEdit(usuarioDaApi);
    });

    expect(result.current.pendentePrimeiroAcesso).toBe(true);
    expect(result.current.editableStatusOptions.map((o) => o.value)).not.toContain("Active");
    // O resto continua oferecido: cadastrou errado, bloqueia.
    expect(result.current.editableStatusOptions.map((o) => o.value)).toContain("Bloqued");
  });

  it("oferece todos os status para quem já trocou a senha", async () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.selectableStatusOptions.length).toBeGreaterThan(0));

    act(() => {
      result.current.openEdit({ ...usuarioDaApi, status: "Active" });
    });

    expect(result.current.pendentePrimeiroAcesso).toBe(false);
    expect(result.current.editableStatusOptions.map((o) => o.value)).toContain("Active");
  });

  it("cadastra SEM senha e SEM status", () => {
    // O defeito que originou tudo: a modal pedia uma senha, o servidor a
    // descartava e gravava a padrão do sistema. O administrador entregava ao
    // operador uma senha que o PDV recusava com "Senha inválida!". Agora o
    // cadastro nasce com a padrão e Pendente, e nem tenta escolher.
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleSubmitUser({
        fullName: "Pedro Souza",
        username: "pedrosouza",
        email: "pedro@test.com",
        role: "2",
        status: "1",
      });
    });

    expect(mockCreateUser).toHaveBeenCalledWith({
      data: {
        firstName: "Pedro",
        lastName: "Souza",
        username: "pedrosouza",
        email: "pedro@test.com",
        role: 2,
      },
    });
  });

  it("edita enviando o status escolhido", () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    act(() => {
      result.current.openEdit({ ...usuarioDaApi, status: "Active" });
    });

    act(() => {
      result.current.handleSubmitUser({
        fullName: "João Silva",
        username: "joaosilva",
        email: "joao@test.com",
        role: "1",
        status: "4",
      });
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({
      id: 1,
      data: {
        firstName: "João",
        lastName: "Silva",
        username: "joaosilva",
        email: "joao@test.com",
        role: 1,
        status: 4,
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

  it("deve disparar o reset de senha", () => {
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleResetPassword(1);
    });

    expect(mockResetPassword).toHaveBeenCalledWith({ id: 1 });
  });
});
