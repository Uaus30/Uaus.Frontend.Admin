import { Button } from "@workspace/ui";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Loader2 } from "lucide-react";
import type { UserForm } from "../types";

/**
 * Propriedades do componente UserEditorModal.
 */
interface UserEditorModalProps {
  /** Determina se a modal está aberta. */
  open: boolean;
  /** Callback para alteração do estado de abertura da modal. */
  onOpenChange: (open: boolean) => void;
  /** ID do usuário sendo editado, ou null se for novo cadastro. */
  editingId: number | null;
  /** Objeto de estado do formulário. */
  form: UserForm;
  /** Callback para atualizar o estado do formulário. */
  onFormChange: React.Dispatch<React.SetStateAction<UserForm>>;
  /** Lista de opções selecionáveis para papéis de usuários. */
  selectableRoleOptions: any[];
  /** Lista de opções selecionáveis para status de usuários. */
  selectableStatusOptions: any[];
  /** Estado de salvamento da mutação. */
  isSaving: boolean;
  /** Callback de submissão do formulário. */
  onSubmit: (event: React.FormEvent) => void;
  /** Helper para inferir o login com base no e-mail informado. */
  usernameFromEmail: (email: string) => string;
}

/**
 * Modal com formulário para cadastro e edição de dados de usuários administrativos.
 */
export function UserEditorModal({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  selectableRoleOptions,
  selectableStatusOptions,
  isSaving,
  onSubmit,
  usernameFromEmail,
}: UserEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              value={form.fullName}
              onChange={(event) => onFormChange((current) => ({ ...current, fullName: event.target.value }))}
              placeholder="Nome do usuário"
              required
              className="bg-background border-input"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input
                value={form.username}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="login"
                required
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) =>
                  onFormChange((current) => {
                    const email = event.target.value;
                    return {
                      ...current,
                      email,
                      username: current.username || usernameFromEmail(email),
                    };
                  })
                }
                placeholder="email@empresa.com"
                required
                className="bg-background border-input"
              />
            </div>
          </div>
          {!editingId && (
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Informe a senha inicial"
                required
                className="bg-background border-input"
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={form.role}
                onValueChange={(value) => onFormChange((current) => ({ ...current, role: value }))}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {selectableRoleOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingId && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => onFormChange((current) => ({ ...current, status: value }))}
                >
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableStatusOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                "Salvar"
              ) : (
                "Criar Usuário"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
