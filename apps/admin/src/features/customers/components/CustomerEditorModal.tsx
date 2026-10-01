import { useState, type ReactNode } from "react";
import {
  Button,
  ChoiceChips,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
  filledFieldClass,
} from "@workspace/ui";
import { Loader2, Users } from "lucide-react";
import {
  ageRangeFromBirthDate,
  checkCustomerIdentity,
  formatCpf,
  formatDateBr,
  formatPhone,
  normalizePhone,
  parseDateBr,
  type CustomerIdentityErrors,
} from "@workspace/core";
import {
  CUSTOMER_ACQUISITION_CHANNEL_LABEL,
  CUSTOMER_AGE_RANGE_LABEL,
  CUSTOMER_GENDER_LABEL,
  type CreateCustomerPayload,
  type CustomerAcquisitionChannelCode,
  type CustomerAgeRangeCode,
  type CustomerGenderCode,
} from "@workspace/api-client-react";
import type { CustomerForm } from "../types";

interface CustomerEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ID do cliente sendo editado, ou null se for novo cadastro. */
  editingId: number | null;
  initialForm: CustomerForm;
  /** DDD padrão da loja: o telefone digitado sem DDD ganha este. */
  defaultAreaCode: number;
  /** Cidade da loja, que o cadastro novo já traz preenchida. */
  defaultCity: string;
  isSaving: boolean;
  onSubmit: (payload: CreateCustomerPayload) => void;
}

const GENDER_OPTIONS = [1, 2].map((value) => ({ value, label: CUSTOMER_GENDER_LABEL[value] }));
const AGE_RANGE_OPTIONS = [1, 2, 3, 4, 5, 6].map((value) => ({
  value,
  label: CUSTOMER_AGE_RANGE_LABEL[value],
}));
const CHANNEL_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({
  value,
  label: CUSTOMER_ACQUISITION_CHANNEL_LABEL[value],
}));

/** Rótulo, campo, dica e erro, sempre na mesma ordem: é o que alinha as duas colunas. */
function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * Modal de cadastro e edição de cliente (01/10/2026: cadastro do programa de
 * fidelidade).
 *
 * Duas colunas alinhadas e o que foi preenchido em verde, como o dono pediu: no
 * caixa ou no admin, quem cadastra vê de relance o que falta. Obrigatórios: o
 * nome (apelido serve) e o telefone ou o CPF. O resto é perfil, opcional.
 *
 * O telefone é normalizado ao sair do campo — "99876-4321" vira "(44)
 * 99876-4321" na frente do operador, que vê o DDD padrão sendo aplicado. A
 * máscara não roda enquanto ele digita porque cortaria o "+55" de quem cola o
 * número com o código do país.
 */
export function CustomerEditorModal(props: CustomerEditorModalProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Users className="h-5 w-5 text-primary" /> {props.editingId ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
        </DialogHeader>
        {/* A chave remonta o formulário a cada abertura: o estado nasce do cliente certo. */}
        {props.open && <CustomerFormBody key={props.editingId ?? "new"} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function CustomerFormBody({
  onOpenChange,
  editingId,
  initialForm,
  defaultAreaCode,
  defaultCity,
  isSaving,
  onSubmit,
}: CustomerEditorModalProps) {
  const [form, setForm] = useState<CustomerForm>(initialForm);
  const [errors, setErrors] = useState<CustomerIdentityErrors>({});
  // A configuração da loja pode chegar depois da modal aberta: até o operador
  // mexer na cidade, o cadastro novo mostra a da loja.
  const [cityEdited, setCityEdited] = useState(editingId !== null);
  const city = cityEdited ? form.city : form.city || defaultCity;

  const set = <K extends keyof CustomerForm>(field: K, value: CustomerForm[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  // Com o nascimento, a faixa sai dele e os chips só mostram o resultado.
  const birthDate = parseDateBr(form.birthDate);
  const ageFromBirth = birthDate ? ageRangeFromBirthDate(birthDate) : null;
  const ageRange = ageFromBirth ?? form.ageRange;

  const handlePhoneBlur = () => {
    const normalized = normalizePhone(form.phone, defaultAreaCode);
    if (normalized.ok && normalized.phone) set("phone", formatPhone(normalized.phone));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const check = checkCustomerIdentity(form, defaultAreaCode);
    setErrors(check.errors);
    if (Object.keys(check.errors).length > 0) return;

    onSubmit({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: check.phone,
      document: check.document,
      address: form.address.trim() || null,
      gender: form.gender as CustomerGenderCode,
      ageRange: ageRange as CustomerAgeRangeCode,
      acquisitionChannel: form.acquisitionChannel as CustomerAcquisitionChannelCode,
      city: city.trim() || null,
      birthDate: check.birthDate,
      notes: form.notes.trim() || null,
    });
  };

  const filled = (value: string) => filledFieldClass(value.trim().length > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-5 py-2" noValidate>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <Field label="Nome *" error={errors.name} className="sm:col-span-2">
          <Input
            aria-label="Nome"
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Apelido ou primeiro nome serve: Ana do salão"
            maxLength={150}
            className={filled(form.name)}
          />
        </Field>
        <Field label="Telefone" hint={`Sem DDD, vale o ${defaultAreaCode}.`} error={errors.phone}>
          <Input
            aria-label="Telefone"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => set("phone", event.target.value)}
            onBlur={handlePhoneBlur}
            placeholder="(44) 99876-4321"
            className={filled(form.phone)}
          />
        </Field>
        <Field label="CPF" hint="Telefone ou CPF: pelo menos um." error={errors.document}>
          <Input
            aria-label="CPF"
            inputMode="numeric"
            value={form.document}
            onChange={(event) => set("document", formatCpf(event.target.value))}
            placeholder="000.000.000-00"
            className={filled(form.document)}
          />
        </Field>
        <Field label="Email">
          <Input
            aria-label="Email"
            type="email"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            className={filled(form.email)}
          />
        </Field>
        <Field label="Cidade">
          <Input
            aria-label="Cidade"
            value={city}
            onChange={(event) => {
              setCityEdited(true);
              set("city", event.target.value);
            }}
            maxLength={80}
            className={filled(city)}
          />
        </Field>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Perfil · opcional
        </p>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Sexo">
            <ChoiceChips
              label="Sexo"
              options={GENDER_OPTIONS}
              value={form.gender || null}
              onChange={(value) => set("gender", value ?? 0)}
            />
          </Field>
          <Field label="Como conheceu a loja">
            <Select
              value={String(form.acquisitionChannel)}
              onValueChange={(value) => set("acquisitionChannel", Number(value))}
            >
              <SelectTrigger
                aria-label="Como conheceu a loja"
                className={filledFieldClass(form.acquisitionChannel > 0)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Não informado</SelectItem>
                {CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Faixa de idade"
            hint={ageFromBirth ? "Calculada pelo nascimento." : undefined}
            className="sm:col-span-2"
          >
            <ChoiceChips
              label="Faixa de idade"
              options={AGE_RANGE_OPTIONS}
              value={ageRange || null}
              onChange={(value) => !ageFromBirth && set("ageRange", value ?? 0)}
            />
          </Field>
          <Field label="Nascimento" hint="Para brinde no mês do aniversário." error={errors.birthDate}>
            <Input
              aria-label="Nascimento"
              inputMode="numeric"
              value={form.birthDate}
              onChange={(event) => set("birthDate", formatDateBr(event.target.value))}
              placeholder="dd/mm/aaaa"
              className={filled(form.birthDate)}
            />
          </Field>
          <Field label="Endereço">
            <Input
              aria-label="Endereço"
              value={form.address}
              onChange={(event) => set("address", event.target.value)}
              className={filled(form.address)}
            />
          </Field>
          <Field
            label="Observações"
            hint="Não anote saúde, religião, política, senhas nem dados de cartão."
            className="sm:col-span-2"
          >
            <Textarea
              aria-label="Observações"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Preferências e pedidos. Ex.: gosta de maquiagem; quer aviso quando chegar o pote grande."
              className={filled(form.notes)}
            />
          </Field>
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving} className="hover-elevate">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar cliente"}
        </Button>
      </DialogFooter>
    </form>
  );
}
