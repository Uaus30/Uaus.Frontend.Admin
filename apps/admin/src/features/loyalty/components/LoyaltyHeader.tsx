import { AlertTriangle, Loader2, Power, PowerOff, Settings2 } from "lucide-react";
import type { LoyaltySettingsDto } from "@workspace/api-client-react";
import { Badge, Button, cn } from "@workspace/ui";
import { formatShortDate } from "@workspace/core";
import { describeRule } from "../lib/loyalty-form";
import type { LoyaltyPeriodPreset } from "../types";

const PRESETS: { value: LoyaltyPeriodPreset; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "this-month", label: "Este mês" },
  { value: "last-month", label: "Mês passado" },
  { value: "90-days", label: "90 dias" },
];

type LoyaltyHeaderProps = {
  settings: LoyaltySettingsDto;
  preset: LoyaltyPeriodPreset;
  onPresetChange: (preset: LoyaltyPeriodPreset) => void;
  onConfigure: () => void;
  onTurnOn: () => void;
  onTurnOff: () => void;
  isTurningOn: boolean;
};

/**
 * O topo da tela: ligado ou desligado (desde quando), a regra numa linha, e os
 * botões. Ligar só fica disponível com a configuração completa e os cupons
 * válidos; o que falta aparece logo abaixo, frase por frase.
 */
export function LoyaltyHeader({
  settings,
  preset,
  onPresetChange,
  onConfigure,
  onTurnOn,
  onTurnOff,
  isTurningOn,
}: LoyaltyHeaderProps) {
  const blocked = settings.turnOnBlockers.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-3xl font-bold text-foreground">
            Programa de fidelidade
            {settings.isActive ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                Ligado{settings.activeSince ? ` desde ${formatShortDate(settings.activeSince)}` : ""}
              </Badge>
            ) : (
              <Badge variant="secondary">Desligado</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{describeRule(settings)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="gap-2" onClick={onConfigure}>
            <Settings2 className="h-4 w-4" /> Configurar
          </Button>
          {settings.isActive ? (
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:bg-destructive/10"
              onClick={onTurnOff}
            >
              <PowerOff className="h-4 w-4" /> Desligar
            </Button>
          ) : (
            <Button className="gap-2" onClick={onTurnOn} disabled={blocked || isTurningOn}>
              {isTurningOn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}{" "}
              Ligar
            </Button>
          )}
        </div>
      </div>

      {blocked && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {settings.isActive ? "A configuração tem um problema:" : "Para ligar o programa:"}
          </p>
          <ul className="list-disc space-y-0.5 pl-6 text-muted-foreground">
            {settings.turnOnBlockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Período do painel">
        {PRESETS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preset === option.value}
            onClick={() => onPresetChange(option.value)}
            className={cn(
              "h-8 cursor-pointer rounded-full border px-3 text-xs font-medium transition-colors",
              preset === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
