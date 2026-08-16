import { Button } from "@workspace/ui";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import type { EnumOptionDto } from "@workspace/api-client-react";
import { Info, Loader2 } from "lucide-react";
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
  selectableRoleOptions: EnumOptionDto[];
  /**
   * Status oferecidos na edição. Já vem sem "Ativo" quando o usuário está
   * Pendente — quem promove é a troca de senha, não esta tela.
   */
  editableStatusOptions: EnumOptionDto[];
  /** O usuário editado ainda não trocou a senha do primeiro acesso. */
  pendentePrimeiroAcesso: boolean;
  /** Estado de salvamento da mutação. */
  isSaving: boolean;
  /** Callback de submissão do formulário. */
  onSubmit: (event: React.FormEvent) => void;
  /** Helper para inferir o login com base no e-mail informado. */
  usernameFromEmail: (email: string) => string;
}

/**
 * Modal com formulário para cadastro e edição de dados de usuários administrativos.
 *
 * **Não pede senha.** O cadastro nasce com a senha padrão do sistema e status
 * Pendente; quem define a senha de verdade é o próprio usuário, no primeiro
 * acesso. O campo existia e era descartado pelo servidor: o administrador
 * entregava ao operador uma senha que o PDV recusava com "Senha inválida!".
 */
export function UserEditorModal({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  selectableRoleOptions,
  editableStatusOptions,
  pendentePrimeiroAcesso,
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
                    {editableStatusOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {editingId
                ? pendentePrimeiroAcesso
                  ? "Este usuário ainda não trocou a senha do primeiro acesso, por isso continua Pendente. Ele passa a Ativo sozinho assim que trocar."
                  : "A senha é do próprio usuário. Para quem esqueceu a dele, use “Resetar senha” na lista."
                : "A senha não é definida aqui: o usuário entra com a senha padrão do sistema, mostrada ao final do cadastro, e é obrigado a trocá-la no primeiro acesso."}
            </span>
          </p>
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
