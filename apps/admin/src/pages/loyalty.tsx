import { Loader2 } from "lucide-react";
import { ConfirmDialog } from "@workspace/ui";
import { LoyaltyConfigModal } from "@/features/loyalty/components/LoyaltyConfigModal";
import { LoyaltyHeader } from "@/features/loyalty/components/LoyaltyHeader";
import { LoyaltyKpiCards } from "@/features/loyalty/components/LoyaltyKpiCards";
import { useLoyalty } from "@/features/loyalty/hooks/useLoyalty";

/**
 * Marketing › Fidelidade (01/10/2026): uma tela só, com o estado do programa,
 * a configuração num modal e os números do período (todo o período, por padrão).
 */
export default function Loyalty() {
  const loyalty = useLoyalty();

  if (loyalty.isLoadingSettings || !loyalty.settings) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <LoyaltyHeader
        settings={loyalty.settings}
        preset={loyalty.preset}
        onPresetChange={loyalty.setPreset}
        onConfigure={() => loyalty.setConfigOpen(true)}
        onTurnOn={loyalty.turnOn}
        onTurnOff={() => loyalty.setConfirmOffOpen(true)}
        isTurningOn={loyalty.isTurningOn}
      />

      <LoyaltyKpiCards summary={loyalty.summary} isLoading={loyalty.isLoadingSummary} />

      <LoyaltyConfigModal
        open={loyalty.configOpen}
        onOpenChange={loyalty.setConfigOpen}
        settings={loyalty.settings}
        coupons={loyalty.coupons}
        isSaving={loyalty.isSaving}
        onSave={loyalty.save}
      />

      <ConfirmDialog
        open={loyalty.confirmOffOpen}
        onOpenChange={loyalty.setConfirmOffOpen}
        title="Desligar o programa de fidelidade?"
        description="As vendas deixarão de ganhar carimbos automáticos e o prêmio deixará de entrar sozinho no carrinho. Cartões e prêmios já conquistados ficam guardados e podem ser trocados até vencer."
        confirmLabel="Desligar"
        onConfirm={loyalty.turnOff}
        destructive
        loading={loyalty.isTurningOff}
      />
    </div>
  );
}
