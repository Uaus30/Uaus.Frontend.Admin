import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useGetMe = vi.fn();
const setLocation = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useGetMe: (...args: unknown[]) => useGetMe(...args),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocation],
}));

const { usePdvOperator } = await import("../use-pdv-operator");

describe("usePdvOperator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve montar o nome do operador com sobrenome", () => {
    useGetMe.mockReturnValue({ data: { firstName: "Ana", lastName: "Souza" }, isLoading: false });

    const { result } = renderHook(() => usePdvOperator());

    expect(result.current.operatorName).toBe("Ana Souza");
    expect(setLocation).not.toHaveBeenCalled();
  });

  it("deve aceitar cadastro sem sobrenome", () => {
    useGetMe.mockReturnValue({ data: { firstName: "Ana", lastName: null }, isLoading: false });

    const { result } = renderHook(() => usePdvOperator());

    expect(result.current.operatorName).toBe("Ana");
  });

  it("deve cair para o campo `name` das contas antigas", () => {
    useGetMe.mockReturnValue({ data: { name: "Caixa 1" }, isLoading: false });

    const { result } = renderHook(() => usePdvOperator());

    expect(result.current.operatorName).toBe("Caixa 1");
  });

  it("deve nomear o operador genericamente quando não há nome nenhum", () => {
    useGetMe.mockReturnValue({ data: {}, isLoading: false });

    const { result } = renderHook(() => usePdvOperator());

    // Cupom sem operador é cupom que ninguém consegue auditar.
    expect(result.current.operatorName).toBe("Operador");
  });

  it("deve mandar para o login quando não há sessão autenticada", async () => {
    useGetMe.mockReturnValue({ data: undefined, isLoading: false });

    renderHook(() => usePdvOperator());

    await waitFor(() => expect(setLocation).toHaveBeenCalledWith("/login"));
  });

  it("não deve redirecionar enquanto a leitura do operador não terminou", () => {
    useGetMe.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => usePdvOperator());

    expect(setLocation).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
  });

  it("não deve insistir num 401", () => {
    useGetMe.mockReturnValue({ data: undefined, isLoading: true });

    renderHook(() => usePdvOperator());

    // Três tentativas deixariam o operador olhando para um spinner antes de
    // cair no login.
    expect(useGetMe).toHaveBeenCalledWith({ query: { retry: false, staleTime: 5 * 60 * 1000 } });
  });
});
