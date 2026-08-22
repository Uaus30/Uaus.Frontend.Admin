import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "../layout";

const mocks = vi.hoisted(() => ({
  useGetMe: vi.fn(),
  useLogout: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetMe: mocks.useGetMe,
  useLogout: mocks.useLogout,
}));

describe("AppLayout header version", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.stubEnv("VITE_APP_VERSION", "1.0.144");
    vi.stubEnv("VITE_BUILD_TIME", "2026-08-22T15:45:12Z");


    mocks.useGetMe.mockReturnValue({
      data: {
        id: 1,
        name: "Administrador",
        role: "ADMIN",
      },
      isLoading: false,
    });

    mocks.useLogout.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it("renderiza a versão e a data de atualização formatadas no cabeçalho", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AppLayout>
          <div>Conteúdo Principal</div>
        </AppLayout>
      </QueryClientProvider>
    );

    const versionBlock = screen.getByTestId("header-version");
    expect(versionBlock).toBeDefined();
    expect(versionBlock.textContent).toContain("Versão 1.0.144");
    expect(versionBlock.textContent).toContain("Atualizado em 22/08/2026 às 12:45:12");
  });
});

