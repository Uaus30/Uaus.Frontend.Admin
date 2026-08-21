import { Badge } from "@workspace/ui";
import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Info, Skull } from "lucide-react";
import { normalizeLogType } from "../logType";

interface LogTypeBadgeProps {
  type: unknown;
}

/** Traduz o tipo persistido para seu indicador visual consistente. */
export function LogTypeBadge({ type }: LogTypeBadgeProps) {
  const safeType = normalizeLogType(type);
  const normType = safeType.toLowerCase();
  if (normType.includes("critical")) {
    return (
      <Badge className="bg-rose-900 hover:bg-rose-950 text-white gap-1 px-2.5 py-1 text-xs font-semibold uppercase animate-pulse">
        <Skull className="h-3 w-3 shrink-0" />
        CRÍTICO
      </Badge>
    );
  }
  if (normType.includes("err") || normType.includes("fail") || normType.includes("crit")) {
    return (
      <Badge
        variant="destructive"
        className="gap-1 px-2.5 py-1 text-xs font-semibold uppercase animate-pulse"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        ERRO
      </Badge>
    );
  }
  if (normType.includes("warn") || normType.includes("alert")) {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 px-2.5 py-1 text-xs font-semibold uppercase">
        <AlertCircle className="h-3 w-3 shrink-0" />
        ALERTA
      </Badge>
    );
  }
  if (normType.includes("info")) {
    return (
      <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-1 px-2.5 py-1 text-xs font-semibold uppercase">
        <Info className="h-3 w-3 shrink-0" />
        INFORMAÇÃO
      </Badge>
    );
  }
  if (normType.includes("success") || normType.includes("ok")) {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 py-1 text-xs font-semibold uppercase">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        SUCESSO
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 px-2.5 py-1 text-xs font-semibold uppercase">
      <FileText className="h-3 w-3 shrink-0" />
      {safeType || "LOG"}
    </Badge>
  );
}
