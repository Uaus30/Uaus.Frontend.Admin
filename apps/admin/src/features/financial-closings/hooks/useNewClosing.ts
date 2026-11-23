import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createFinancialClosing,
  getGetCapitalContributionsQueryKey,
  getGetFinancialClosingsQueryKey,
  getGetPurchaseBudgetQueryKey,
  previewFinancialClosing,
  type PreviewFinancialClosingPayload,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { formatCompetence, monthRange } from "../month-selection";
import {
  amountInputText,
  checkBalance,
  parseAmountField,
  sameWithdrawals,
  withdrawalsForShares,
  withdrawalsFromDrafts,
  type WithdrawalDrafts,
} from "../closing-balance";
import { useClosingCompetence } from "./useClosingCompetence";
import type { FinancialClosingPreviewDto, FinancialClosingVariableCostDto, NewClosingStep } from "../types";

/**
 * Entrada congelada junto com a prévia: período, gastos eventuais, retiradas e
 * o saldo inicial da implantação. É o que a confirmação envia — junto com o
 * saldo confirmado e as observações, que não mudam nenhum número da conta.
 */
type ClosingInput = Omit<PreviewFinancialClosingPayload, "closingBalance" | "balanceNotes"> & {
  variableCosts: FinancialClosingVariableCostDto[];
};

/** O saldo inicial digitado na implantação: `undefined` em branco, `null` ilegível. */
function readOpeningBalance(text: string): number | null | undefined {
  const field = parseAmountField(text);
  if (field.kind === "empty") return undefined;
  return field.kind === "value" ? field.value : null;
}

/**
 * useNewClosing
 *
 * O diálogo de novo fechamento em três passos (23/11/2026): competência →
 * resultado e caixa → retiradas e saldo. A prévia não persiste nada e a
 * confirmação RECALCULA tudo no servidor: os números exibidos são conferência.
 *
 * Toda entrada que muda a conta — gasto eventual, retirada, saldo inicial da
 * implantação — refaz a prévia no servidor, e a tela vive da resposta. O saldo
 * confirmado nasce igual ao calculado e o acompanha até alguém mexer nele.
 */
export function useNewClosing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const competence = useClosingCompetence(open);
  const [step, setStep] = useState<NewClosingStep>("competencia");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<FinancialClosingPreviewDto | null>(null);
  // A confirmação envia SEMPRE esta cópia congelada — nunca o formulário atual.
  const [previewInput, setPreviewInput] = useState<ClosingInput | null>(null);
  const [withdrawalDrafts, setWithdrawalDrafts] = useState<WithdrawalDrafts>({});
  const [openingBalanceText, setOpeningBalanceText] = useState("");
  const [closingBalanceText, setClosingBalanceText] = useState("");
  const [closingBalanceTouched, setClosingBalanceTouched] = useState(false);
  const [balanceNotes, setBalanceNotes] = useState("");

  const isImplantation = preview?.isImplantation ?? competence.next?.isImplantation ?? false;
  const draftWithdrawals = withdrawalsFromDrafts(withdrawalDrafts);
  const draftOpening = isImplantation ? readOpeningBalance(openingBalanceText) : undefined;
  const inputsInvalid = draftWithdrawals === null || draftOpening === null;
  const inputsDirty =
    previewInput !== null &&
    (inputsInvalid ||
      !sameWithdrawals(draftWithdrawals, previewInput.withdrawals) ||
      (draftOpening ?? null) !== (previewInput.openingBalance ?? null));

  // Sem ninguém mexer, o confirmado É o calculado — e o acompanha a cada recálculo.
  const closingBalanceShown = closingBalanceTouched
    ? closingBalanceText
    : amountInputText(preview?.calculatedBalance);
  const balance = checkBalance(preview?.calculatedBalance, closingBalanceShown, balanceNotes);

  const previewMutation = useMutation({
    mutationFn: (input: ClosingInput) => previewFinancialClosing(input),
    onSuccess: (data, input) => {
      if (!data) return;
      setPreview(data);
      setPreviewInput(input);
      setStep((current) => (current === "competencia" ? "resultado" : current));
      // Uma linha de retirada por sócio do rateio; o que já foi digitado fica.
      setWithdrawalDrafts((current) => {
        const next = { ...current };
        for (const share of data.shares) next[share.partnerId] ??= "";
        return next;
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao calcular a prévia",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  /** Abre o diálogo zerado; o mês sugerido chega com o `next`. */
  function openNewClosing() {
    competence.reset();
    setStep("competencia");
    setNotes("");
    setPreview(null);
    setPreviewInput(null);
    setWithdrawalDrafts({});
    setOpeningBalanceText("");
    setClosingBalanceText("");
    setClosingBalanceTouched(false);
    setBalanceNotes("");
    setOpen(true);
  }

  /** Dispara a prévia da competência; o que já foi lançado (gastos, retiradas) vai junto. */
  function handleCalculatePreview() {
    const { month, year, selected } = competence;
    if (month == null) {
      toast({
        title: "Escolha a competência",
        description: "Selecione o mês e o ano do fechamento antes de calcular a prévia.",
        variant: "destructive",
      });
      return;
    }
    if (selected?.disabled) {
      toast({
        title: "Mês indisponível",
        description: `${formatCompetence({ year, month })} não pode ser fechado agora: ${
          selected.statusLabel ??
          (selected.availability === "fechado" ? "já tem fechamento" : "fora da sequência")
        }.`,
        variant: "destructive",
      });
      return;
    }

    previewMutation.mutate({
      ...monthRange({ year, month }),
      variableCosts: previewInput?.variableCosts ?? [],
      withdrawals: draftWithdrawals ?? previewInput?.withdrawals ?? [],
      openingBalance: draftOpening ?? undefined,
    });
  }

  /** Refaz a prévia do MESMO período com outra entrada. */
  function recalculate(changes: Partial<ClosingInput>) {
    if (!previewInput || previewMutation.isPending) return;
    previewMutation.mutate({ ...previewInput, ...changes });
  }

  function handleAddVariableCost(cost: FinancialClosingVariableCostDto) {
    recalculate({ variableCosts: [...(previewInput?.variableCosts ?? []), cost] });
  }

  function handleRemoveVariableCost(index: number) {
    recalculate({ variableCosts: (previewInput?.variableCosts ?? []).filter((_cost, at) => at !== index) });
  }

  /**
   * Leva as retiradas e o saldo inicial digitados à conta (ao sair do campo).
   * Valor ilegível não vai: o campo mostra o erro e a confirmação fica travada.
   */
  function commitBalanceInputs() {
    if (!inputsDirty || draftWithdrawals === null || draftOpening === null) return;
    recalculate({ withdrawals: draftWithdrawals, openingBalance: draftOpening });
  }

  function setWithdrawal(partnerId: number, text: string) {
    setWithdrawalDrafts((current) => ({ ...current, [partnerId]: text }));
  }

  function setClosingBalance(text: string) {
    setClosingBalanceTouched(true);
    setClosingBalanceText(text);
  }

  /** Volta à competência: a prévia sai (era de outro período), o que foi digitado fica. */
  function backToCompetence() {
    setPreview(null);
    setStep("competencia");
  }

  const confirmMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createFinancialClosing>[0]) => createFinancialClosing(payload),
    onSuccess: async () => {
      // O prefixo dos fechamentos alcança a listagem, os meses fechados e o
      // `next`. A faixa ganha o saldo inicial do mês seguinte, e o mês fechado
      // deixa de aceitar aporte.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetFinancialClosingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetPurchaseBudgetQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetCapitalContributionsQueryKey() }),
      ]);
      toast({
        title: "Fechamento confirmado",
        description:
          "Os números do mês, o rateio e o saldo foram congelados. O saldo confirmado abre o mês seguinte.",
      });
      setOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao confirmar o fechamento",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  /**
   * Confirma. Retirada ou saldo inicial digitados e ainda fora da conta são
   * levados a ela primeiro — confirmar ali gravaria um saldo calculado que a
   * tela não mostrou. Recálculo em voo também trava.
   */
  function handleConfirmClosing() {
    if (!preview || !previewInput) return;
    if (confirmMutation.isPending || previewMutation.isPending) return;
    if (inputsDirty) {
      commitBalanceInputs();
      return;
    }
    if (balance.problem) {
      toast({ title: "Confira o saldo", description: balance.problem, variant: "destructive" });
      return;
    }

    confirmMutation.mutate({
      ...previewInput,
      withdrawals: withdrawalsForShares(preview.shares, previewInput.withdrawals),
      closingBalance: balance.confirmed,
      balanceNotes: balanceNotes.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return {
    open,
    step,
    competence,
    preview,
    isImplantation,
    notes,
    setNotes,
    withdrawalDrafts,
    setWithdrawal,
    openingBalanceText,
    setOpeningBalanceText,
    closingBalanceText: closingBalanceShown,
    setClosingBalance,
    balanceNotes,
    setBalanceNotes,
    balance,
    inputsInvalid,
    inputsDirty,
    isCalculating: previewMutation.isPending,
    isSaving: confirmMutation.isPending,
    canConfirm:
      preview !== null &&
      !previewMutation.isPending &&
      !confirmMutation.isPending &&
      !inputsDirty &&
      balance.problem === null,
    openNewClosing,
    closeNewClosing: () => setOpen(false),
    handleCalculatePreview,
    handleAddVariableCost,
    handleRemoveVariableCost,
    commitBalanceInputs,
    goToBalance: () => setStep("saldo"),
    backToResult: () => setStep("resultado"),
    backToCompetence,
    handleConfirmClosing,
  };
}
