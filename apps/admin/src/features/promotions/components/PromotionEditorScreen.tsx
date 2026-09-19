import { useState } from "react";
import {
  Button,
  DatePicker,
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
  PROMOTION_DISCOUNT_TYPE,
  PROMOTION_DISCOUNT_TYPE_LABEL,
  PROMOTION_TYPE,
  PROMOTION_TYPE_LABEL,
  SELECTABLE_PROMOTION_DISCOUNT_TYPES,
  SELECTABLE_PROMOTION_TYPES,
} from "@workspace/api-client-react";
import { ConfirmDialog } from "@workspace/ui";
import { ArrowLeft, Loader2, Save, Tag, Zap } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import { DEFAULT_END_TIME, DEFAULT_START_TIME } from "../hooks/promotionRules";
import { usePromotionEditor } from "../hooks/usePromotionEditor";
import { ProductGroupPicker } from "./ProductGroupPicker";
import { PromotionPerformanceTab } from "./PromotionPerformanceTab";
import { PromotionPricePanel } from "./PromotionPricePanel";
import type { PromotionDiscountTypeCode, PromotionTypeCode } from "../types";

interface PromotionEditorScreenProps {
  /** Promoção sendo editada, ou `undefined` no cadastro novo. */
  promotionId?: number;
  onBack: () => void;
  /** Chamado depois de gravar. A página leva de volta para a listagem. */
  onSaved: () => void;
}

/**
 * Cadastro e detalhe de uma promoção, em TELA — não em modal.
 *
 * Pedido do dono, com duas razões: a URL de uma promoção pode ser compartilhada,
 * e a aba Performance (fase 2) precisa de espaço que uma modal não dá sem virar
 * janela dentro de janela.
 *
 * O painel de preço fica ao lado do formulário, e não depois dele: a decisão de
 * descer o preço é tomada olhando margem e investimento, e rolar a página para
 * ver o efeito do que se acabou de digitar é perder o fio.
 */
export function PromotionEditorScreen({ promotionId, onBack, onSaved }: PromotionEditorScreenProps) {
  /**
   * Aba corrente. Mora em estado, e não na URL, de propósito: o que se
   * compartilha é a PROMOÇÃO, e um link que abrisse direto na Performance
   * mandaria a pessoa para os números antes do cadastro que os explica.
   */
  const [aba, setAba] = useState<"cadastro" | "performance">("cadastro");

  const {
    form,
    setForm,
    isLoading,
    preview,
    isPreviewing,
    problem,
    handleSubmit,
    isSaving,
    isFlash,
    belowCost,
    confirmingBelowCost,
    dismissBelowCost,
  } = usePromotionEditor(promotionId, onSaved);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando a promoção...
      </div>
    );
  }

  const percentual = form.discountType === PROMOTION_DISCOUNT_TYPE.Percentage;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} title="Voltar para a listagem">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">
              {promotionId ? "Promoção" : "Nova promoção"}
            </h1>
            <p className="text-sm text-muted-foreground">
              O preço do produto no cadastro <strong>não</strong> é alterado: o preço promocional vale só
              enquanto a vigência durar.
            </p>
          </div>
        </div>

        {aba === "cadastro" && (
          <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        )}
      </div>

      {/* As abas só existem no DETALHE: uma promoção que ainda não foi gravada não
          tem venda para medir, e oferecer a aba Performance vazia no cadastro novo
          só ensinaria que ela não serve para nada. */}
      {promotionId && (
        <div className="flex gap-1 border-b">
          {(["cadastro", "performance"] as const).map((chave) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                aba === chave
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {chave === "cadastro" ? "Cadastro" : "Performance"}
            </button>
          ))}
        </div>
      )}

      {promotionId && aba === "performance" && <PromotionPerformanceTab promotionId={promotionId} />}

      {/* O `min-w-0` nas duas colunas não é detalhe: filho de grid não encolhe
          abaixo da largura do conteúdo sem ele, e a tabela da prévia (seis
          colunas) empurrava uma barra de rolagem horizontal para a tela toda.
          A prévia é 3/5 porque é onde está a decisão — preço, margem e
          investimento —, e o formulário cabe em 2/5. */}
      <div className={`grid gap-6 xl:grid-cols-5 ${aba === "cadastro" ? "" : "hidden"}`}>
        {/* ---------------------------------------------------------- formulário */}
        <div className="min-w-0 space-y-4 rounded-lg border bg-card p-4 xl:col-span-2">
          <div className="space-y-2">
            <Label>Produto</Label>
            <ProductGroupPicker
              value={form.productGroupId}
              valueName={form.productGroupName}
              onChange={(productGroupId, productGroupName) =>
                setForm((atual) => ({ ...atual, productGroupId, productGroupName }))
              }
            />
            <p className="text-xs text-muted-foreground">
              A promoção vale para <strong>todas as variações ativas</strong> do produto.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={String(form.type)}
                onValueChange={(valor) =>
                  setForm((atual) => ({
                    ...atual,
                    type: Number(valor) as PromotionTypeCode,
                    // Banner é coisa de relâmpago; trocar para Dia a Dia com a
                    // caixa marcada devolveria um 400 que ninguém relaciona com ela.
                    showOnSite: Number(valor) === PROMOTION_TYPE.Flash ? atual.showOnSite : false,
                    // O horário só existe na relâmpago. Sair dela com "das 14h
                    // às 18h" preenchido faria um PATAMAR de preço começar às
                    // 14h de um dia qualquer — e o campo nem estaria na tela
                    // para a pessoa desfazer.
                    startTime: Number(valor) === PROMOTION_TYPE.Flash ? atual.startTime : DEFAULT_START_TIME,
                    endTime: Number(valor) === PROMOTION_TYPE.Flash ? atual.endTime : DEFAULT_END_TIME,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_PROMOTION_TYPES.map((tipo) => (
                    <SelectItem key={tipo} value={String(tipo)}>
                      <span className="inline-flex items-center gap-2">
                        {tipo === PROMOTION_TYPE.Flash ? (
                          <Zap className="h-3.5 w-3.5" />
                        ) : (
                          <Tag className="h-3.5 w-3.5" />
                        )}
                        {PROMOTION_TYPE_LABEL[tipo]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Desconto em</Label>
              <Select
                value={String(form.discountType)}
                onValueChange={(valor) =>
                  setForm((atual) => ({ ...atual, discountType: Number(valor) as PromotionDiscountTypeCode }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_PROMOTION_DISCOUNT_TYPES.map((tipo) => (
                    <SelectItem key={tipo} value={String(tipo)}>
                      {PROMOTION_DISCOUNT_TYPE_LABEL[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{percentual ? "Percentual de desconto" : "Preço promocional"}</Label>
            <Input
              inputMode="decimal"
              value={form.discountValue}
              placeholder={percentual ? "30" : "0,99"}
              onChange={(event) => setForm((atual) => ({ ...atual, discountValue: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              {percentual
                ? "Até 90%. Respeita preços diferentes entre as variações."
                : "O mesmo preço para todas as variações do produto."}
            </p>
          </div>

          {/* ------------------------------------------------------ vigência */}
          <div className="space-y-3 rounded-md border bg-muted/20 p-3">
            <p className="text-sm font-medium">{isFlash ? "Dia da relâmpago" : "Vigência"}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">{isFlash ? "Dia" : "Início"}</Label>
                <DatePicker
                  value={form.startDate}
                  minDate={isFlash ? new Date() : undefined}
                  onChange={(date) => setForm((atual) => ({ ...atual, startDate: date ?? undefined }))}
                />
              </div>

              {/* O intervalo de horário é do RELÂMPAGO. No Dia a Dia ele não
                  significa nada — o patamar vale o dia inteiro —, e um campo
                  sem sentido na tela é um campo que alguém preenche. */}
              {isFlash && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Das</Label>
                    <Input
                      type="time"
                      value={form.startTime}
                      onChange={(event) => setForm((atual) => ({ ...atual, startTime: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Até</Label>
                    <Input
                      type="time"
                      value={form.endTime}
                      onChange={(event) => setForm((atual) => ({ ...atual, endTime: event.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {isFlash ? (
              <p className="text-xs text-muted-foreground">
                A relâmpago começa e termina no mesmo dia — no máximo 24 horas. O site anuncia a contagem até
                as 18h, que é quando a loja fecha; no caixa, ela vale até o horário escolhido.
              </p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.noEndDate}
                    onCheckedChange={(marcado) => setForm((atual) => ({ ...atual, noEndDate: marcado }))}
                  />
                  Sem prazo para acabar
                </label>

                {!form.noEndDate && (
                  <div className="space-y-2">
                    <Label className="text-xs">Fim</Label>
                    <DatePicker
                      value={form.endDate}
                      onChange={(date) => setForm((atual) => ({ ...atual, endDate: date ?? undefined }))}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --------------------------------------------------- limite e meta */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Limite por venda</Label>
              <Input
                inputMode="numeric"
                value={form.maxQuantityPerSale}
                placeholder="Sem limite"
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, maxQuantityPerSale: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                O cartaz diz "por cliente"; o sistema conta <strong>por venda</strong>. O que passar do limite
                sai a preço normal, em linha separada no cupom.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Meta de unidades</Label>
              <Input
                inputMode="numeric"
                value={form.targetQuantity}
                placeholder="Opcional"
                onChange={(event) => setForm((atual) => ({ ...atual, targetQuantity: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Quanto você espera vender. Serve para projetar o investimento e, na fase 2, para a nota.
              </p>
            </div>
          </div>

          {/* -------------------------------------------------------- flags */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.isActive}
                onCheckedChange={(marcado) => setForm((atual) => ({ ...atual, isActive: marcado }))}
              />
              Ativa
            </label>

            {isFlash && (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.showOnSite}
                  onCheckedChange={(marcado) => setForm((atual) => ({ ...atual, showOnSite: marcado }))}
                />
                Exibir no banner do site
              </label>
            )}
          </div>

          {problem && <p className="text-sm text-destructive">{problem}</p>}
        </div>

        {/* --------------------------------------------------------- prévia */}
        <div className="min-w-0 space-y-4 rounded-lg border bg-card p-4 xl:col-span-3">
          <p className="text-sm font-medium">Efeito no preço</p>
          <PromotionPricePanel
            preview={preview}
            isLoading={isPreviewing}
            targetQuantity={form.targetQuantity}
          />
        </div>
      </div>

      {/* Confirmação NOMEANDO a variação: num grupo de oito, o alerta da coluna
          da direita não compete com o botão Salvar do alto da esquerda. */}
      <ConfirmDialog
        open={confirmingBelowCost}
        title="Vender abaixo do custo?"
        itemName={form.productGroupName}
        description={
          <span>
            {belowCost.length === 1
              ? "Esta variação fica abaixo do custo:"
              : `${belowCost.length} variações ficam abaixo do custo:`}
            <ul className="mt-2 space-y-1">
              {belowCost.map((row) => (
                <li key={row.productId}>
                  <strong>{row.name}</strong> — custa {formatCurrency(row.costPrice)} e sairia por{" "}
                  {formatCurrency(row.promotionalPrice)}
                </li>
              ))}
            </ul>
          </span>
        }
        confirmLabel="Salvar assim"
        loading={isSaving}
        onConfirm={handleSubmit}
        onOpenChange={(aberto) => {
          if (!aberto) dismissBelowCost();
        }}
      />
    </div>
  );
}
