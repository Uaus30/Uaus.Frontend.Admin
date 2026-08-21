import { Button } from "@workspace/ui";
import { CheckCircle2, CircleCheckBig, Loader2, ShieldAlert } from "lucide-react";

interface LogVerificationBannerProps {
  requiresVerification: boolean;
  isVerifying: boolean;
  onVerify: () => void;
}

/**
 * Sinaliza o estado humano do log crítico sem competir com seu conteúdo
 * técnico. A mesma cor da listagem cria continuidade visual entre as telas.
 */
export function LogVerificationBanner({
  requiresVerification,
  isVerifying,
  onVerify,
}: LogVerificationBannerProps) {
  if (!requiresVerification) {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-xl border border-emerald-700 bg-emerald-600 px-4 py-3 text-white shadow-sm shadow-emerald-950/20"
      >
        <CircleCheckBig className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Log verificado</p>
          <p className="text-sm text-emerald-50">A ocorrência já passou por verificação humana.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-700 bg-red-600 px-4 py-3 text-white shadow-sm shadow-red-950/30 sm:flex-row sm:items-center sm:justify-between">
      <div role="status" className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-semibold">Verificação humana pendente</p>
          <p className="text-sm text-red-50">Este erro crítico ainda precisa ser analisado.</p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0 gap-2 bg-white text-red-700 hover:bg-red-50"
        disabled={isVerifying}
        onClick={onVerify}
      >
        {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {isVerifying ? "Marcando..." : "Marcar como verificado"}
      </Button>
    </div>
  );
}
