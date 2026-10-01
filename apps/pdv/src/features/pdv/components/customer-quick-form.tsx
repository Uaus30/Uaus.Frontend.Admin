import { useState, type ReactNode } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  CUSTOMER_ACQUISITION_CHANNEL_LABEL,
  CUSTOMER_AGE_RANGE_LABEL,
  CUSTOMER_GENDER_LABEL,
  CUSTOMER_REGISTRATION_SOURCE,
  type CreateCustomerPayload,
  type CustomerAcquisitionChannelCode,
  type CustomerAgeRangeCode,
  type CustomerGenderCode,
} from "@workspace/api-client-react";
import {
  Button,
  ChoiceChips,
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

/** O que a busca já sabia quando o operador pediu para cadastrar. */
export type QuickFormPrefill = { name?: string; phone?: string; document?: string };

type CustomerQuickFormProps = {
  prefill: QuickFormPrefill;
  defaultAreaCode: number;
  defaultCity: string;
  isSaving: boolean;
  onSubmit: (payload: CreateCustomerPayload) => void;
  onBack: () => void;
};

const GENDER_OPTIONS = [1, 2].map((value) => ({ value, label: CUSTOMER_GENDER_LABEL[value] }));
const AGE_RANGE_OPTIONS = [1, 2, 3, 4, 5, 6].map((value) => ({
  value,
  label: CUSTOMER_AGE_RANGE_LABEL[value],
}));
const CHANNEL_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({
  value,
  label: CUSTOMER_ACQUISITION_CHANNEL_LABEL[value],
}));

/** Rótulo, campo e a linha de baixo (dica ou erro), na mesma ordem nas duas colunas. */
function Field({
  label,
  hint,
  error,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1", wide && "col-span-2")}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : (
        hint && <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * Cadastro rápido do cliente no caixa (01/10/2026).
 *
 * Obrigatórios: o nome (apelido serve) e o telefone ou o CPF. O perfil é
 * opcional e o operador preenche perguntando, ou sem perguntar quando já
 * conhece o cliente — a cidade já vem com a da loja. O que está preenchido fica
 * verde, para o operador ver de relance o que falta com o cliente esperando.
 *
 * Confere com as mesmas regras do servidor (`checkCustomerIdentity`) antes de
 * mandar: sem internet o cadastro vai junto com a venda, e um telefone que o
 * servidor recusasse faria o cliente sumir da venda na sincronização.
 */
export function CustomerQuickForm({
  prefill,
  defaultAreaCode,
  defaultCity,
  isSaving,
  onSubmit,
  onBack,
}: CustomerQuickFormProps) {
  const [form, setForm] = useState({
    name: prefill.name ?? "",
    phone: prefill.phone ?? "",
    document: prefill.document ? formatCpf(prefill.document) : "",
    gender: 0,
    ageRange: 0,
    acquisitionChannel: 0,
    city: defaultCity,
    birthDate: "",
    notes: "",
  });
  const [errors, setErrors] = useState<CustomerIdentityErrors>({});
  const set = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const birthDate = parseDateBr(form.birthDate);
  const ageFromBirth = birthDate ? ageRangeFromBirthDate(birthDate) : null;
  const ageRange = ageFromBirth ?? form.ageRange;
  const filled = (value: string) => filledFieldClass(value.trim().length > 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const check = checkCustomerIdentity(form, defaultAreaCode);
    setErrors(check.errors);
    if (Object.keys(check.errors).length > 0) return;

    onSubmit({
      name: form.name.trim(),
      email: null,
      phone: check.phone,
      document: check.document,
      address: null,
      gender: form.gender as CustomerGenderCode,
      ageRange: ageRange as CustomerAgeRangeCode,
      acquisitionChannel: form.acquisitionChannel as CustomerAcquisitionChannelCode,
      city: form.city.trim() || null,
      birthDate: check.birthDate,
      notes: form.notes.trim() || null,
      registrationSource: CUSTOMER_REGISTRATION_SOURCE.Pdv,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Field label="Nome *" error={errors.name} wide>
          <Input
            aria-label="Nome"
            autoFocus={!prefill.name}
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Apelido ou primeiro nome serve"
            maxLength={150}
            className={cn("h-10", filled(form.name))}
          />
        </Field>
        <Field label="Telefone" hint={`Sem DDD, vale o ${defaultAreaCode}.`} error={errors.phone}>
          <Input
            aria-label="Telefone"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => set("phone", event.target.value)}
            onBlur={() => {
              const normalized = normalizePhone(form.phone, defaultAreaCode);
              if (normalized.ok && normalized.phone) set("phone", formatPhone(normalized.phone));
            }}
            placeholder="(44) 99876-4321"
            className={cn("h-10 font-mono", filled(form.phone))}
          />
        </Field>
        <Field label="CPF" hint="Telefone ou CPF: pelo menos um." error={errors.document}>
          <Input
            aria-label="CPF"
            inputMode="numeric"
            value={form.document}
            onChange={(event) => set("document", formatCpf(event.target.value))}
            placeholder="000.000.000-00"
            className={cn("h-10 font-mono", filled(form.document))}
          />
        </Field>
      </div>

      <div className="space-y-2.5 border-t border-border/60 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Perfil · opcional
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Field label="Sexo">
            <ChoiceChips
              label="Sexo"
              options={GENDER_OPTIONS}
              value={form.gender || null}
              onChange={(value) => set("gender", value ?? 0)}
            />
          </Field>
          <Field label="Cidade">
            <Input
              aria-label="Cidade"
              value={form.city}
              onChange={(event) => set("city", event.target.value)}
              maxLength={80}
              className={cn("h-9", filled(form.city))}
            />
          </Field>
          <Field label="Faixa de idade" hint={ageFromBirth ? "Calculada pelo nascimento." : undefined} wide>
            <ChoiceChips
              label="Faixa de idade"
              options={AGE_RANGE_OPTIONS}
              value={ageRange || null}
              onChange={(value) => !ageFromBirth && set("ageRange", value ?? 0)}
            />
          </Field>
          <Field label="Como conheceu a loja">
            <Select
              value={String(form.acquisitionChannel)}
              onValueChange={(value) => set("acquisitionChannel", Number(value))}
            >
              <SelectTrigger
                aria-label="Como conheceu a loja"
                className={cn("h-9", filledFieldClass(form.acquisitionChannel > 0))}
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
          <Field label="Nascimento" hint="Para o brinde do aniversário." error={errors.birthDate}>
            <Input
              aria-label="Nascimento"
              inputMode="numeric"
              value={form.birthDate}
              onChange={(event) => set("birthDate", formatDateBr(event.target.value))}
              placeholder="dd/mm/aaaa"
              className={cn("h-9 font-mono", filled(form.birthDate))}
            />
          </Field>
          <Field
            label="Observações"
            hint="Não anote saúde, religião, política, senhas nem dados de cartão."
            wide
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

      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Voltar para a busca
        </Button>
        <Button type="submit" disabled={isSaving} className="gap-2 font-bold">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Cadastrar e usar na venda
        </Button>
      </div>
    </form>
  );
}
