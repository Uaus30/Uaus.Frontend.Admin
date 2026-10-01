import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adjustLoyaltyStamps,
  getGetCustomersQueryKey,
  getLoyaltyDashboardQueryKey,
  getLoyaltyStatementQueryKey,
  useGetCompanySettings,
  useGetLoyaltyStatement,
  type CustomerSummaryDto,
} from "@workspace/api-client-react";
import { printLoyaltyStatement, resolveStoreInfo } from "@workspace/receipt";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { toStatementReceipt } from "../lib/loyalty-statement";

/**
 * O cartão fidelidade de um cliente na tela de clientes (entrega 5, 01/10/2026):
 * o extrato com a data de cada carimbo, a impressão na impressora da loja e o
 * ajuste manual, sempre com motivo.
 */
export function useCustomerLoyalty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<CustomerSummaryDto | null>(null);

  const statement = useGetLoyaltyStatement(customer?.id ?? null, { query: { staleTime: 0 } });
  const { data: companySettings } = useGetCompanySettings({ query: { enabled: customer !== null } });

  const adjust = useMutation({
    mutationFn: ({ points, reason }: { points: number; reason: string }) =>
      adjustLoyaltyStamps(customer!.id, { points, reason }),
    onSuccess: async (outcome) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getLoyaltyStatementQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getLoyaltyDashboardQueryKey() }),
      ]);
      toast({
        title: "Ajuste gravado",
        description: outcome?.card
          ? `Saldo: ${outcome.card.stamps} de ${outcome.card.stampsRequired} carimbos.`
          : "O extrato já mostra o ajuste.",
      });
    },
    onError: (error) =>
      toast({
        title: "Não foi possível ajustar",
        description: describeApiError(error),
        error,
        variant: "destructive",
      }),
  });

  const print = () => {
    if (!statement.data) return;
    void printLoyaltyStatement(toStatementReceipt(statement.data, resolveStoreInfo(companySettings)));
  };

  return {
    customer,
    open: (target: CustomerSummaryDto) => setCustomer(target),
    close: () => setCustomer(null),
    statement: statement.data,
    isLoading: statement.isLoading,
    print,
    adjust: (points: number, reason: string) => adjust.mutateAsync({ points, reason }),
    isAdjusting: adjust.isPending,
  };
}
