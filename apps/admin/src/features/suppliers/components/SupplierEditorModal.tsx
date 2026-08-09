import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Loader2, Phone, RefreshCw } from "lucide-react";
import { cleanPhone, formatPhone } from "@/lib/utils";
import { UF_LIST, randomColor } from "../hooks/useSuppliers";
import type { SupplierForm } from "../types";

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
 * Componente de avatar do fornecedor utilizado no formulário.
 */
function SupplierAvatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-9 w-9 text-sm" : size === "lg" ? "h-16 w-16 text-2xl" : "h-10 w-10 text-sm";

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
 * Propriedades do componente SupplierEditorModal.
 */
interface SupplierEditorModalProps {
  /** Determina se a modal de formulário está aberta. */
  open: boolean;
  /** Callback para alteração do estado de exibição. */
  onOpenChange: (open: boolean) => void;
  /** ID do fornecedor em edição, ou null para novo cadastro. */
  editingId: number | null;
  /** Estado inicial do formulário do fornecedor. */
  initialForm: SupplierForm;
  /** Indica se os dados estão sendo salvos (loading). */
  saving: boolean;
  /** Opções selecionáveis de status do enum. */
  selectableSupplierStatusOptions: any[];
  /** Valor padrão de status ativo. */
  activeStatusValue: string;
  /** Callback de submissão do formulário. */
  onSubmit: (form: SupplierForm) => Promise<void>;
}

/**
 * Modal com formulário detalhado para criação e edição de Fornecedores.
 */
export function SupplierEditorModal({
  open,
  onOpenChange,
  editingId,
  initialForm,
  saving,
  selectableSupplierStatusOptions,
  onSubmit,
}: SupplierEditorModalProps) {
  const [name, setName] = useState(initialForm.name);
  const [status, setStatus] = useState(initialForm.status || "");
  const [state, setState] = useState(initialForm.state || "");
  const [avatarColor, setAvatarColor] = useState(initialForm.avatarColor || "");

  useEffect(() => {
    if (open) {
      setName(initialForm.name);
      setStatus(initialForm.status || "");
      setState(initialForm.state || "");
      setAvatarColor(initialForm.avatarColor || "");
    }
  }, [open, initialForm]);

  const corporateNameRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const salesRepresentativeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const minimumPurchaseValueRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void onSubmit({
      name,
      corporateName: corporateNameRef.current?.value || "",
      document: documentRef.current?.value || "",
      salesRepresentative: salesRepresentativeRef.current?.value || "",
      phone: phoneRef.current?.value || "",
      email: emailRef.current?.value || "",
      minimumPurchaseValue: minimumPurchaseValueRef.current?.value || "",
      status,
      city: cityRef.current?.value || "",
      state,
      avatarColor,
      description: descriptionRef.current?.value || "",
    });
  };

  const handlePhoneBlur = () => {
    if (phoneRef.current) {
      phoneRef.current.value = formatPhone(cleanPhone(phoneRef.current.value));
    }
  };

  const statusSelect = useMemo(() => (
    <Select
      value={status}
      onValueChange={setStatus}
      disabled={selectableSupplierStatusOptions.length === 0}
    >
      <SelectTrigger className="bg-background">
        <SelectValue placeholder="Selecione..." />
      </SelectTrigger>
      <SelectContent>
        {selectableSupplierStatusOptions.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ), [status, selectableSupplierStatusOptions]);

  const ufSelect = useMemo(() => (
    <Select
      value={state || "__none"}
      onValueChange={(value) => setState(value === "__none" ? "" : value)}
    >
      <SelectTrigger className="bg-background">
        <SelectValue placeholder="Selecione..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Não informar</SelectItem>
        {UF_LIST.map((uf) => (
          <SelectItem key={uf} value={uf}>
            {uf}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ), [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <form key={open ? (editingId ?? "new") : "closed"} onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,220px)] sm:items-end">
              <div className="relative h-16 w-16 flex-shrink-0 sm:self-center">
                <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }}>
                  <defs>
                    <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff3b30" />
                      <stop offset="20%" stopColor="#ff9500" />
                      <stop offset="40%" stopColor="#ffcc00" />
                      <stop offset="60%" stopColor="#4cd964" />
                      <stop offset="80%" stopColor="#5ac8fa" />
                      <stop offset="100%" stopColor="#5856d6" />
                    </linearGradient>
                  </defs>
                </svg>
                <SupplierAvatar name={name || "?"} color={avatarColor} size="lg" />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-6 w-6 rounded-full border border-border bg-background shadow-md hover:bg-muted hover-elevate"
                  style={{ position: "absolute", bottom: "-4px", right: "-4px", zIndex: 10 }}
                  title="Gerar nova cor"
                  aria-label="Gerar nova cor"
                  onClick={() => setAvatarColor(randomColor())}
                >
                  <RefreshCw className="h-3.5 w-3.5" stroke="url(#rainbow-gradient)" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-name">Nome do fornecedor</Label>
                <Input
                  id="supplier-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="bg-background"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-minimum-purchase">Valor mínimo de compra (R$)</Label>
                <Input
                  id="supplier-minimum-purchase"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  ref={minimumPurchaseValueRef}
                  defaultValue={initialForm.minimumPurchaseValue}
                  className="bg-background"
                  required
                />
              </div>
            </div>
          </div>

          <fieldset className="space-y-4 rounded-xl border border-border/40 p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">Informações opcionais:</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Razão Social</Label>
                <Input
                  ref={corporateNameRef}
                  defaultValue={initialForm.corporateName || ""}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input
                  ref={documentRef}
                  defaultValue={initialForm.document || ""}
                  className="bg-background font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vendedor</Label>
                <Input
                  ref={salesRepresentativeRef}
                  defaultValue={initialForm.salesRepresentative || ""}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telefone
                </Label>
                <Input
                  ref={phoneRef}
                  defaultValue={formatPhone(initialForm.phone || "")}
                  onBlur={handlePhoneBlur}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  ref={emailRef}
                  defaultValue={initialForm.email || ""}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                {statusSelect}
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input
                  ref={cityRef}
                  defaultValue={initialForm.city || ""}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                {ufSelect}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição</Label>
                <textarea
                  ref={descriptionRef}
                  defaultValue={initialForm.description || ""}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Descrição do fornecedor (limite de 200 caracteres)..."
                  maxLength={200}
                />
              </div>
            </div>
          </fieldset>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover-elevate">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


