import { ApiError, useCreateCustomer, type CreateCustomerPayload } from "@workspace/api-client-react";
import { formatCpf, readDuplicateCustomer } from "@workspace/core";
import { useOfflineStore } from "@/stores/use-offline-store";
import type { PdvConsumer } from "@/stores/use-pdv-store";
import { toConsumer, type CustomerOption } from "./use-customer-search";

/** O desfecho do cadastro rápido, do jeito que o diálogo precisa reagir. */
export type RegisterCustomerOutcome =
  /** Cadastrado no servidor: a venda já sai com o ID. */
  | { kind: "registered"; consumer: PdvConsumer }
  /** Telefone ou CPF de outro cliente: o diálogo oferece usar o existente. */
  | { kind: "duplicate"; existing: CustomerOption }
  /** Sem internet: o cadastro vai junto com a venda e o servidor o resolve. */
  | { kind: "queued"; consumer: PdvConsumer };

/** O cliente cadastrado sem internet, ainda sem ID, como a venda o leva. */
function queuedConsumer(payload: CreateCustomerPayload): PdvConsumer {
  return {
    customerId: null,
    name: payload.name,
    document: payload.document ? formatCpf(payload.document) : "",
    phone: payload.phone ?? "",
    newCustomer: payload,
  };
}

/**
 * Cadastro rápido do cliente no caixa (01/10/2026).
 *
 * Com internet, grava no servidor na hora e a venda sai com o ID. Sem internet
 * — ou quando o servidor não responde —, o cadastro vai junto com a venda
 * (`newCustomer`) e o servidor acha quem tem aquele telefone ou CPF, ou cria,
 * quando a fila subir. O operador não fica esperando a rede para atender.
 *
 * Recusa do servidor (`ApiError` 4xx) é regra de negócio, não falta de conexão:
 * o 409 do cadastro repetido vira "usar este cliente"; o resto sobe para o
 * diálogo mostrar a frase. Diferente da venda, o 5xx também vai para a fila:
 * o servidor acha ou cria o cliente pelo telefone quando voltar, sem risco de
 * cadastro duplo.
 */
export function useRegisterCustomer() {
  const online = useOfflineStore((state) => state.online);
  const { mutateAsync, isPending } = useCreateCustomer();

  async function register(payload: CreateCustomerPayload): Promise<RegisterCustomerOutcome> {
    if (!online) return { kind: "queued", consumer: queuedConsumer(payload) };

    let created: Awaited<ReturnType<typeof mutateAsync>>;
    try {
      created = await mutateAsync({ data: payload });
    } catch (error) {
      // 5xx é o servidor fora do ar, não uma recusa: o cadastro sobe com a venda.
      if (error instanceof ApiError && error.status < 500) {
        const existing = readDuplicateCustomer(error);
        if (existing) return { kind: "duplicate", existing };
        throw error;
      }
      return { kind: "queued", consumer: queuedConsumer(payload) };
    }

    if (!created?.id) throw new Error("Não foi possível identificar o cliente cadastrado.");
    return { kind: "registered", consumer: toConsumer(created) };
  }

  return { register, isRegistering: isPending };
}
