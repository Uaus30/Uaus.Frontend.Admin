import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Edit2, Trash2, Handshake } from "lucide-react";
import { formatPercentage } from "@/lib/formatters";
import type { PartnerDto } from "../types";

interface PartnersTableProps {
  partners: PartnerDto[];
  isLoading: boolean;
  /** True enquanto uma exclusão está em andamento — bloqueia o segundo clique. */
  isDeleting: boolean;
  onEdit: (partner: PartnerDto) => void;
  onDelete: (partner: PartnerDto) => void;
}

/**
 * PartnersTable
 *
 * Tabela de sócios com percentual de lucro, status e ações rápidas.
 */
export function PartnersTable({
  partners,
  isLoading,
  isDeleting,
  onEdit,
  onDelete,
}: PartnersTableProps) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Carregando sócios...
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card">
        <Handshake className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-base">Nenhum sócio encontrado</p>
        <p className="text-sm">Cadastre um sócio para configurar a distribuição de lucros.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Nome</TableHead>
            <TableHead>Percentual do lucro</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((partner) => (
            <TableRow key={partner.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-primary shrink-0" />
                  <span>{partner.name}</span>
                </div>
              </TableCell>

              <TableCell className="font-mono">
                {formatPercentage(partner.profitSharePercentage)}
              </TableCell>

              <TableCell>
                {partner.isActive ? (
                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-medium">
                    Inativo
                  </Badge>
                )}
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(partner)}
                    title="Editar sócio"
                    className="h-8 w-8"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(partner)}
                    disabled={isDeleting}
                    title="Excluir sócio"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


