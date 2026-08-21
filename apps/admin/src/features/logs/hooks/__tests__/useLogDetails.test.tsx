import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemLogDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetLog: vi.fn(),
  markLogAsVerified: vi.fn(),
  toast: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLog: mocks.useGetLog,
  markLogAsVerified: mocks.markLogAsVerified,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("wouter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/sistema/logs/188", mocks.setLocation] as const,
}));

const { getGetLogQueryKey, getGetLogsQueryKey } = await import("@workspace/api-client-react");
const { useLogDetails } = await import("../useLogDetails");

const pendingLog: SystemLogDto = {
  id: 188,
  createdAt: "2026-08-21T16:00:00-03:00",
  updatedAt: null,
  code: "LOG-188",
  requestId: null,
  type: "Critical",
  requiresVerification: true,
  origin: "Api",
  message: "Falha crítica",
  details: null,
};

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useLogDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetLog.mockReturnValue({
      data: pendingLog,
      isLoading: false,
      isError: false,
      error: null,
    });
    mocks.markLogAsVerified.mockResolvedValue({
      ...pendingLog,
      requiresVerification: false,
      updatedAt: "2026-08-21T17:00:00-03:00",
    });
  });

  it("atualiza o detalhe e invalida todas as listagens depois de verificar", async () => {
    const { queryClient, wrapper } = createHarness();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useLogDetails("188"), { wrapper });

    act(() => result.current.markAsVerified());

    await waitFor(() => expect(mocks.markLogAsVerified).toHaveBeenCalledWith(188));
    await waitFor(() =>
      expect(queryClient.getQueryData([...getGetLogQueryKey(), 188])).toEqual(
        expect.objectContaining({ requiresVerification: false }),
      ),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: getGetLogsQueryKey() });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Log marcado como verificado" }),
    );
  });

  it("mantém a pendência e informa o erro quando a atualização falha", async () => {
    mocks.markLogAsVerified.mockRejectedValueOnce(new Error("Falha de rede"));
    const { queryClient, wrapper } = createHarness();
    const { result } = renderHook(() => useLogDetails("188"), { wrapper });

    act(() => result.current.markAsVerified());

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Erro ao verificar o log", variant: "destructive" }),
      ),
    );
    expect(queryClient.getQueryData([...getGetLogQueryKey(), 188])).toBeUndefined();
    expect(result.current.log?.requiresVerification).toBe(true);
  });
});
