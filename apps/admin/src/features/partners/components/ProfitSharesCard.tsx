import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Loader2, Percent, Save } from "lucide-react";
import type { PartnerProfitShareItemDto } from "../types";

interface ProfitSharesCardProps {
  /** Somente sócios ATIVOS — o backend exige exatamente esse conjunto ao salvar. */
  shares: PartnerProfitShareItemDto[];
  isLoading: boolean;
  /** Percentuais digitados, por id de sócio. */
  draftPercentages: Record<number, string>;
  onPercentageChange: (partnerId: number, value: string) => void;
  /** Normaliza o percentual para 2 casas ao sair do campo (precisão do backend). */
  onPercentageBlur: (partnerId: number) => void;
  /** Soma ao vivo dos percentuais digitados (2 casas). */
  sum: number;
  isSumValid: boolean;
  canSave: boolean;
  isSaving: boolean;
  onSubmit: (e: FormEvent) => void;
}

/** Soma no formato pt-BR, sem casas desnecessárias (95 → "95", 33,33 → "33,33"). */
function formatSum(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/**
 * ProfitSharesCard
 *
 * Edição da distribuição de lucros: um percentual por sócio ativo, com a soma
 * ao vivo. O botão de salvar só libera com soma exata de 100% e alguma mudança
 * pendente — a mesma validação que o backend aplica.
 */
export function ProfitSharesCard({
  shares,
  isLoading,
  draftPercentages,
  onPercentageChange,
  onPercentageBlur,
  sum,
  isSumValid,
  canSave,
  isSaving,
  onSubmit,
}: ProfitSharesCardProps) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Percent className="w-4 h-4 text-primary" />
          Distribuição de Lucros
        </CardTitle>
        <CardDescription>
          Percentual do lucro líquido de cada sócio ativo. A soma deve fechar em 100%.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : shares.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum sócio ativo. Cadastre ou reative um sócio para configurar os percentuais.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-3">
              {shares.map((share) => (
                <div
                  key={share.partnerId}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-background/50 p-3"
                >
                  <Label
                    htmlFor={`share-${share.partnerId}`}
                    className="text-sm font-medium truncate"
                  >
                    {share.partnerName}
                  </Label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      id={`share-${share.partnerId}`}
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      className="w-24 text-right"
                      value={draftPercentages[share.partnerId] ?? ""}
                      onChange={(e) => onPercentageChange(share.partnerId, e.target.value)}
                      onBlur={() => onPercentageBlur(share.partnerId)}
                      disabled={isSaving}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <span
                className={`text-sm font-medium ${
                  isSumValid ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {isSumValid
                  ? `Soma: ${formatSum(sum)}%`
                  : `Soma: ${formatSum(sum)}% — deve ser 100%`}
              </span>

              <Button type="submit" disabled={!canSave || isSaving} className="hover-elevate">
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Fechamentos existentes não mudam: o rateio deles foi congelado na confirmação.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
