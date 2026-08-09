import { useRef } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Loader2, Users } from "lucide-react";
import { cleanPhone, formatPhone } from "@/lib/utils";
import type { CustomerForm } from "../types";

/**
 * Propriedades do componente de modal de edição de cliente.
 */
interface CustomerEditorModalProps {
  /** Determina se a modal está aberta. */
  open: boolean;
  /** Callback executado ao alterar o estado de exibição da modal. */
  onOpenChange: (open: boolean) => void;
  /** ID do cliente sendo editado, ou null se for novo cadastro. */
  editingId: number | null;
  /** Dados iniciais do formulário do cliente. */
  initialForm: CustomerForm;
  /** Estado de salvamento da mutação. */
  isSaving: boolean;
  /** Callback executado ao submeter os dados validados do formulário. */
  onSubmit: (payload: {
    name: string;
    email: string | null;
    phone: string | null;
    document: string | null;
    address: string | null;
  }) => void;
}

/**
 * Modal com formulário para cadastro e edição de dados de Clientes.
 */
export function CustomerEditorModal({
  open,
  onOpenChange,
  editingId,
  initialForm,
  isSaving,
  onSubmit,
}: CustomerEditorModalProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = nameRef.current?.value || "";
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      email: emailRef.current?.value.trim() || null,
      phone: phoneRef.current?.value.trim() || null,
      document: documentRef.current?.value.trim() || null,
      address: addressRef.current?.value.trim() || null,
    });
  };

  const handlePhoneBlur = () => {
    if (phoneRef.current) {
      phoneRef.current.value = formatPhone(cleanPhone(phoneRef.current.value));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border/50 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Users className="h-5 w-5 text-primary" /> {editingId ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>
        <form key={open ? (editingId ?? "new") : "closed"} onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome Completo</label>
            <Input
              required
              ref={nameRef}
              defaultValue={initialForm.name}
              className="bg-background"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                ref={emailRef}
                defaultValue={initialForm.email}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input
                ref={phoneRef}
                defaultValue={formatPhone(initialForm.phone || "")}
                onBlur={handlePhoneBlur}
                className="bg-background"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">CPF / CNPJ</label>
            <Input
              ref={documentRef}
              defaultValue={initialForm.document}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Endereço</label>
            <Input
              ref={addressRef}
              defaultValue={initialForm.address}
              className="bg-background"
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="hover-elevate">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


