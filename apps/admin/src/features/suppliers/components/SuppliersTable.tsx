import * as React from "react";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { formatPhone } from "@workspace/core";
import type { ApiError, SupplierDto, UiPagedResult } from "@workspace/api-client-react";
import { Edit2, Search, Trash2 } from "lucide-react";
import { whatsappUrl } from "../constants";
import type { EnumOption } from "../types";

/**
 * Retorna as iniciais de um nome para exibição no avatar.
 */
function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/**
 * Componente interno de avatar do fornecedor.
 */
function SupplierAvatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "h-9 w-9 text-sm" : size === "lg" ? "h-16 w-16 text-2xl" : "h-10 w-10 text-sm";

  return (
    <div
      className={`${sizeClass} flex flex-shrink-0 select-none items-center justify-center rounded-full font-bold`}
      style={{ backgroundColor: `${color}25`, color, border: `2px solid ${color}40` }}
    >
      {getInitials(name || "?")}
    </div>
  );
}

/**
 * Componente interno do ícone do WhatsApp.
 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Propriedades do componente de tabela de fornecedores.
 */
interface SuppliersTableProps {
  /** Valor do campo de busca. */
  searchVal: string;
  /** Callback para alteração da busca. */
  onSearchChange: (value: string) => void;
  /** Filtro de status ativo. */
  statusFilter: string;
  /** Callback para alteração do filtro de status. */
  onStatusFilterChange: (value: string) => void;
  /** Opções de status do enum. */
  statusOptions: EnumOption[];
  /** Mapa de ID para label de status. */
  statusLabelById: Record<number, string>;
  /** Lista filtrada de fornecedores. */
  suppliers: SupplierDto[];
  /** Página ativa. */
  page: number;
  /** Callback para mudança de página. */
  onPageChange: (updater: number | ((current: number) => number)) => void;
  /** Limite de itens por página. */
  limit: number;
  /** Callback para alteração do limite de itens por página. */
  onLimitChange: (limit: number) => void;
  /** Dados completos da resposta de paginação da API. */
  suppliersPage: UiPagedResult<SupplierDto> | undefined;
  /** Indica se está carregando. */
  isLoading: boolean;
  /** Indica erro na consulta. */
  isError: boolean;
  /** Objeto de erro. */
  error: ApiError | null;
  /** Callback executado ao clicar em editar. */
  onEdit: (supplier: SupplierDto) => void;
  /**
   * Remoção efetiva, já confirmada. Quem pergunta é o `ConfirmDialog` desta
   * tabela — o componente é declarativo, então a confirmação mora em quem
   * renderiza, não no hook.
   */
  onDelete: (id: number) => void | Promise<void>;
}

/**
 * Componente que renderiza a tabela de fornecedores com busca, filtro de status, ordenação e paginação flexível.
 */
export function SuppliersTable({
  searchVal,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  statusLabelById,
  suppliers,
  page,
  onPageChange,
  limit,
  onLimitChange,
  suppliersPage,
  isLoading,
  isError,
  error,
  onEdit,
  onDelete,
}: SuppliersTableProps) {
  const totalPages = Math.max(1, Math.ceil((suppliersPage?.total || 0) / limit));
  // Guarda o fornecedor inteiro, não só o id: o diálogo mostra o nome para o
  // operador conferir que está apagando a linha que ele acha que está — em
  // tabela paginada, o clique no ícone errado é o engano mais comum.
  const [supplierToDelete, setSupplierToDelete] = React.useState<SupplierDto | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      <div className="flex flex-col gap-3 border-b border-border/50 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchVal}
            onChange={(event) => onSearchChange(event.target.value)}
            className="bg-background pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusOptions
              .filter((item) => item.allowSelect)
              .map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Fornecedor</th>
              <th className="px-6 py-4">Vendedor</th>
              <th className="px-6 py-4">Contato</th>
              <th className="px-6 py-4">Localização</th>
              <th className="px-6 py-4">Mín. Compra</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Descrição</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading || (isError && (error?.status ?? 0) >= 500) ? (
              <tr>
                <td colSpan={8} className="py-12 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </td>
              </tr>
            ) : (
              suppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-b border-border/50 transition-colors hover:bg-muted/20"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <SupplierAvatar name={supplier.name} color={supplier.avatarColor} size="sm" />
                      <div>
                        <p className="leading-tight font-medium text-foreground">{supplier.name}</p>
                        {supplier.corporateName && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{supplier.corporateName}</p>
                        )}
                        {supplier.document && (
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground/70">
                            {supplier.document}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {supplier.salesRepresentative || "Não informado"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {supplier.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{formatPhone(supplier.phone)}</span>
                          <a
                            href={whatsappUrl(supplier.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#25d366] transition-colors hover:text-[#128c7e]"
                            title="Abrir conversa no WhatsApp"
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não informado</span>
                      )}
                      {supplier.email && (
                        <span className="max-w-[180px] truncate text-xs text-muted-foreground">
                          {supplier.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {supplier.city || supplier.state
                      ? [supplier.city, supplier.state].filter(Boolean).join("/")
                      : "Não informado"}
                  </td>
                  <td className="px-6 py-4 font-medium text-primary">
                    {formatCurrency(supplier.minimumPurchaseValue)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge className="border-0 bg-emerald-500/20 text-emerald-400">
                      {statusLabelById[supplier.status] ?? (supplier.status ? supplier.status : "Sem status")}
                    </Badge>
                  </td>
                  <td
                    className="px-6 py-4 text-xs text-muted-foreground max-w-[200px]"
                    title={supplier.description || ""}
                  >
                    <div className="line-clamp-2 leading-tight break-words">
                      {supplier.description || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                        onClick={() => onEdit(supplier)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                        onClick={() => setSupplierToDelete(supplier)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Itens por página:</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              onLimitChange(Number(value));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="h-8 w-20 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-2">Total: {suppliersPage?.total || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange((current) => current - 1)}
          >
            Anterior
          </Button>
          <span className="px-2 text-xs">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={supplierToDelete !== null}
        onOpenChange={(open) => !open && setSupplierToDelete(null)}
        title="Remover este fornecedor?"
        itemName={supplierToDelete?.name}
        description="O fornecedor sai do cadastro e deixa de aparecer no lançamento de estoque e nas compras novas. As compras já lançadas continuam como estão. A ação não pode ser desfeita."
        confirmLabel="Sim, remover"
        destructive
        onConfirm={() => (supplierToDelete ? onDelete(supplierToDelete.id) : undefined)}
      />
    </div>
  );
}
