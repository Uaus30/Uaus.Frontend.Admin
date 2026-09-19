import { useEffect } from "react";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router as WouterRouter } from "wouter";
import { memoryLocation } from "wouter/memory-location";

/**
 * O contrato da casca do admin.
 *
 * Duas propriedades que a estrutura do `App.tsx` precisa manter, e que só
 * aparecem quando alguém navega:
 *
 * 1. **A casca não desmonta entre telas.** O `AppLayout` morava dentro de cada
 *    uma das 33 páginas, e o `fallback` do `Suspense` era de tela cheia: trocar
 *    de menu apagava a barra lateral até o chunk da rota chegar, e a tela
 *    "piscava escuro" a cada navegação (relatado pelo dono em 19/09/2026).
 * 2. **A 404 continua respondendo SEM sessão.** É decisão registrada em
 *    `pages/not-found.tsx`: quem digitou um endereço errado precisa ler "não
 *    existe", e não cair num login que não leva a lugar nenhum. Içar a casca
 *    para fora das páginas é exatamente a mudança capaz de quebrar isso, porque
 *    a tentação é pôr o coringa dentro do `AuthGate`.
 *
 * As rotas e a casca são dubladas de propósito: o que está sob teste é a
 * ESTRUTURA do `App.tsx` — quem fica montado e quem fica de fora —, não o
 * conteúdo de nenhuma página.
 */

const montagens = { casca: 0 };

vi.mock("@/components/layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
      montagens.casca += 1;
    }, []);

    return <div data-testid="casca">{children}</div>;
  },
}));

vi.mock("@/components/route-guards", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-gate">{children}</div>,
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/routes", () => ({
  ROUTES: [
    { path: "/login", component: () => <div data-testid="login" />, publica: true },
    { path: "/dashboard", component: () => <div data-testid="dashboard" /> },
    { path: "/produtos", component: () => <div data-testid="produtos" /> },
  ],
  NOT_FOUND_COMPONENT: () => <div data-testid="nao-encontrada" />,
}));

const { Router } = await import("../App");

function renderApp(inicial: string) {
  const { hook, navigate } = memoryLocation({ path: inicial });

  render(
    <WouterRouter hook={hook}>
      <Router />
    </WouterRouter>,
  );

  return navigate;
}

beforeEach(() => {
  montagens.casca = 0;
});

afterEach(cleanup);

describe("casca do admin", () => {
  it("mantém a casca montada ao trocar de tela privada", async () => {
    const navigate = renderApp("/dashboard");

    await waitFor(() => expect(screen.getByTestId("dashboard")).toBeTruthy());
    expect(montagens.casca).toBe(1);

    act(() => navigate("/produtos"));

    await waitFor(() => expect(screen.getByTestId("produtos")).toBeTruthy());

    // A propriedade inteira do trabalho: UMA montagem para as duas telas. Com o
    // `AppLayout` dentro das páginas isto daria 2, e cada navegação apagaria a
    // barra lateral até o chunk chegar.
    expect(montagens.casca).toBe(1);
    expect(screen.getByTestId("casca")).toBeTruthy();
  });

  it("deixa a 404 FORA da casca e fora do AuthGate", async () => {
    renderApp("/endereco-que-nao-existe");

    await waitFor(() => expect(screen.getByTestId("nao-encontrada")).toBeTruthy());

    expect(screen.queryByTestId("casca")).toBeNull();
    expect(screen.queryByTestId("auth-gate")).toBeNull();
    expect(montagens.casca).toBe(0);
  });

  it("deixa a tela pública fora da casca", async () => {
    renderApp("/login");

    await waitFor(() => expect(screen.getByTestId("login")).toBeTruthy());

    expect(screen.queryByTestId("casca")).toBeNull();
    expect(screen.queryByTestId("auth-gate")).toBeNull();
  });

  it("a raiz redireciona para o dashboard, dentro da casca", async () => {
    renderApp("/");

    await waitFor(() => expect(screen.getByTestId("dashboard")).toBeTruthy());
    expect(screen.getByTestId("casca")).toBeTruthy();
  });
});
