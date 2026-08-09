import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// useLogin REAL do api-client (sem vi.mock): este teste protege o contrato da
// requisição de login — credenciais no CORPO JSON, nunca na querystring, onde a
// senha ficaria gravada em logs de acesso de proxy/gateway e no histórico.
import { useLogin } from "@workspace/api-client-react";

const SESSION_PAYLOAD = {
  user: {
    id: 1,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: null,
    firstName: "Admin",
    lastName: "Uaus",
    username: "admin",
    email: "admin@uaus.com.br",
    role: 1,
    status: 1,
  },
  token: {
    type: "Bearer",
    value: "token-de-teste",
    expiration: "2099-01-01T00:00:00",
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Requisição capturada na chamada de número `index` do fetch. */
function fetchCall(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [
    string,
    { method: string; headers: Headers; body?: string },
  ];
  return { url: new URL(String(url)), init };
}

describe("useLogin (contrato da requisição)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(SESSION_PAYLOAD),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deve enviar as credenciais no corpo JSON, sem nada na querystring", async () => {
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      data: { login: "admin", password: "senha-secreta" },
    });

    const { url, init } = fetchCall(fetchMock);
    expect(url.pathname).toContain("/Users/authenticate");
    // Regressão do bug crítico: a senha viajava em ?login=&password=.
    expect(url.search).toBe("");
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body ?? "")).toEqual({
      login: "admin",
      password: "senha-secreta",
    });
    // Login não manda Authorization (auth: false).
    expect(init.headers.has("Authorization")).toBe(false);
  });

  it("deve aceitar username/email como identificador e mandar como login no corpo", async () => {
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      data: { username: "operador", password: "outra-senha" },
    });

    const { init } = fetchCall(fetchMock);
    expect(JSON.parse(init.body ?? "")).toEqual({
      login: "operador",
      password: "outra-senha",
    });
  });

  it("deve armazenar a sessão retornada no localStorage", async () => {
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      data: { login: "admin", password: "senha-secreta" },
    });

    const stored = window.localStorage.getItem("uaus-office-auth");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "")).toEqual(SESSION_PAYLOAD);
  });
});
