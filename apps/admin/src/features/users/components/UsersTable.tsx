import { Badge } from "@workspace/ui";
import { USER_STATUS, enumCode, precisaTrocarSenha, type UiPagedResult } from "@workspace/api-client-react";
import { Button } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui";
import { getDisplayName } from "@/services/mappers";
import { KeyRound, Loader2, Pencil, Trash2, UserCog } from "lucide-react";
import type { UserRow } from "../types";

/**
 * Propriedades do componente de tabela de usuários.
 */
interface UsersTableProps {
  /** Página atual da consulta de usuários. */
  data: UiPagedResult<UserRow> | undefined;
  /** Estado de carregamento da lista. */
  isLoading: boolean;
  /** Mapa de ID para o label de status do usuário. */
  statusLabels: Record<number, string>;
  /** Callback acionado ao clicar em editar. */
  onEdit: (user: UserRow) => void;
  /** Callback acionado ao clicar em resetar a senha. */
  onResetPassword: (user: UserRow) => void;
  /** Callback acionado ao clicar em deletar. */
  onDelete: (id: number) => void;
}

/**
 * Tabela de usuários com status e ações.
 *
 * O status passa por `enumCode` porque a API o serializa pelo NOME
 * (`"Pending"`). Indexar o mapa de rótulos direto com esse valor devolvia
 * `undefined`, e a tabela caía no fallback: a coluna mostrava "Pending" em
 * inglês, no meio de uma tela em português.
 */
export function UsersTable({
  data,
  isLoading,
  statusLabels,
  onEdit,
  onResetPassword,
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
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </TableCell>
            </TableRow>
          ) : data?.data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                <UserCog className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p>Nenhum usuário encontrado</p>
              </TableCell>
            </TableRow>
          ) : (
            data?.data.map((user) => {
              const status = enumCode(user.status, USER_STATUS);
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
                    <div className="flex items-center gap-2">
                      <Badge variant={status === USER_STATUS.Active ? "default" : "secondary"}>
                        {statusLabels[status] ?? user.status}
                      </Badge>
                      {precisaTrocarSenha(user.status) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Ainda usa a senha padrão. Vira Ativo ao trocá-la no primeiro acesso.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onResetPassword(user)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Resetar senha</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDelete(user.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remover</TooltipContent>
                      </Tooltip>
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
