import { cn } from "@workspace/ui";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import { anomalyMeta } from "../lib/anomalies";

/**
 * A etiqueta de uma anomalia.
 *
 * <b>Cor nunca sozinha.</b> Sai sempre com ícone E texto: quem não distingue
 * vermelho de âmbar ficaria sem a informação, e numa impressão em preto e branco
 * ela some para todo mundo.
 */
export function AnomalyTag({ type, className }: { type: string; className?: string }) {
  const meta = anomalyMeta(type);
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium",
        BI_TONE_PILL[meta.tone],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {meta.label}
    </span>
  );
}
