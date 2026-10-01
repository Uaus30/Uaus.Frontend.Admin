import { useQuery } from "@tanstack/react-query";
import { apiGet, type BackendPagedResult, type CustomerDto } from "@workspace/api-client-react";
import { formatCpf, isValidCpf, parseCustomerSearch } from "@workspace/core";
import { searchLocalCustomers } from "@/offline";
import { useOfflineStore } from "@/stores/use-offline-store";
import type { PdvConsumer } from "@/stores/use-pdv-store";
import { MIN_SEARCH_LENGTH, useDebouncedValue } from "./use-debounced-value";

/** Resultado da busca de clientes, no mínimo que o balcão usa. */
export type CustomerOption = Pick<CustomerDto, "id" | "name" | "document" | "phone">;

/** Quantos clientes a busca mostra: o bastante para escolher, pouco para rolar. */
const RESULT_LIMIT = 8;

/**
 * Busca clientes na API e, quando ela não responde, na base local.
 *
 * A busca local existe porque identificar o cliente é parte da venda: sem ela,
 * a queda de internet obrigaria a cadastrar de novo quem já está cadastrado. As
 * duas seguem a mesma regra (telefone sem DDD, CPF com ou sem máscara, nome).
 */
async function searchCustomers(term: string, online: boolean): Promise<CustomerOption[]> {
  if (online) {
    try {
      const result = await apiGet<BackendPagedResult<CustomerDto>>("/Customers", {
        search: term,
        page: 1,
        size: RESULT_LIMIT,
      });
      // Sem corpo, cai para a base local junto com os erros de rede: no balcão,
      // busca vazia e busca que falhou têm o mesmo desfecho útil.
      if (result) return result.items ?? [];
    } catch {
      // Cai para a base local: a queda pode acontecer com o diálogo já aberto.
    }
  }

  return searchLocalCustomers(term, RESULT_LIMIT);
}

/**
 * O resultado é o cliente que o número digitado aponta sem dúvida: o telefone
 * ou o CPF exatos, ou o telefone que termina com o número dito sem DDD. É o
 * caso em que o diálogo já escolhe sozinho — "99876-4321" com um só cliente
 * terminando assim é aquele cliente.
 */
export function isUnambiguousMatch(term: string, customer: CustomerOption): boolean {
  const { digits, phoneDigits, isNumeric } = parseCustomerSearch(term);
  if (!isNumeric || digits.length < 8) return false;

  const phone = (customer.phone ?? "").replace(/\D/g, "");
  const document = (customer.document ?? "").replace(/\D/g, "");
  return document === digits || (phoneDigits.length >= 8 && phone.endsWith(phoneDigits));
}

/**
 * O que a busca já sabia vira o começo do cadastro rápido: 11 dígitos que
 * fecham como CPF vão para o CPF; outro número, para o telefone; texto, para o
 * nome. O operador não digita duas vezes o que o cliente já disse.
 */
export function prefillFromSearch(term: string): { name?: string; phone?: string; document?: string } {
  const { text, digits, isNumeric } = parseCustomerSearch(term);
  if (!text) return {};
  if (!isNumeric) return { name: text };
  return isValidCpf(digits) ? { document: digits } : { phone: text };
}

/** O cliente escolhido, como a venda o guarda. */
export function toConsumer(customer: CustomerOption): PdvConsumer {
  return {
    customerId: customer.id,
    name: customer.name,
    document: customer.document ? formatCpf(customer.document) : "",
    phone: customer.phone ?? "",
    newCustomer: null,
  };
}

/**
 * A busca de cliente do balcão, com o debounce do PDV.
 *
 * @param search O texto do campo, como está.
 * @returns Os resultados do termo já assentado (`term`) e se a busca ainda corre.
 */
export function useCustomerSearch(search: string) {
  // Campo vazio zera a busca na hora, sem esperar o debounce: quem apaga o termo
  // não pode continuar vendo a lista anterior.
  const debounced = useDebouncedValue(search.trim());
  const term = search.trim() === "" ? "" : debounced;
  const online = useOfflineStore((state) => state.online);
  const enabled = term.length >= MIN_SEARCH_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: ["pdv-customer-search", term, online],
    queryFn: () => searchCustomers(term, online),
    enabled,
  });

  return { term, enabled, results: enabled ? (data ?? []) : [], isFetching, settled: enabled && !isFetching };
}
