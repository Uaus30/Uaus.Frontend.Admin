import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@workspace/ui";
import { ScrollArea } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProductGroupById } from "@/services/products.service";
import { getEnumOptions } from "@/services/core";
import { Loader2, Plus, Edit2, Trash2, Clock, User as UserIcon, Calendar, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import React, { useState, useMemo, useEffect } from "react";
import type { ProductHistoryDto } from "@workspace/api-client-react";

type ProductHistoryModalProps = {
  productGroupId: number | null;
  productGroupName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

type HistoryTypeConfig = {
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  borderColor: string;
  textColor: string;
  label: string;
};

const getActionConfig = (type: number): HistoryTypeConfig => {
  switch (type) {
    case 1: // Criação
      return {
        icon: Plus,
        bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
        borderColor: "border-emerald-500/20 dark:border-emerald-500/30",
        textColor: "text-emerald-600 dark:text-emerald-400",
        label: "Criação",
      };
    case 2: // Edição
      return {
        icon: Edit2,
        bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
        borderColor: "border-amber-500/20 dark:border-amber-500/30",
        textColor: "text-amber-600 dark:text-amber-400",
        label: "Edição",
      };
    case 3: // Deleção
      return {
        icon: Trash2,
        bgColor: "bg-rose-500/10 dark:bg-rose-500/20",
        borderColor: "border-rose-500/20 dark:border-rose-500/30",
        textColor: "text-rose-600 dark:text-rose-400",
        label: "Deleção",
      };
    default:
      return {
        icon: Clock,
        bgColor: "bg-slate-500/10 dark:bg-slate-500/20",
        borderColor: "border-slate-500/20 dark:border-slate-500/30",
        textColor: "text-slate-600 dark:text-slate-400",
        label: "Sistema",
      };
  }
};

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  } catch (e) {
    return dateStr;
  }
};

const parseDescription = (desc: string) => {
  const parts = desc.split(". Alterações: ");
  if (parts.length < 2) return { main: desc, changes: [] };

  const main = parts[0];
  const changes = parts[1]
    .replace(/\.$/, "") // remove pontuação final
    .split(", ")
    .map((c) => c.trim())
    .filter(Boolean);

  return { main, changes };
};

export function ProductHistoryModal({
  productGroupId,
  productGroupName,
  isOpen,
  onOpenChange,
}: ProductHistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen && productGroupId !== null) {
      void queryClient.invalidateQueries({ queryKey: ["product-group-history", productGroupId] });
    }
  }, [isOpen, productGroupId, queryClient]);

  const {
    data: productGroup,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product-group-history", productGroupId],
    queryFn: () => getProductGroupById(productGroupId!),
    enabled: productGroupId !== null && isOpen,
  });

  const { data: typeOptions = [] } = useQuery({
    queryKey: ["product-history-types"],
    queryFn: () => getEnumOptions("/ProductGroups/enums/product-history-type"),
  });

  const histories = productGroup?.productHistories ?? [];

  const filteredHistories = useMemo(() => {
    const sorted = [...histories].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id,
    );

    if (!searchTerm.trim()) return sorted;
    const term = searchTerm.toLowerCase();
    return sorted.filter((h: ProductHistoryDto) => {
      const formattedUser =
        h.userFirstName && h.userLastName ? `${h.userFirstName} ${h.userLastName}`.toLowerCase() : "";
      return (
        h.description.toLowerCase().includes(term) ||
        (h.createdBy && h.createdBy.toLowerCase().includes(term)) ||
        formattedUser.includes(term)
      );
    });
  }, [histories, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] border-border/50 bg-card p-6 flex flex-col gap-6 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2.5 text-foreground">
            <Clock className="h-6 w-6 text-primary animate-pulse" />
            Histórico do Produto
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Grupo de Produto: <span className="font-semibold text-foreground">{productGroupName}</span> (ID:{" "}
            {productGroupId})
          </DialogDescription>
        </DialogHeader>

        {/* Barra de Pesquisa */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por descrição ou usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background border-border/50 focus-visible:ring-primary/20"
          />
        </div>

        {/* Área de Conteúdo */}
        <ScrollArea className="flex-1 pr-3 overflow-y-auto max-h-[50vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">Carregando histórico...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive font-medium text-sm">
              Erro ao carregar o histórico. Tente novamente mais tarde.
            </div>
          ) : filteredHistories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-2">
              <Clock className="h-12 w-12 text-muted-foreground/30 stroke-[1.5]" />
              <p className="text-sm font-medium">Nenhum registro de histórico encontrado.</p>
              {searchTerm && <p className="text-xs">Tente limpar os filtros de pesquisa.</p>}
            </div>
          ) : (
            <div className="relative border-l border-border/60 ml-4.5 pl-6 py-2 space-y-8">
              {filteredHistories.map((entry: ProductHistoryDto) => {
                const config = getActionConfig(entry.type);
                const ActionIcon = config.icon;
                const parsed = parseDescription(entry.description);
                const userName =
                  entry.userFirstName && entry.userLastName
                    ? `${entry.userFirstName} ${entry.userLastName}`
                    : entry.createdBy || "Sistema";

                const typeLabel = typeOptions.find((opt) => opt.id === entry.type)?.name || config.label;

                return (
                  <div key={entry.id} className="relative group">
                    {/* Indicador de Timeline */}
                    <div
                      className={`absolute -left-[45px] top-0 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all duration-200 group-hover:scale-110 ${config.bgColor} ${config.borderColor} ${config.textColor}`}
                    >
                      <ActionIcon className="h-4 w-4" />
                    </div>

                    <div className="flex flex-col gap-2 bg-muted/20 hover:bg-muted/40 border border-border/30 rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:shadow-black/5">
                      {/* Cabeçalho do Evento */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 pb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`font-semibold text-[10px] px-2 py-0.5 border ${config.bgColor} ${config.borderColor} ${config.textColor}`}
                          >
                            {typeLabel}
                          </Badge>
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground/75" />
                            {userName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>

                      {/* Conteúdo/Descrição */}
                      <div className="text-sm text-foreground/90 font-medium">{parsed.main}.</div>

                      {/* Detalhes de Alterações (Diff) */}
                      {parsed.changes.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-border/10">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Propriedades Alteradas:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            {parsed.changes.map((change, idx) => (
                              <div
                                key={idx}
                                className="text-xs bg-background dark:bg-card border border-border/40 hover:border-border rounded-lg p-2 flex items-center gap-2 text-muted-foreground transition-colors duration-150"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span className="leading-normal">{change}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
