import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { Edit2, Loader2, Search, Trash2 } from "lucide-react";

/**
 * Propriedades do componente de tabela de clientes.
 */
interface CustomersTableProps {
  /** Dados da página de clientes retornada da API. */
  customersPage: any;
  /** Estado de carregamento dos clientes. */
  isLoading: boolean;
  /** Valor atual da busca por nome. */
  searchVal: string;
  /** Função callback para alteração da busca. */
  onSearchChange: (value: string) => void;
  /** Página ativa. */
  page: number;
  /** Função callback para mudança de página. */
  onPageChange: (updater: number | ((current: number) => number)) => void;
  /** Mapa contendo as estatísticas de compras dos clientes. */
  statsByCustomerId: Map<number, { totalPurchases: number; purchaseCount: number }>;
  /** Callback executado ao clicar no botão de editar cliente. */
  onEdit: (customer: any) => void;
  /** Callback executado ao clicar no botão de remover cliente. */
  onDelete: (id: number) => void;
}

/**
 * Componente que renderiza a tabela de listagem de clientes com busca e paginação.
 */
export function CustomersTable({
  customersPage,
  isLoading,
  searchVal,
  onSearchChange,
  page,
  onPageChange,
  statsByCustomerId,
  onEdit,
  onDelete,
}: CustomersTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      <div className="flex flex-col gap-4 border-b border-border/50 p-4 sm:flex-row">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchVal}
            onChange={(event) => onSearchChange(event.target.value)}
            className="bg-background pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Contato</th>
              <th className="px-6 py-4">Documento</th>
              <th className="px-6 py-4">Total Gasto</th>
              <th className="px-6 py-4">Desde</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td>
              </tr>
            ) : customersPage?.data.map((customer: any) => {
              const stats = statsByCustomerId.get(customer.id) ?? {
                totalPurchases: 0,
                purchaseCount: 0,
              };

              return (
                <tr key={customer.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold uppercase text-primary">
                        {customer.name.substring(0, 2)}
                      </div>
                      {customer.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{customer.email || "-"}</span>
                      <span className="text-xs">{customer.phone || ""}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{customer.document || "-"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-primary">{formatCurrency(stats.totalPurchases)}</span>
                      <span className="text-xs text-muted-foreground">{stats.purchaseCount} compra(s)</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{formatShortDate(customer.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                        onClick={() => onEdit(customer)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                        onClick={() => onDelete(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
        <span>
          Mostrando página {customersPage?.page} de{" "}
          {Math.ceil((customersPage?.total || 0) / (customersPage?.limit || 15)) || 1}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onPageChange((current) => current - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={customersPage ? customersPage.data.length < customersPage.limit : true}
            onClick={() => onPageChange((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
