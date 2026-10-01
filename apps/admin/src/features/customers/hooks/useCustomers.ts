import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@workspace/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  CUSTOMER_ACQUISITION_CHANNEL,
  CUSTOMER_AGE_RANGE,
  CUSTOMER_GENDER,
  enumCode,
  getGetCustomersQueryKey,
  useCreateCustomer,
  useDeleteCustomer,
  useGetCompanySettings,
  useGetCustomerSummaries,
  useUpdateCustomer,
  type CreateCustomerPayload,
  type CustomerSummaryDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";

import type { CustomerForm, CustomerStats } from "../types";
import { cityFromCityState, describeApiError, formatCpf, formatPhone, isoDateToBr } from "@workspace/core";

/** DDD de fábrica, o mesmo do backend, enquanto a configuração da loja não chega. */
const STANDARD_AREA_CODE = 44;

/** Formulário vazio do cadastro novo. A cidade da loja entra na modal, que conhece a configuração. */
export const EMPTY_CUSTOMER_FORM: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  document: "",
  address: "",
  gender: CUSTOMER_GENDER.NotInformed,
  ageRange: CUSTOMER_AGE_RANGE.NotInformed,
  acquisitionChannel: CUSTOMER_ACQUISITION_CHANNEL.NotInformed,
  city: "",
  birthDate: "",
  notes: "",
};

/**
 * O cliente da linha da tabela no formato do formulário: telefone e CPF com a
 * máscara, nascimento em dd/mm/aaaa e os enums (que a API manda pelo nome) em
 * código.
 */
export function customerToForm(customer: CustomerSummaryDto): CustomerForm {
  return {
    name: customer.name,
    email: customer.email || "",
    phone: formatPhone(customer.phone || ""),
    document: formatCpf(customer.document || ""),
    address: customer.address || "",
    gender: enumCode(customer.gender, CUSTOMER_GENDER),
    ageRange: enumCode(customer.ageRange, CUSTOMER_AGE_RANGE),
    acquisitionChannel: enumCode(customer.acquisitionChannel, CUSTOMER_ACQUISITION_CHANNEL),
    city: customer.city || "",
    birthDate: isoDateToBr(customer.birthDate),
    notes: customer.notes || "",
  };
}

/**
 * Hook customizado para gerenciar a lógica de negócios, consultas e mutações da feature de Clientes.
 *
 * ## Por que o consolidado vem do servidor (item 4.1)
 *
 * Esta tela calculava "total gasto" e "nº de compras" no navegador: chamava
 * `useAllSales()`, que varria a tabela de vendas INTEIRA — todas as páginas, sem
 * filtro — e somava por cliente. Quinze linhas na tela custavam a operação
 * completa da loja em memória.
 *
 * Os outros `useAll*` do admin são catálogo (departamento, categoria, etiqueta) e
 * estabilizam em centenas de linhas. Venda não estabiliza nunca, e o
 * `fetchAllPages` **lança** ao passar de 20 mil itens em vez de devolver a lista
 * cortada — a tela tinha data marcada para parar de abrir.
 *
 * Hoje `GET /Customers/summary` devolve a página de clientes já com total, número
 * de compras e data da última: **uma requisição, independente do tamanho da
 * base**.
 *
 * @returns Um objeto com estados, dados de clientes, estatísticas e funções de manipulação.
 */
export function useCustomers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchVal, setSearchVal] = useState("");
  const search = useDebounce(searchVal, 300);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<CustomerForm>(EMPTY_CUSTOMER_FORM);

  // Reseta a página ao buscar
  useEffect(() => {
    setPage(1);
  }, [search]);

  // DDD padrão e cidade da loja, para o cadastro. Só com a modal aberta: a
  // listagem continua custando UMA requisição (ver o teste do hook).
  const { data: companySettings } = useGetCompanySettings({ query: { enabled: modalOpen } });

  // Query de busca paginada de clientes, já com o consolidado de compras somado
  // pelo banco.
  const { data: customersPage, isLoading } = useGetCustomerSummaries({ search, page, limit: 15 });

  /**
   * Consolidado indexado por id, do jeito que a tabela consome.
   *
   * Não é mais um CÁLCULO: os três números já vêm prontos na linha. O mapa
   * sobrevive porque é o formato que a tabela e a página recebem por prop, e
   * porque indexar quinze linhas é de graça — a conta cara saiu do navegador.
   */
  const statsByCustomerId = useMemo(() => {
    const stats = new Map<number, CustomerStats>();

    (customersPage?.data ?? []).forEach((customer) => {
      stats.set(customer.id, {
        totalPurchases: customer.totalPurchased,
        purchaseCount: customer.purchaseCount,
        lastPurchaseAt: customer.lastPurchaseAt ?? null,
      });
    });

    return stats;
  }, [customersPage?.data]);

  // Mutação para criar cliente
  const { mutate: createCustomer, isPending: isCreating } = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        toast({ title: "Sucesso", description: "Cliente cadastrado." });
        setModalOpen(false);
      },
      onError: (error) =>
        toast({
          title: "Erro ao cadastrar cliente",
          description: describeApiError(error),
          error,
          variant: "destructive",
        }),
    },
  });

  // Mutação para atualizar cliente
  const { mutate: updateCustomer, isPending: isUpdating } = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        toast({ title: "Sucesso", description: "Dados atualizados." });
        setModalOpen(false);
      },
      onError: (error) =>
        toast({
          title: "Erro ao atualizar cliente",
          description: describeApiError(error),
          error,
          variant: "destructive",
        }),
    },
  });

  // Mutação para remover cliente
  const { mutateAsync: deleteCustomerAsync, isPending: isDeleting } = useDeleteCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        toast({ title: "Removido", description: "Cliente removido." });
      },
      onError: (error) =>
        toast({
          title: "Erro ao remover cliente",
          description: describeApiError(error),
          error,
          variant: "destructive",
        }),
    },
  });

  /**
   * Abre a modal de cadastro/edição de cliente.
   * Se um cliente for fornecido, preenche o formulário para edição.
   *
   * @param customer Cliente opcional para carregar na edição.
   */
  function handleOpenModal(customer?: CustomerSummaryDto) {
    if (customer) {
      setEditingId(customer.id);
      setFormData(customerToForm(customer));
    } else {
      setEditingId(null);
      setFormData(EMPTY_CUSTOMER_FORM);
    }

    setModalOpen(true);
  }

  /**
   * Executa a remoção de um cliente.
   *
   * Devolve a Promise da mutação porque quem chama é o `ConfirmDialog`: ele só
   * fecha quando ela resolve, e permanece aberto se o servidor recusar — sem
   * isso o operador veria o diálogo sumir e teria que reencontrar a linha na
   * tabela paginada para descobrir que nada mudou. A trava de clique duplo
   * também é do diálogo.
   *
   * A confirmação NÃO mora mais aqui. O `window.confirm` que ficava neste ponto
   * travava a thread, ignorava o tema e não dava para testar; pior, a pergunta
   * "Remover este cliente?" não dizia QUAL cliente, e em tabela paginada o
   * clique no ícone da linha errada é o engano mais comum.
   *
   * @param id Identificador do cliente a ser removido.
   */
  function handleDeleteCustomer(id: number) {
    return deleteCustomerAsync({ id });
  }

  /**
   * Submete os dados do formulário de cliente para salvar/atualizar.
   *
   * O cadastro repetido (telefone ou CPF que já é de outro cliente) volta como
   * 409, e a frase do servidor já diz de quem: "Já existe um cliente com este
   * telefone: Maria." É ela que vai no toast.
   *
   * @param payload O cadastro já conferido pela modal (`checkCustomerIdentity`).
   */
  function handleSaveCustomer(payload: CreateCustomerPayload) {
    if (editingId) {
      updateCustomer({ id: editingId, data: payload });
    } else {
      createCustomer({ data: payload });
    }
  }

  return {
    customersPage,
    isLoading,
    searchVal,
    setSearchVal,
    page,
    setPage,
    modalOpen,
    setModalOpen,
    editingId,
    formData,
    statsByCustomerId,
    isSaving: isCreating || isUpdating,
    defaultAreaCode: companySettings?.defaultAreaCode ?? STANDARD_AREA_CODE,
    defaultCity: cityFromCityState(companySettings?.cityState),
    handleOpenModal,
    handleDeleteCustomer,
    /** Exclusão em andamento — o diálogo trava o segundo clique. */
    isDeleting,
    handleSaveCustomer,
  };
}
