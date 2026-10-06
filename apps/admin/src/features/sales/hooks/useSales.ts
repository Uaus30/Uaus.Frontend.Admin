import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@workspace/ui";
import {
  useGetSales,
  useGetPaymentMethods,
  useGetCompanySettings,
  getGetSalesQueryKey,
  PAYMENT_STATUS,
  enumCode,
  type SaleDto,
} from "@workspace/api-client-react";
import { buildReceiptFromSale, printReceipt, resolveStoreInfo } from "@workspace/receipt";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { getEnumOptions } from "@/services/core";
import { orderCatalogByName } from "@/lib/select-options";

import { deleteSaleWithItems, getSaleItems } from "@/services/sales.service";
import type { EnrichedSale } from "../types";
import { useAllCustomers } from "@/hooks/use-catalog";
import { useNewSaleDraft } from "./useNewSaleDraft";

/**
 * Itens por página do histórico de vendas.
 *
 * Constante em vez de literal porque o rodapé precisa do MESMO número para
 * derivar o total de páginas: enquanto ele era `15` no hook e `15` de reserva
 * na tabela, mudar um dos dois desalinhava a contagem sem quebrar nada visível.
 */
export const SALES_PAGE_SIZE = 15;

/**
 * useSales
 *
 * Hook customizado para gerenciar a listagem, detalhamento de vendas,
 * a reimpressão e a remoção. O rascunho da Nova venda mora no `useNewSaleDraft`
 * (06/10/2026), e a correção da venda no `useEditSaleHeader`.
 */
export function useSales() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewSaleId, setViewSaleId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Query: Busca vendas paginadas com filtros
  // O backend compara `CreatedAt <= endDate` com hora; enviar só "yyyy-MM-dd"
  // (meia-noite) excluiria o último dia inteiro do período. O fim do dia vai no
  // fuso LOCAL, sem toISOString (ver docs/fuso-horario.md do backend).
  const { data: salesPage, isLoading } = useGetSales({
    search: debouncedSearch.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate ? `${endDate}T23:59:59` : undefined,
    paymentMethodId: paymentMethodFilter !== "all" ? Number(paymentMethodFilter) : undefined,
    paymentStatus: paymentStatusFilter !== "all" ? Number(paymentStatusFilter) : undefined,
    page,
    limit: SALES_PAGE_SIZE,
  });

  // Query: Carrega formas de pagamento cadastradas
  const { data: dbPaymentMethodsData } = useGetPaymentMethods({ page: 1, size: 100 });
  // Alfabética, como todo select do admin. O PDV é outra história: lá os
  // botões seguem a ORDEM DE CADASTRO (regra 12 do README do PDV), porque a
  // posição de cada forma é decorada pelo operador.
  const dbPaymentMethods = useMemo(
    () => orderCatalogByName(dbPaymentMethodsData?.data ?? []),
    [dbPaymentMethodsData?.data],
  );

  // Query: Identidade da loja para o cabeçalho do cupom reimpresso. Compartilha
  // a COMPANY_SETTINGS_QUERY_KEY com a tela de configurações — salvar lá já
  // invalida aqui. Enquanto (ou se) a leitura não chega, `resolveStoreInfo`
  // imprime os padrões embutidos.
  const { data: companySettings } = useGetCompanySettings();

  // Query: Carrega todos os clientes para o select do checkout
  const { data: customers = [] } = useAllCustomers();

  // Query: Carrega enums de status de pagamento
  const { data: paymentStatuses = [] } = useQuery({
    queryKey: ["payment-status-options"],
    queryFn: () => getEnumOptions("/Sales/enums/payment-status"),
  });

  // Mapeador de métodos de pagamento por ID
  const paymentMethodById = useMemo(
    () => Object.fromEntries(dbPaymentMethods.map((item) => [item.id, item.name])),
    [dbPaymentMethods],
  );

  // Lista de vendas enriquecida com cliente
  const saleDetails = useMemo<EnrichedSale[]>(() => {
    if (!salesPage) return [];
    const customersById = new Map(customers.map((item) => [item.id, item]));
    return salesPage.data.map((sale) => ({
      ...sale,
      customer: sale.customerId ? (customersById.get(sale.customerId) ?? null) : null,
      items: [],
    })) as EnrichedSale[];
  }, [customers, salesPage]);

  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);
  const [printingSaleId, setPrintingSaleId] = useState<number | null>(null);
  // A venda aberta para correção (a venda COMPLETA da API, com as formas).
  const [saleToEdit, setSaleToEdit] = useState<SaleDto | null>(null);

  const newSale = useNewSaleDraft(dbPaymentMethods, () => setCreateModalOpen(false));

  /** Abre a Nova venda sempre em branco, com o relógio de agora. */
  function openNewSale() {
    newSale.reset();
    setCreateModalOpen(true);
  }

  const saleToView = useMemo(() => {
    return saleDetails.find((sale) => sale.id === viewSaleId) ?? null;
  }, [saleDetails, viewSaleId]);

  /**
   * Reimprime o cupom de uma venda já registrada.
   *
   * A listagem não traz os itens, então eles são buscados na hora. Todo cupom
   * saído do painel é segunda via — a primeira sai do PDV no ato da venda.
   */
  async function handlePrintReceipt(saleId: number) {
    const sale = saleDetails.find((item) => item.id === saleId);
    if (!sale) return;

    setPrintingSaleId(saleId);
    try {
      const saleItems = await getSaleItems(saleId);
      await printReceipt(
        buildReceiptFromSale(sale, saleItems, {
          // O consumidor não precisa de contexto: o cupom o identifica só pelo
          // documento, e a venda já vem com ele resolvido pelo backend (do
          // cadastro quando há cliente, senão o informado no balcão).
          paymentMethodNameById: paymentMethodById,
          reprint: true,
          cancelled: enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled,
          // Identidade do cadastro da empresa; campo vazio cai no padrão
          // embutido — o mesmo caminho do cupom original do PDV.
          store: resolveStoreInfo(companySettings),
        }),
      );
    } catch (error) {
      toast({
        title: "Erro ao gerar o cupom",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      });
    } finally {
      setPrintingSaleId(null);
    }
  }

  /**
   * Exclui uma venda e seus itens associados.
   */
  async function handleDeleteSale(saleId: number) {
    setDeletingSaleId(saleId);
    try {
      await deleteSaleWithItems(saleId);
      await queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
      toast({ title: "Venda removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover venda",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      });
    } finally {
      setDeletingSaleId(null);
    }
  }

  return {
    page,
    setPage,
    createModalOpen,
    setCreateModalOpen,
    viewSaleId,
    setViewSaleId,
    salesPage,
    isLoading,
    customers,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    paymentMethodFilter,
    setPaymentMethodFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    paymentMethods: dbPaymentMethods,
    paymentStatuses,
    paymentMethodById,
    saleDetails,
    newSale,
    openNewSale,
    saleToEdit,
    setSaleToEdit,
    deletingSaleId,
    printingSaleId,
    saleToView,
    handleDeleteSale,
    handlePrintReceipt,
  };
}
