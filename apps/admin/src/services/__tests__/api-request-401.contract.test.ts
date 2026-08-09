import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// apiRequest REAL do api-client (sem vi.mock): este teste protege o contrato do
// 401 global — token recusado pelo servidor limpa a sessão local e leva o app
// para a tela de login, sem tocar em nada além da chave de autenticação.
import {
  apiRequest,
  getAuthSession,
  resetUnauthorizedRedirect,
  setAuthSession,
} from "@workspace/api-client-react";

const SESSION = {
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
    value: "token-vencido",
    expiration: "2099-01-01T00:00:00",
  },
};

/** Resposta mínima que o `apiRequest` consome (status + corpo em texto). */
function fetchRespondingWith(status: number, body: unknown = { message: "Unauthorized" }) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }));
}

const originalLocation = window.location;

/**
 * Substitui o `window.location` inteiro: o jsdom marca `assign` como não
 * configurável ([LegacyUnforgeable]) e um `vi.spyOn` direto é recusado, mas a
 * propriedade `location` do próprio `window` é substituível.
 */
function stubLocation(pathname: string) {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: originalLocation.origin, pathname, assign },
  });
  return assign;
}

describe("apiRequest (contrato do 401 global)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setAuthSession(SESSION);
    resetUnauthorizedRedirect();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    vi.unstubAllGlobals();
  });

  it("deve limpar a sessão e redirecionar para o login no 401 autenticado", async () => {
    const assign = stubLocation("/vendas");
    vi.stubGlobal("fetch", fetchRespondingWith(401));

    // O erro continua subindo para quem chamou — o redirecionamento é extra.
    await expect(apiRequest("GET", "/Sales")).rejects.toMatchObject({ status: 401 });

    expect(getAuthSession()).toBeNull();
    expect(assign).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("deve redirecionar uma única vez mesmo com vários 401 em sequência", async () => {
    // Uma tela costuma ter várias queries em voo; todas respondem 401 juntas
    // quando o token vence, e só a primeira pode disparar a navegação.
    const assign = stubLocation("/vendas");
    vi.stubGlobal("fetch", fetchRespondingWith(401));

    await expect(apiRequest("GET", "/Sales")).rejects.toMatchObject({ status: 401 });
    await expect(apiRequest("GET", "/Products")).rejects.toMatchObject({ status: 401 });

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("não deve redirecionar nem limpar a sessão no 401 do login (auth: false)", async () => {
    // No formulário de login o 401 é credencial errada: a mensagem precisa
    // aparecer para o usuário, não virar um recarregamento da página.
    const assign = stubLocation("/login");
    vi.stubGlobal("fetch", fetchRespondingWith(401, { message: "Usuário ou senha inválidos" }));

    await expect(
      apiRequest("POST", "/Users/authenticate", {
        body: { login: "admin", password: "senha-errada" },
        auth: false,
      }),
    ).rejects.toMatchObject({ status: 401 });

    expect(getAuthSession()).toEqual(SESSION);
    expect(assign).not.toHaveBeenCalled();
  });

  it("não deve navegar quando já está na tela de login", async () => {
    // Um 401 de query em segundo plano na própria tela de login não pode virar
    // um laço de recarregamentos. A sessão inválida ainda é limpa.
    const assign = stubLocation("/login");
    vi.stubGlobal("fetch", fetchRespondingWith(401));

    await expect(apiRequest("GET", "/Sales")).rejects.toMatchObject({ status: 401 });

    expect(getAuthSession()).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("não deve tratar outros erros como sessão expirada", async () => {
    const assign = stubLocation("/vendas");
    vi.stubGlobal("fetch", fetchRespondingWith(500, { message: "Erro interno" }));

    await expect(apiRequest("GET", "/Sales")).rejects.toMatchObject({ status: 500 });

    expect(getAuthSession()).toEqual(SESSION);
    expect(assign).not.toHaveBeenCalled();
  });

  it("deve remover apenas a chave de autenticação do armazenamento local", async () => {
    // As filas offline do PDV vivem no IndexedDB e ficam intactas por contrato;
    // aqui garantimos o equivalente observável — nenhuma outra chave é tocada.
    window.localStorage.setItem("uaus-pdv-fila-marcador", "intacta");
    stubLocation("/vendas");
    vi.stubGlobal("fetch", fetchRespondingWith(401));

    await expect(apiRequest("GET", "/Sales")).rejects.toMatchObject({ status: 401 });

    expect(window.localStorage.getItem("uaus-office-auth")).toBeNull();
    expect(window.localStorage.getItem("uaus-pdv-fila-marcador")).toBe("intacta");
  });
});
