import { FileText, Loader2 } from "lucide-react";
import { formatDateTime } from "../hooks/useLogs";
import { isCriticalLogType } from "../logType";
import type { SystemLogDto } from "../types";
import { LogTypeBadge } from "./LogTypeBadge";

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
          <col style={{ width: "170px" }} />
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
              className="px-4 text-center font-medium text-muted-foreground text-sm"
              style={{ width: "170px" }}
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
            logsList.map((log: SystemLogDto) => {
              const isPendingCritical = isCriticalLogType(log.type) && log.requiresVerification;

              return (
                <tr
                  key={log.id}
                  className={
                    isPendingCritical
                      ? "h-12 cursor-pointer border-b border-red-700 bg-red-600 text-white transition-colors duration-150 hover:bg-red-700 [&_td]:text-white [&_td_*]:text-white"
                      : "h-12 cursor-pointer border-b border-border transition-colors duration-150 hover:bg-muted/30"
                  }
                  onClick={() => onRowClick(log.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground align-middle">
                    <div className="truncate" style={{ width: "38px" }}>
                      {log.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium align-middle">
                    <LogTypeBadge type={log.type} />
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
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
