import { HandCoins, Lock, Plus } from "lucide-react";
import { Button } from "@workspace/ui";
import { formatCurrency, formatMonthKey } from "@workspace/core";
import { MonthSwitcher } from "@/components/month-switcher";
import { useCapitalContributions } from "@/features/capital-contributions/hooks/useCapitalContributions";
import { CapitalContributionsTable } from "@/features/capital-contributions/components/CapitalContributionsTable";
import { CapitalContributionEditorModal } from "@/features/capital-contributions/components/CapitalContributionEditorModal";
import { PartnerTotalsCard } from "@/features/capital-contributions/components/PartnerTotalsCard";

/**
 * Aportes dos sócios (`/financeiro/aportes`).
 *
 * Página fina: o estado vive em `useCapitalContributions`. Mês fechado trava a
 * edição e a exclusão, e o motivo fica escrito acima da tabela — dica que só
 * existe no hover não existe no celular.
 */
export default function CapitalContributionsPage() {
  const contributions = useCapitalContributions();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <HandCoins className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Aportes</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            O dinheiro que os sócios põem na loja entra como saldo disponível do mês e conta na faixa de
            compras.
          </p>
        </div>

        <Button onClick={contributions.openCreate} className="gap-2 hover-elevate">
          <Plus className="h-4 w-4" /> Novo aporte
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <MonthSwitcher
          month={contributions.month}
          onChange={contributions.setMonth}
          maxMonth={contributions.currentMonth}
        />
        <p className="text-sm text-muted-foreground">
          Total do mês:{" "}
          <span className="font-semibold text-foreground">{formatCurrency(contributions.monthTotal)}</span>
        </p>
      </div>

      {contributions.isClosed && (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          {formatMonthKey(contributions.month)} já foi fechado: os aportes dele não podem ser lançados,
          alterados nem excluídos.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CapitalContributionsTable
            items={contributions.contributions}
            total={contributions.monthTotal}
            isLoading={contributions.isLoading}
            isClosed={contributions.isClosed}
            isDeleting={contributions.isDeleting}
            onEdit={contributions.openEdit}
            onDelete={contributions.handleDelete}
          />
        </div>
        <PartnerTotalsCard totals={contributions.partnerTotals} isLoading={contributions.isLoadingTotals} />
      </div>

      <CapitalContributionEditorModal
        open={contributions.modalOpen}
        editing={contributions.editing != null}
        form={contributions.form}
        partners={contributions.partnerOptions}
        onFormChange={contributions.setForm}
        onClose={contributions.closeModal}
        onSubmit={contributions.handleSubmit}
        isSaving={contributions.isSaving}
      />
    </div>
  );
}
