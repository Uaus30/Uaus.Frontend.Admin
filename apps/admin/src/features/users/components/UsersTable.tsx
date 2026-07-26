import { Badge } from "@/components/ui/badge";
import { USER_STATUS, enumCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDisplayName } from "@/services/mappers";
import { Loader2, Pencil, ShieldCheck, Trash2, User, UserCog } from "lucide-react";

/**
 * Retorna o ícone associado ao papel de usuário.
 */
function roleIcon(roleId: number) {
  return roleId === 1 ? ShieldCheck : User;
}

/**
 * Propriedades do componente de tabela de usuários.
 */
interface UsersTableProps {
  /** Dados da consulta de usuários contendo a lista. */
  data: any;
  /** Estado de carregamento da lista. */
  isLoading: boolean;
  /** Mapa de ID para o label do papel de usuário. */
  roleLabels: Record<number, string>;
  /** Mapa de ID para o label de status do usuário. */
  statusLabels: Record<number, string>;
  /** Callback acionado ao clicar em editar. */
  onEdit: (user: any) => void;
  /** Callback acionado ao clicar em deletar. */
  onDelete: (id: number) => void;
}

/**
 * Componente que renderiza a tabela de listagem de usuários com badges e ações.
 */
export function UsersTable({
  data,
  isLoading,
  roleLabels,
  statusLabels,
  onEdit,
  onDelete,
}: UsersTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Nome</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </TableCell>
            </TableRow>
          ) : data?.data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                <UserCog className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p>Nenhum usuário encontrado</p>
              </TableCell>
            </TableRow>
          ) : (
            data?.data.map((user: any) => {
              const Icon = roleIcon(user.role);
              return (
                <TableRow key={user.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                        {getDisplayName(user).charAt(0).toUpperCase()}
                      </div>
                      {getDisplayName(user)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <Icon className="h-3 w-3" />
                      {roleLabels[user.role] ?? user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={enumCode(user.status, USER_STATUS) === USER_STATUS.Active ? "default" : "secondary"}>
                      {statusLabels[user.status] ?? user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(user)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(user.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
