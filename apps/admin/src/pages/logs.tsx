import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { useGetLogs, type SystemLogDto } from "@workspace/api-client-react";
import {
  Loader2,
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Terminal,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getEnumOptions } from "@/services/core";
import { subDays, startOfDay, endOfDay } from "date-fns";

const DEFAULT_DATE_RANGE: DateRange = {
  from: startOfDay(subDays(new Date(), 7)),
  to: endOfDay(new Date()),
};

export default function Logs() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // --- Draft state (edited by user, not yet applied) ---
  const [draftSearch, setDraftSearch] = useState("");
  const [draftType, setDraftType] = useState<string>("all");
  const [draftDateRange, setDraftDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);

  // --- Applied state (what is actually queried) ---
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedType, setAppliedType] = useState<string>("all");
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);

  const [page, setPage] = useState(1);
  const limit = 25;

  const { data: logTypeOptions = [] } = useQuery({
    queryKey: ["log-type-options"],
    queryFn: () => getEnumOptions("/Logs/enums/log-type"),
  });

  const selectableLogTypeOptions = useMemo(
    () => logTypeOptions.filter((item) => item.allowSelect),
    [logTypeOptions],
  );

  const startDateISO = appliedDateRange?.from
    ? startOfDay(appliedDateRange.from).toISOString()
    : undefined;
  const endDateISO = appliedDateRange?.to
    ? endOfDay(appliedDateRange.to).toISOString()
    : undefined;

  const { data, isLoading, isError, error } = useGetLogs({
    search: appliedSearch || undefined,
    type: appliedType !== "all" ? appliedType : undefined,
    startDate: startDateISO,
    endDate: endDateISO,
    page,
    limit,
  });

  useEffect(() => {
    if (isError && error) {
      toast({
        title: "Erro ao carregar logs",
        description: error.message || "Não foi possível conectar com o servidor.",
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  const logsList = data?.data || [];

  function handleSearch() {
    setAppliedSearch(draftSearch);
    setAppliedType(draftType);
    setAppliedDateRange(draftDateRange);
    setPage(1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  function formatDateTime(dateStr: string) {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  }

  function getLogTypeBadge(type: string) {
    const normType = type?.toLowerCase() || "";
    if (normType.includes("err") || normType.includes("fail") || normType.includes("crit")) {
      return (
        <Badge variant="destructive" className="gap-1 px-2.5 py-1 text-xs font-semibold uppercase animate-pulse">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {type || "ERROR"}
        </Badge>
      );
    }
    if (normType.includes("warn")) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 px-2.5 py-1 text-xs font-semibold uppercase">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {type || "WARN"}
        </Badge>
      );
    }
    if (normType.includes("info")) {
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-1 px-2.5 py-1 text-xs font-semibold uppercase">
          <Info className="h-3 w-3 shrink-0" />
          {type || "INFO"}
        </Badge>
      );
    }
    if (normType.includes("success") || normType.includes("ok")) {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 py-1 text-xs font-semibold uppercase">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          {type || "SUCCESS"}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1 px-2.5 py-1 text-xs font-semibold uppercase">
        <Terminal className="h-3 w-3 shrink-0" />
        {type || "LOG"}
      </Badge>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Logs do Sistema</h1>
          <p className="mt-1 text-muted-foreground">
            Monitore os eventos, requisições e erros do sistema.
          </p>
        </div>

        {/* ── Filter bar ── */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap gap-3 items-end">

            {/* Busca */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Busca
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="log-search"
                  placeholder="Código, origem ou mensagem..."
                  className="pl-9 bg-background border-input"
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>

            {/* Tipo */}
            <div className="flex flex-col gap-1.5 w-44">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo
              </Label>
              <Select value={draftType} onValueChange={setDraftType}>
                <SelectTrigger id="log-type" className="bg-background border-input w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {selectableLogTypeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.value}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período */}
            <div className="flex flex-col gap-1.5 w-64">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Período
              </Label>
              <DateRangePicker
                value={draftDateRange}
                onChange={setDraftDateRange}
              />
            </div>

            {/* Botão Buscar */}
            <div className="flex flex-col gap-1.5 shrink-0">
              {/* Label invisível para alinhar verticalmente */}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-transparent select-none">
                &nbsp;
              </span>
              <Button
                id="log-search-btn"
                onClick={handleSearch}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>

          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-hidden rounded-xl border border-border bg-card w-full overflow-x-auto">
          <table
            className="w-full text-sm text-left align-middle"
            style={{ tableLayout: "fixed", width: "100%", borderCollapse: "collapse" }}
          >
            <colgroup>
              <col style={{ width: "110px" }} />
              <col style={{ width: "190px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "240px" }} />
              <col style={{ width: "auto" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40 h-11">
                <th className="px-4 text-left font-medium text-muted-foreground text-sm" style={{ width: "110px" }}>Tipo</th>
                <th className="px-4 text-left font-medium text-muted-foreground text-sm" style={{ width: "190px" }}>Data / Hora</th>
                <th className="px-4 text-left font-medium text-muted-foreground text-sm" style={{ width: "160px" }}>Código</th>
                <th className="px-4 text-left font-medium text-muted-foreground text-sm" style={{ width: "240px" }}>Origem</th>
                <th className="px-4 text-left font-medium text-muted-foreground text-sm">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Carregando...
                    </div>
                  </td>
                </tr>
              ) : logsList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
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
                    onClick={() => setLocation(`/sistema/logs/${log.id}`)}
                  >
                    <td className="px-4 py-3 font-medium align-middle">
                      <div className="truncate" style={{ width: "78px" }}>{getLogTypeBadge(log.type)}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm font-mono align-middle">
                      <div className="truncate" style={{ width: "158px" }}>{formatDateTime(log.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground align-middle">
                      <div className="truncate" style={{ width: "128px" }}>{log.code || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm font-mono align-middle" title={log.origin}>
                      <div className="truncate" style={{ width: "208px" }}>{log.origin || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground text-sm align-middle" title={log.message}>
                      <div className="truncate">{log.message || "-"}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page} de {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
