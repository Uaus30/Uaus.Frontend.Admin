import type { Dispatch, SetStateAction } from "react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import { PROMOTION_DISCOUNT_TYPE } from "@workspace/api-client-react";
import { X } from "lucide-react";
import { ProductGroupPicker } from "./ProductGroupPicker";
import type { PromotionDiscountTypeCode, PromotionForm } from "../types";

type SetForm = Dispatch<SetStateAction<PromotionForm>>;

/**
 * Os produtos do combo: a lista escolhida e a busca para acrescentar.
 *
 * As unidades de TODOS somam para o kit — "3 esmaltes Risqué ou Impala". O
 * primeiro é a capa da linha na listagem; a ordem não muda a conta.
 */
export function ComboProductsField({ form, setForm }: { form: PromotionForm; setForm: SetForm }) {
  return (
    <div className="space-y-2">
      <Label>Produtos do combo</Label>

      {form.comboGroups.length > 0 && (
        <ul className="space-y-1">
          {form.comboGroups.map((group) => (
            <li
              key={group.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-1.5"
            >
              <span className="truncate text-sm font-medium">{group.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                title={`Tirar ${group.name} do combo`}
                onClick={() =>
                  setForm((atual) => ({
                    ...atual,
                    comboGroups: atual.comboGroups.filter((candidato) => candidato.id !== group.id),
                  }))
                }
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* `value` nulo de propósito: o seletor fica sempre no modo de busca, e
          escolher ACRESCENTA à lista em vez de trocar o produto. */}
      <ProductGroupPicker
        value={null}
        valueName=""
        onChange={(id, name) =>
          setForm((atual) =>
            atual.comboGroups.some((group) => group.id === id)
              ? atual
              : { ...atual, comboGroups: [...atual.comboGroups, { id, name }] },
          )
        }
      />

      <p className="text-xs text-muted-foreground">
        As unidades de <strong>todos</strong> os produtos somam para formar o combo, em todas as variações
        ativas.
      </p>
    </div>
  );
}

/**
 * Como o combo vale: "a cada N itens" (preço do kit) ou "a partir de N itens"
 * (desconto por unidade). O modo É o tipo de desconto — o preço do kit só faz
 * sentido a cada N, e o desconto por unidade só a partir de N.
 */
export function ComboModeField({ form, setForm }: { form: PromotionForm; setForm: SetForm }) {
  const kit = form.discountType === PROMOTION_DISCOUNT_TYPE.KitPrice;

  return (
    <div className="space-y-2">
      <Label>Como vale</Label>
      <Select
        value={kit ? "kit" : "a-partir"}
        onValueChange={(valor) =>
          setForm((atual) => ({
            ...atual,
            discountType:
              valor === "kit" ? PROMOTION_DISCOUNT_TYPE.KitPrice : PROMOTION_DISCOUNT_TYPE.Percentage,
            // O valor muda de natureza (preço do kit ↔ percentual): mantê-lo faria
            // "20" virar 20% sem ninguém ter digitado isso.
            discountValue: "",
          }))
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="kit">A cada N itens</SelectItem>
          <SelectItem value="a-partir">A partir de N itens</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** Quantidade, tipo do desconto por unidade e valor — com a frase do cartaz. */
export function ComboDiscountFields({ form, setForm }: { form: PromotionForm; setForm: SetForm }) {
  const kit = form.discountType === PROMOTION_DISCOUNT_TYPE.KitPrice;
  const percentual = form.discountType === PROMOTION_DISCOUNT_TYPE.Percentage;
  const n = form.comboQuantity.trim() || "N";

  const rotulo = kit ? "Preço do kit" : percentual ? "Percentual de desconto" : "Preço por unidade";
  const exemplo = kit ? "20,00" : percentual ? "10" : "6,50";

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Quantidade</Label>
          <Input
            inputMode="numeric"
            value={form.comboQuantity}
            placeholder="3"
            onChange={(event) => setForm((atual) => ({ ...atual, comboQuantity: event.target.value }))}
          />
        </div>

        {!kit && (
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
                <SelectItem value={String(PROMOTION_DISCOUNT_TYPE.Percentage)}>Percentual</SelectItem>
                <SelectItem value={String(PROMOTION_DISCOUNT_TYPE.FinalPrice)}>Preço por unidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>{rotulo}</Label>
        <Input
          inputMode="decimal"
          value={form.discountValue}
          placeholder={exemplo}
          onChange={(event) => setForm((atual) => ({ ...atual, discountValue: event.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          {kit
            ? `Cada ${n} itens saem pelo preço do kit. O que sobrar do kit sai a preço normal, e com preços diferentes os mais caros entram primeiro.`
            : `Quando o carrinho chega a ${n} itens, todos ganham o desconto — inclusive os que passarem de ${n}.`}
        </p>
      </div>
    </div>
  );
}
