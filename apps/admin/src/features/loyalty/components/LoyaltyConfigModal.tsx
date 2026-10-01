import { useState, type ReactNode } from "react";
import { Loader2, Stamp } from "lucide-react";
import {
  COUPON_DISCOUNT_TYPE,
  enumCode,
  type CouponDto,
  type LoyaltySettingsDto,
  type UpdateLoyaltySettingsPayload,
} from "@workspace/api-client-react";
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
  cn,
  filledFieldClass,
} from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { formToPayload, settingsToForm } from "../lib/loyalty-form";
import type { LoyaltyConfigForm } from "../types";

type LoyaltyConfigModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: LoyaltySettingsDto;
  coupons: CouponDto[];
  isSaving: boolean;
  onSave: (payload: UpdateLoyaltySettingsPayload) => void;
};

const TYPE_OPTIONS = [
  { value: COUPON_DISCOUNT_TYPE.Amount as number, label: "R$" },
  { value: COUPON_DISCOUNT_TYPE.Percentage as number, label: "%" },
];

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const couponLabel = (coupon: CouponDto) =>
  `${coupon.code} · ${
    enumCode(coupon.discountType, COUPON_DISCOUNT_TYPE) === COUPON_DISCOUNT_TYPE.Percentage
      ? `${coupon.discountValue}%`
      : formatCurrency(coupon.discountValue)
  }`;

/**
 * A configuração do programa num modal (01/10/2026), em três blocos: cartão,
 * prêmios e prazos. Cada prêmio tem um cupom associado do mesmo tipo e valor,
 * ativo, sem data de fim, ilimitado e sem compra mínima — o servidor confere e
 * a tela mostra o que falta acima dos cards.
 */
export function LoyaltyConfigModal(props: LoyaltyConfigModalProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Stamp className="h-5 w-5 text-primary" /> Configurar programa de fidelidade
          </DialogTitle>
        </DialogHeader>
        {props.open && <ConfigForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ConfigForm({ onOpenChange, settings, coupons, isSaving, onSave }: LoyaltyConfigModalProps) {
  const [form, setForm] = useState<LoyaltyConfigForm>(() => settingsToForm(settings));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof LoyaltyConfigForm>(field: K, value: LoyaltyConfigForm[K]) =>
    setForm((current) => ({ ...current, [field]: value }));
  const filled = (value: string) => filledFieldClass(value.trim().length > 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = formToPayload(form);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onSave(result.payload);
  };

  const couponSelect = (field: "middleCouponId" | "finalCouponId", label: string) => (
    <Select value={form[field]} onValueChange={(value) => set(field, value)}>
      <SelectTrigger aria-label={label} className={filled(form[field])}>
        <SelectValue placeholder="Escolha o cupom" />
      </SelectTrigger>
      <SelectContent>
        {coupons.map((coupon) => (
          <SelectItem key={coupon.id} value={String(coupon.id)}>
            {couponLabel(coupon)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const number = (
    field: keyof LoyaltyConfigForm,
    label: string,
    extra?: { placeholder?: string; inputMode?: "numeric" | "decimal" },
  ) => (
    <Input
      aria-label={label}
      inputMode={extra?.inputMode ?? "numeric"}
      placeholder={extra?.placeholder}
      value={form[field] as string}
      onChange={(event) => set(field, event.target.value as never)}
      className={filled(form[field] as string)}
    />
  );

  return (
    <form onSubmit={submit} className="space-y-5 py-2" noValidate>
      <section className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-3">
          Cartão
        </p>
        <Field label="Carimbos por cartão">{number("stampsPerCard", "Carimbos por cartão")}</Field>
        <Field label="Carimbo extra no cartão novo">
          {number("bonusStampsOnNewCard", "Carimbo extra no cartão novo")}
        </Field>
        <Field label="Mínimo para o carimbo (R$)">
          {number("minimumPurchaseForStamp", "Mínimo para o carimbo", {
            inputMode: "decimal",
            placeholder: "10,00",
          })}
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-x-4 gap-y-3 border-t border-border/60 pt-4 sm:grid-cols-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-3">
          Prêmios
        </p>
        <Field label="Prêmio do meio no carimbo" hint="Vazio: só o prêmio do cartão completo.">
          {number("middleStamp", "Prêmio do meio no carimbo", { placeholder: "5" })}
        </Field>
        <Field label="Valor do prêmio do meio">
          <div className="flex gap-2">
            <ChoiceChips
              label="Tipo do prêmio do meio"
              options={TYPE_OPTIONS}
              value={form.middleDiscountType}
              allowDeselect={false}
              onChange={(value) => set("middleDiscountType", value ?? COUPON_DISCOUNT_TYPE.Amount)}
            />
            {number("middleDiscountValue", "Valor do prêmio do meio", { inputMode: "decimal" })}
          </div>
        </Field>
        <Field label="Cupom do prêmio do meio">
          {couponSelect("middleCouponId", "Cupom do prêmio do meio")}
        </Field>

        <Field label="Prêmio do cartão completo" hint={`No ${form.stampsPerCard || "último"}º carimbo.`}>
          <div className="flex gap-2">
            <ChoiceChips
              label="Tipo do prêmio do cartão completo"
              options={TYPE_OPTIONS}
              value={form.finalDiscountType}
              allowDeselect={false}
              onChange={(value) => set("finalDiscountType", value ?? COUPON_DISCOUNT_TYPE.Amount)}
            />
            {number("finalDiscountValue", "Valor do prêmio do cartão completo", { inputMode: "decimal" })}
          </div>
        </Field>
        <Field label="Cupom do cartão completo">
          {couponSelect("finalCouponId", "Cupom do cartão completo")}
        </Field>
        <Field label="Compra mínima do prêmio (R$)" hint="Vazio: igual ao mínimo do carimbo.">
          {number("rewardMinimumPurchase", "Compra mínima do prêmio", { inputMode: "decimal" })}
        </Field>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          O cupom associado precisa ter o mesmo tipo e valor do prêmio, estar ativo, sem data de fim, com usos
          ilimitados e sem compra mínima própria. Com o programa ligado, ele fica travado na tela de cupons;
          com prêmio de cliente para trocar, não pode ser desativado nem excluído.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-x-4 gap-y-3 border-t border-border/60 pt-4 sm:grid-cols-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-2">
          Prazos
        </p>
        <Field
          label="Validade do cartão (meses)"
          hint="Conta da primeira compra no cartão; vencido, os carimbos se perdem."
        >
          {number("cardValidityMonths", "Validade do cartão")}
        </Field>
        <Field label="Folga para trocar o prêmio (dias)" hint="Depois do vencimento do cartão.">
          {number("rewardGraceDays", "Folga para trocar o prêmio")}
        </Field>
      </section>

      <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        O valor mínimo vale na hora. Carimbos por cartão e prêmios valem para os cartões abertos daqui em
        diante.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
