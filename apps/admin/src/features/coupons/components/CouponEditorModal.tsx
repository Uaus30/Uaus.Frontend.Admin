import { FormEvent } from "react";
import {
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  guardCalendarDismiss,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@workspace/ui";
import {
  COUPON_DISCOUNT_TYPE,
  COUPON_DISCOUNT_TYPE_LABEL,
  SELECTABLE_COUPON_DISCOUNT_TYPES,
  type CampaignDto,
} from "@workspace/api-client-react";
import { SEM_CAMPANHA } from "../hooks/useCoupons";
import type { CouponDiscountTypeCode, CouponDto, CouponForm } from "../types";

interface CouponEditorModalProps {
  open: boolean;
  /** Cupom em edição, ou null no cadastro. Traz o `redeemedCount` que trava o código. */
  editing: CouponDto | null;
  form: CouponForm;
  onFormChange: (form: CouponForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  isSaving: boolean;
  campaigns: CampaignDto[];
}

/**
 * Formulário de cadastro/edição de cupom.
 *
 * **A vigência é dia + hora, montada aqui.** O `DatePicker` do `packages/ui`
 * entrega só a data de calendário, mas o backend guarda instantes; a hora é um
 * controle próprio desta feature, e o fim nasce em 23:59 — ver o README, é a
 * diferença entre o cupom valer o último dia inteiro ou morrer à meia-noite dele.
 */
export function CouponEditorModal({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  isSaving,
  campaigns,
}: CouponEditorModalProps) {
  // Trocar o código depois do primeiro resgate mata todo panfleto em circulação:
  // quem apresentasse o papel ouviria "cupom não encontrado" e ninguém saberia
  // por quê. O backend recusa; aqui o campo nem chega a ser editável.
  const codigoTravado = (editing?.redeemedCount ?? 0) > 0;
  const percentual = form.discountType === COUPON_DISCOUNT_TYPE.Percentage;

  const alterar = (patch: Partial<CouponForm>) => onFormChange({ ...form, ...patch });

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      {/* O calendário abre num portal fora do modal; sem as guardas, o Radix
          trataria o clique num dia como interação externa e fecharia o form. */}
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
          <DialogDescription>
            O código é o que sai impresso no panfleto e o que o cliente dita no balcão. O desconto é calculado
            sobre o subtotal já descontado o abatimento manual da venda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cp-code">Código *</Label>
              <Input
                id="cp-code"
                placeholder="Ex: VERAO26"
                value={form.code}
                onChange={(e) => alterar({ code: e.target.value.toUpperCase() })}
                disabled={codigoTravado}
                maxLength={30}
                required
              />
              <p className="text-xs text-muted-foreground">
                {codigoTravado
                  ? "O código não muda depois do primeiro resgate — mudá-lo invalidaria os panfletos já distribuídos."
                  : "Letras maiúsculas, números e hífen, de 3 a 30 caracteres."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cp-description">Descrição</Label>
              <Input
                id="cp-description"
                placeholder="Sai impressa no comprovante (opcional)"
                value={form.description}
                onChange={(e) => alterar({ description: e.target.value })}
                maxLength={150}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cp-type">Tipo de desconto *</Label>
              <Select
                value={String(form.discountType)}
                onValueChange={(value) => alterar({ discountType: Number(value) as CouponDiscountTypeCode })}
              >
                <SelectTrigger id="cp-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_COUPON_DISCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={String(type)}>
                      {COUPON_DISCOUNT_TYPE_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cp-value">{percentual ? "Percentual (%) *" : "Valor (R$) *"}</Label>
              <Input
                id="cp-value"
                inputMode="decimal"
                placeholder={percentual ? "10" : "20,00"}
                value={form.discountValue}
                onChange={(e) => alterar({ discountValue: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                {percentual
                  ? "De 1 a 100. A base é o subtotal menos o desconto manual da venda."
                  : "Em reais. Pode zerar a venda, nunca torná-la negativa."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cp-valid-from">Início da vigência *</Label>
              <div className="flex gap-2">
                <DatePicker
                  id="cp-valid-from"
                  value={form.validFromDate}
                  onChange={(date) => alterar({ validFromDate: date })}
                  clearable={false}
                  className="flex-1"
                />
                <Input
                  type="time"
                  aria-label="Hora de início da vigência"
                  value={form.validFromTime}
                  onChange={(e) => alterar({ validFromTime: e.target.value })}
                  className="w-28"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cp-valid-until">Fim da vigência</Label>
              <div className="flex gap-2">
                <DatePicker
                  id="cp-valid-until"
                  value={form.validUntilDate}
                  onChange={(date) => alterar({ validUntilDate: date })}
                  placeholder="Sem prazo"
                  minDate={form.validFromDate}
                  className="flex-1"
                />
                <Input
                  type="time"
                  aria-label="Hora de fim da vigência"
                  value={form.validUntilTime}
                  onChange={(e) => alterar({ validUntilTime: e.target.value })}
                  className="w-28"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Em branco = sem prazo. A hora vale até o último segundo do minuto escolhido: 23:59 cobre o dia
                inteiro.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cp-usage-limit">Teto de resgates</Label>
              <Input
                id="cp-usage-limit"
                inputMode="numeric"
                placeholder="Ilimitado"
                value={form.usageLimit}
                onChange={(e) => alterar({ usageLimit: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para ilimitado. É orçamento de marketing, não trava de estoque: uma venda
                offline pode entrar acima do teto e o sistema a aceita.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cp-campaign">Campanha</Label>
              <Select
                value={form.campaignId || SEM_CAMPANHA}
                onValueChange={(value) => alterar({ campaignId: value === SEM_CAMPANHA ? "" : value })}
              >
                <SelectTrigger id="cp-campaign">
                  <SelectValue placeholder="Sem campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_CAMPANHA}>Sem campanha</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={String(campaign.id)}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A campanha só fornece o questionário do balcão. Quem decide o desconto é a vigência deste
                cupom.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Switch
              id="cp-active"
              checked={form.isActive}
              onCheckedChange={(value) => alterar({ isActive: value })}
            />
            <Label htmlFor="cp-active" className="cursor-pointer">
              Cupom ativo
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
