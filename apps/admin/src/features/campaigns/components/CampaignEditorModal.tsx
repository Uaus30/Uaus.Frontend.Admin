import { FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  guardCalendarDismiss,
  Input,
  Label,
  Switch,
  Textarea,
} from "@workspace/ui";
import type { CampaignForm, CampaignQuestionDraft, CouponDto } from "../types";
import { CampaignInstantField } from "./CampaignInstantField";
import { CampaignQuestionsEditor } from "./CampaignQuestionsEditor";
import { CampaignCouponsCard } from "./CampaignCouponsCard";

interface CampaignEditorModalProps {
  open: boolean;
  editingId: number | null;
  form: CampaignForm;
  onFormChange: (form: CampaignForm) => void;
  questions: CampaignQuestionDraft[];
  onQuestionsChange: (questions: CampaignQuestionDraft[]) => void;
  /** True enquanto o questionário da campanha em edição está sendo carregado. */
  isLoadingDetail: boolean;
  linkedCoupons: CouponDto[];
  linkedCouponsTotal: number;
  isLoadingCoupons: boolean;
  onCreateLinkedCoupon: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  isSaving: boolean;
}

/**
 * CampaignEditorModal
 *
 * Cadastro e edição da campanha: período com data **e hora**, questionário e os
 * cupons vinculados.
 *
 * O `DialogContent` usa `guardCalendarDismiss` porque o `DatePicker` abre num
 * portal fora da modal — sem isso, escolher um dia conta como clique fora e
 * fecha o formulário inteiro, perdendo o questionário digitado.
 *
 * O botão de salvar não é bloqueado por questionário incompleto de propósito: o
 * gate é o submit, que explica exatamente qual pergunta está faltando opção. Um
 * botão apagado sem explicação é o que faz o usuário reabrir a tela procurando
 * o que ele "esqueceu de marcar".
 */
export function CampaignEditorModal({
  open,
  editingId,
  form,
  onFormChange,
  questions,
  onQuestionsChange,
  isLoadingDetail,
  linkedCoupons,
  linkedCouponsTotal,
  isLoadingCoupons,
  onCreateLinkedCoupon,
  onClose,
  onSubmit,
  isSaving,
}: CampaignEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="max-h-[92vh] max-w-3xl overflow-y-auto"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          <DialogDescription>
            O período da campanha decide apenas quando o questionário é apresentado no caixa. O
            desconto e o prazo do panfleto continuam sendo do cupom.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="campaign-name"
              placeholder="Ex: Setembro 2026"
              maxLength={120}
              value={form.name}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-description">Descrição</Label>
            <Textarea
              id="campaign-description"
              placeholder="Objetivo da campanha, canal de divulgação, etc. (opcional)"
              maxLength={300}
              rows={2}
              value={form.description}
              onChange={(event) => onFormChange({ ...form, description: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampaignInstantField
              id="campaign-starts-at"
              label="Início do período"
              required
              date={form.startsOnDate}
              onDateChange={(date) => onFormChange({ ...form, startsOnDate: date })}
              time={form.startsAtTime}
              onTimeChange={(time) => onFormChange({ ...form, startsAtTime: time })}
              hint="Inclusivo: a campanha vale a partir deste minuto."
            />

            <CampaignInstantField
              id="campaign-ends-at"
              label="Fim do período"
              date={form.endsOnDate}
              onDateChange={(date) => onFormChange({ ...form, endsOnDate: date })}
              time={form.endsAtTime}
              onTimeChange={(time) => onFormChange({ ...form, endsAtTime: time })}
              hint="Vazio = período em aberto. Inclusivo até o fim do minuto escolhido."
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="campaign-active"
              checked={form.isActive}
              onCheckedChange={(checked) => onFormChange({ ...form, isActive: checked })}
            />
            <Label htmlFor="campaign-active" className="text-sm">
              Campanha ativa
            </Label>
            <span className="text-xs text-muted-foreground">
              Desativar só interrompe as perguntas — os cupons continuam descontando.
            </span>
          </div>

          <CampaignQuestionsEditor
            questions={questions}
            onChange={onQuestionsChange}
            isLoading={isLoadingDetail}
          />

          {editingId != null && (
            <CampaignCouponsCard
              coupons={linkedCoupons}
              total={linkedCouponsTotal}
              isLoading={isLoadingCoupons}
              onCreateCoupon={onCreateLinkedCoupon}
            />
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || isLoadingDetail}>
              {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
