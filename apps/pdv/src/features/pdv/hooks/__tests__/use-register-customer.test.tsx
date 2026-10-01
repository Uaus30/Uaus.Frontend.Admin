import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateCustomerPayload } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

// Só a mutação que fala com a rede é dublada; `ApiError` é o real, e é por ele
// que o hook separa recusa de queda de rede.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useCreateCustomer: () => ({ mutateAsync: mocks.create, isPending: false }),
}));

const { useRegisterCustomer } = await import("../use-register-customer");
const { isUnambiguousMatch, prefillFromSearch, toConsumer } = await import("../use-customer-search");
const { useOfflineStore } = await import("@/stores/use-offline-store");
const { ApiError } = await import("@workspace/api-client-react");

const PAYLOAD: CreateCustomerPayload = {
  name: "Ana do salão",
  email: null,
  phone: "44998764321",
  document: "52998224725",
  address: null,
  gender: 1,
  ageRange: 0,
  acquisitionChannel: 0,
  city: "Tapira",
  birthDate: null,
  notes: null,
  registrationSource: 2,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function registerWith(payload = PAYLOAD) {
  const { result } = renderHook(() => useRegisterCustomer(), { wrapper });
  let outcome: Awaited<ReturnType<typeof result.current.register>> | undefined;
  await act(async () => {
    outcome = await result.current.register(payload);
  });
  return outcome!;
}

describe("useRegisterCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOfflineStore.setState({ online: true });
  });

  it("com internet, cadastra e a venda sai com o ID", async () => {
    mocks.create.mockResolvedValue({
      id: 31,
      name: "Ana do salão",
      phone: "44998764321",
      document: "52998224725",
    });

    const outcome = await registerWith();

    expect(mocks.create).toHaveBeenCalledWith({ data: PAYLOAD });
    expect(outcome).toEqual({
      kind: "registered",
      consumer: {
        customerId: 31,
        name: "Ana do salão",
        document: "529.982.247-25",
        phone: "44998764321",
        newCustomer: null,
      },
    });
  });

  it("telefone já cadastrado vira 'usar este cliente', com quem é", async () => {
    mocks.create.mockRejectedValue(
      new ApiError("Já existe um cliente com este telefone: Maria.", 409, {
        Message: "Já existe um cliente com este telefone: Maria.",
        Conflict: { Id: 7, Name: "Maria", Phone: "44998764321" },
      }),
    );

    expect(await registerWith()).toEqual({
      kind: "duplicate",
      existing: { id: 7, name: "Maria", phone: "44998764321", document: null },
    });
  });

  it("recusa de regra sobe para o diálogo mostrar", async () => {
    mocks.create.mockRejectedValue(new ApiError("CPF inválido: confira os números.", 400, {}));

    const { result } = renderHook(() => useRegisterCustomer(), { wrapper });

    await expect(result.current.register(PAYLOAD)).rejects.toThrow("CPF inválido");
  });

  it.each([
    ["queda de rede", new TypeError("Failed to fetch")],
    ["servidor fora do ar", new ApiError("Bad Gateway", 502, "Bad Gateway")],
  ])("na %s, o cadastro vai junto com a venda", async (_, error) => {
    mocks.create.mockRejectedValue(error);

    const outcome = await registerWith();

    expect(outcome).toMatchObject({
      kind: "queued",
      consumer: { customerId: null, name: "Ana do salão", newCustomer: PAYLOAD },
    });
  });

  it("sem internet, nem tenta a rede", async () => {
    useOfflineStore.setState({ online: false });

    const outcome = await registerWith();

    expect(mocks.create).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("queued");
  });
});

describe("busca de cliente do balcão", () => {
  const ana = { id: 1, name: "Ana", phone: "44998764321", document: "52998224725" };

  it.each([
    ["99876-4321", true],
    ["(44) 99876-4321", true],
    ["529.982.247-25", true],
    // Pedaço do número: pode ser outra pessoa.
    ["8764321", false],
    ["Ana", false],
  ])("'%s' aponta o cliente sem dúvida: %s", (term, expected) => {
    expect(isUnambiguousMatch(term, ana)).toBe(expected);
  });

  it("começa o cadastro com o que a busca já sabia", () => {
    expect(prefillFromSearch("Ana do salão")).toEqual({ name: "Ana do salão" });
    expect(prefillFromSearch("99876-4321")).toEqual({ phone: "99876-4321" });
    expect(prefillFromSearch("529.982.247-25")).toEqual({ document: "52998224725" });
    expect(prefillFromSearch("")).toEqual({});
  });

  it("o cliente escolhido sai com o CPF formatado para o comprovante", () => {
    expect(toConsumer(ana)).toEqual({
      customerId: 1,
      name: "Ana",
      document: "529.982.247-25",
      phone: "44998764321",
      newCustomer: null,
    });
  });
});
