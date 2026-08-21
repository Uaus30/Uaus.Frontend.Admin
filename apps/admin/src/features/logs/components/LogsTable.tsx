import { Badge } from "@workspace/ui";
import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Info, Loader2, Skull } from "lucide-react";
import { formatDateTime } from "../hooks/useLogs";
import type { SystemLogDto } from "../types";

/**
 * Retorna o Badge estilizado de acordo com o tipo de Log.
 */
export function getLogTypeBadge(type: string) {
  const normType = type?.toLowerCase() || "";
  if (normType.includes("critical")) {
    return (
      <Badge
        className="bg-rose-900 hover:bg-rose-950 text-white gap-1 px-2.5 py-1 text-xs font-semibold uppercase animate-pulse"
      >
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
      {type || "LOG"}
    </Badge>
  );
}

/**
 * Propriedades do componente LogsTable.
 */
interface LogsTableProps {
  /** Lista de logs do sistema a serem exibidos. */
  logsList: SystemLogDto[];
  /** Indica se os dados estão carregando. */
  isLoading: boolean;
  /** Callback acionado ao clicar em uma linha da tabela de logs. */
  onRowClick: (id: number) => void;
}

/**
 * Componente que exibe a tabela principal de logs do sistema de forma estruturada.
 */
export function LogsTable({ logsList, isLoading, onRowClick }: LogsTableProps) {

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card w-full overflow-x-auto">
      <table
        className="w-full text-sm text-left align-middle"
        style={{ tableLayout: "fixed", width: "100%", borderCollapse: "collapse" }}
      >
        <colgroup>
          <col style={{ width: "70px" }} />
          <col style={{ width: "110px" }} />
          <col style={{ width: "190px" }} />
          <col style={{ width: "310px" }} />
          <col style={{ width: "240px" }} />
          <col style={{ width: "auto" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/40 h-11">
            <th
              className="px-4 text-left font-medium text-muted-foreground text-sm"
              style={{ width: "70px" }}
            >
              ID
            </th>
            <th
              className="px-4 text-left font-medium text-muted-foreground text-sm"
              style={{ width: "110px" }}
            >
              Tipo
            </th>
            <th
              className="px-4 text-left font-medium text-muted-foreground text-sm"
              style={{ width: "190px" }}
            >
              Data
            </th>
            <th
              className="px-4 text-left font-medium text-muted-foreground text-sm"
              style={{ width: "310px" }}
            >
              Código
            </th>
            <th
              className="px-4 text-left font-medium text-muted-foreground text-sm"
              style={{ width: "240px" }}
            >
              Origem
            </th>
            <th className="px-4 text-left font-medium text-muted-foreground text-sm">Mensagem</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={6} className="py-12 text-center text-muted-foreground">
                <div className="flex justify-center items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Carregando...
                </div>
              </td>
            </tr>
          ) : logsList.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center">
                  <FileText className="mb-2 h-8 w-8 opacity-40" />
                  <p>Nenhum log encontrado</p>
                </div>
              </td>
            </tr>
          ) : (
            logsList.map((log: SystemLogDto) => (
              <tr
                key={log.id}
                className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors duration-150 h-12"
                onClick={() => onRowClick(log.id)}
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground align-middle">
                  <div className="truncate" style={{ width: "38px" }}>
                    {log.id}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium align-middle">
                  <div className="truncate" style={{ width: "78px" }}>
                    {getLogTypeBadge(log.type)}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-sm font-mono align-middle">
                  <div className="truncate" style={{ width: "158px" }}>
                    {formatDateTime(log.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground align-middle">
                  <div className="truncate" style={{ width: "278px" }}>
                    {log.code || "-"}
                  </div>
                </td>
                <td
                  className="px-4 py-3 text-muted-foreground text-sm font-mono align-middle"
                  title={log.origin}
                >
                  <div className="truncate" style={{ width: "208px" }}>
                    {log.origin || "-"}
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground align-middle" title={log.message}>
                  <div className="line-clamp-2 text-xs leading-snug">{log.message || "-"}</div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
