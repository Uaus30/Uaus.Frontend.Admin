import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Undo2 } from "lucide-react";
import { Button, Spinner, useToast } from "@workspace/ui";
import { describeApiError, formatDate } from "@workspace/core";
import {
  enumCode,
  getGetInventoryCountsQueryKey,
  INVENTORY_COUNT_STATUS,
  reviewInventoryCountProduct,
  useGetInventoryCountProductState,
  type InventoryCountDto,
} from "@workspace/api-client-react";

import { inventoryCountTabPathname } from "@/features/inventory/inventory-tabs";
import { cameFromInventoryCount } from "../lib/product-conference-link";

type ProductConferenceBannerProps = {
  /** Grupo aberto na tela. `null` em cadastro novo — que não está em conferência nenhuma. */
  productGroupId: number | null;
};

/**
 * A tarja da conferência dentro da tela do produto.
 *
 * É o que torna a conferência **dinâmica**: em vez de uma tela própria de
 * edição, o operador usa a tela de produto que já existe — foto, nome, preço,
 * variações e a contagem de estoque — e marca "conferido" ali mesmo, sem voltar
 * à lista.
 *
 * Só aparece quando o cadastro faz parte de uma conferência ABERTA. Fora disso
 * não renderiza nada: uma tarja permanente em toda tela de produto viraria
 * ruído em 90% das aberturas.
 *
 * As cores seguem o vocabulário do repositório
 * (`Uaus.Docs/dominio/convencoes-de-interface.md`): âmbar para o que ainda
 * espera ação, verde para o que já foi feito — com ícone e rótulo, nunca cor
 * sozinha.
 */
export function ProductConferenceBanner({ productGroupId }: ProductConferenceBannerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Lido uma vez: a tela reescreve a barra de endereços enquanto o produto é
  // editado, e consultar depois devolveria `false` para quem veio da lista.
  const [voltarParaConferencia] = useState(cameFromInventoryCount);

  const { data: state } = useGetInventoryCountProductState(productGroupId);

  const mutation = useMutation({
    mutationFn: (reviewed: boolean) => reviewInventoryCountProduct(productGroupId!, reviewed),
    onSuccess: async (count, reviewed) => {
      await queryClient.invalidateQueries({ queryKey: getGetInventoryCountsQueryKey() });
      avisar(count, reviewed);
      if (reviewed && voltarParaConferencia) navigate(inventoryCountTabPathname());
    },
    onError: (error: unknown) =>
      toast({
        title: "Não foi possível registrar a conferência",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      }),
  });

  function avisar(count: InventoryCountDto, reviewed: boolean) {
    if (!reviewed) {
      toast({ title: "Produto devolvido à lista", description: "Ele volta a aparecer entre os pendentes." });
      return;
    }

    if (enumCode(count.status, INVENTORY_COUNT_STATUS) === INVENTORY_COUNT_STATUS.Finished) {
      toast({
        title: "Conferência concluída!",
        description: `Este era o último dos ${count.totalItems} cadastros. A conferência foi encerrada.`,
      });
      return;
    }

    toast({
      title: "Produto conferido",
      description: `Faltam ${count.pendingItems} de ${count.totalItems} na conferência.`,
    });
  }

  if (!state?.inCount) return null;

  const conferido = state.reviewed;

  return (
    <div
      data-testid="product-conference-banner"
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        conferido ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"
      }`}
    >
      <p
        className={`flex items-center gap-2 text-sm font-medium ${
          conferido ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
        }`}
      >
        {conferido ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <ClipboardCheck className="h-4 w-4 shrink-0" />
        )}
        {conferido ? (
          <span>
            Conferido{state.reviewedAt ? ` em ${formatDate(state.reviewedAt)}` : ""} — este cadastro já saiu
            da lista da conferência.
          </span>
        ) : (
          <span>
            Este produto está na <strong>conferência em andamento</strong>. Acerte foto, dados, variações e
            estoque e marque como conferido.
          </span>
        )}
      </p>

      <span className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hover-elevate gap-1.5"
          onClick={() => navigate(inventoryCountTabPathname())}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Ver conferência
        </Button>
        <Button
          type="button"
          size="sm"
          variant={conferido ? "outline" : "default"}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(!conferido)}
          className="hover-elevate gap-1.5"
        >
          {mutation.isPending ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : conferido ? (
            <Undo2 className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {conferido ? "Desfazer conferência" : "Marcar como conferido"}
        </Button>
      </span>
    </div>
  );
}
