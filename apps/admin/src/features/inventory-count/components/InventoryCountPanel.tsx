import { ConfirmDialog } from "@workspace/ui";

import { useInventoryCount } from "../hooks/useInventoryCount";
import { InventoryCountProgress } from "./InventoryCountProgress";
import { InventoryCountStart } from "./InventoryCountStart";
import { InventoryCountTable } from "./InventoryCountTable";

/**
 * A aba **Conferência de Produtos**, inteira.
 *
 * Dois modos, decididos por uma pergunta só — há conferência aberta? Sem ela, a
 * aba é o convite a começar; com ela, é o progresso mais a lista do que falta.
 */
export function InventoryCountPanel() {
  const state = useInventoryCount();

  if (!state.count) {
    return (
      <InventoryCountStart
        isLoading={state.isLoadingCount}
        lastCount={state.lastCount}
        onStart={state.start}
        startingMode={state.startingMode}
        loadFailed={state.loadFailed}
        onRetry={state.retryLoad}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <InventoryCountProgress
        count={state.count}
        onFinish={state.askFinish}
        isFinishing={state.isFinishing}
      />

      <InventoryCountTable state={state} />

      <ConfirmDialog
        open={state.finishAsked}
        onOpenChange={(open) => {
          if (!open) state.cancelFinish();
        }}
        title="Encerrar esta rodada da conferência?"
        description={
          <>
            Ainda faltam <strong>{state.count.pendingItems}</strong> de {state.count.totalItems} cadastros.
            Eles <strong>não</strong> serão marcados como conferidos: ficam para a próxima rodada, em
            &ldquo;Continuar de onde parou&rdquo;. Encerrar libera o estoque — o PDV volta a vender.
          </>
        }
        confirmLabel="Encerrar"
        loading={state.isFinishing}
        onConfirm={state.confirmFinish}
      />
    </div>
  );
}
