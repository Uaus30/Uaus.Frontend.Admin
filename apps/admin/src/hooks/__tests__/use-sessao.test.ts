import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useGetMe: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetMe: mocks.useGetMe,
}));

const { useIsAdmin } = await import("../use-sessao");

function papel(role: unknown) {
  mocks.useGetMe.mockReturnValue({ data: role === undefined ? undefined : { id: 1, role } });
  return renderHook(() => useIsAdmin()).result.current;
}

describe("useIsAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("entende o papel como a API manda — o NOME — e como número", () => {
    // Regressão de routes.ts: comparar o nome com o código deu `false` para todo
    // mundo e escondeu do próprio administrador as telas dele.
    expect(papel("Admin")).toBe(true);
    expect(papel(1)).toBe(true);
  });

  it("vendedor não é administrador", () => {
    expect(papel("Seller")).toBe(false);
  });

  it("enquanto a sessão carrega, a ação restrita não aparece", () => {
    expect(papel(undefined)).toBe(false);
    expect(papel(null)).toBe(false);
  });
});
