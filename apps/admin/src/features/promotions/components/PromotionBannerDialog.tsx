import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@workspace/ui";
import {
  PROMOTION_TYPE,
  PROMOTION_TYPE_LABEL,
  buildPublicImageUrl,
  enumCode,
} from "@workspace/api-client-react";
import { Printer } from "lucide-react";
import { BANNERS_PER_PAGE } from "../banner-print";
import {
  BANNER_MAX_COPIES,
  DEFAULT_BANNER_TITLE,
  bannerPriceLabel,
  type PromotionBannerEdit,
} from "../hooks/promotionBannerRules";
import { PromotionSituationBadge } from "./PromotionSituationBadge";
import type { PromotionRow } from "../types";

interface PromotionBannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** As promoções no ar e programadas, nessa ordem. */
  candidates: PromotionRow[];
  isLoading: boolean;
  /** O texto da faixa vermelha, como digitado. Vazio = "PROMOÇÃO". */
  title: string;
  onTitleChange: (title: string) => void;
  editOf: (promotion: PromotionRow) => PromotionBannerEdit;
  onToggle: (promotion: PromotionRow) => void;
  onNameChange: (promotion: PromotionRow, name: string) => void;
  onCopiesChange: (promotion: PromotionRow, copies: number) => void;
  /** Quantos banners saem no papel, somadas as cópias. */
  bannerCount: number;
  onPrint: () => void;
}

/**
 * A modal "Imprimir Banner": escolhe as promoções, reescreve o nome SÓ para o
 * papel e manda para a aba de impressão.
 *
 * Componente puro: a lista, a edição e a impressão vêm de `usePromotionBanner`.
 * O nome e as cópias só aparecem na linha MARCADA — com dez promoções no ar, a
 * lista teria vinte campos que ninguém vai usar.
 *
 * O nome reescrito **não altera o cadastro**, pela mesma razão da etiqueta de
 * gôndola: no cartaz cabe menos texto, e "COPO AMERICANO [ORIGINAL]" vira
 * "COPO AMERICANO" só no papel. Campo vazio volta ao nome do cadastro (é o
 * placeholder).
 */
export function PromotionBannerDialog({
  open,
  onOpenChange,
  candidates,
  isLoading,
  title,
  onTitleChange,
  editOf,
  onToggle,
  onNameChange,
  onCopiesChange,
  bannerCount,
  onPrint,
}: PromotionBannerDialogProps) {
  const folhas = Math.ceil(bannerCount / BANNERS_PER_PAGE);
  const resumo =
    bannerCount === 0
      ? "Marque as promoções que vão para o papel."
      : `${bannerCount} ${bannerCount === 1 ? "banner" : "banners"} · ${folhas} ${folhas === 1 ? "folha" : "folhas"}`;
  const rotulo =
    bannerCount === 0
      ? "Imprimir"
      : bannerCount === 1
        ? "Imprimir 1 banner"
        : `Imprimir ${bannerCount} banners`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Imprimir banner de promoção</DialogTitle>
          <DialogDescription>
            Saem {BANNERS_PER_PAGE} por folha A4, colados, com a linha laranja de corte. O nome sai como
            estiver no campo — editar aqui não muda o cadastro.
          </DialogDescription>
        </DialogHeader>

        {/* Um título para a folha inteira, e não por banner: a loja troca
            "PROMOÇÃO" por "OFERTA" ou "SÓ HOJE" para a impressão, e quatro
            faixas diferentes na mesma folha pareceriam quatro lojas. */}
        <div className="space-y-1">
          <Label htmlFor="banner-title" className="text-xs">
            Título do banner
          </Label>
          <Input
            id="banner-title"
            value={title}
            placeholder={DEFAULT_BANNER_TITLE}
            onChange={(event) => onTitleChange(event.target.value)}
            className="sm:w-72"
          />
        </div>

        {/* Rolagem NATIVA, e não `ScrollArea`: dentro de diálogo com `max-h` o
            viewport do Radix não rola — corta (armadilha 7 do CLAUDE.md). */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando promoções...</p>
          ) : candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma promoção no ar ou programada. Cadastre a promoção primeiro — o banner sai dela.
            </p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((promotion) => (
                <BannerRow
                  key={promotion.id}
                  promotion={promotion}
                  edit={editOf(promotion)}
                  onToggle={() => onToggle(promotion)}
                  onNameChange={(name) => onNameChange(promotion, name)}
                  onCopiesChange={(copies) => onCopiesChange(promotion, copies)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">{resumo}</span>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={onPrint} disabled={bannerCount === 0} className="gap-2">
              <Printer className="h-4 w-4" /> {rotulo}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Uma promoção na lista: a caixa, a identificação e — marcada — o nome e as cópias. */
function BannerRow({
  promotion,
  edit,
  onToggle,
  onNameChange,
  onCopiesChange,
}: {
  promotion: PromotionRow;
  edit: PromotionBannerEdit;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  onCopiesChange: (copies: number) => void;
}) {
  const checkboxId = `banner-${promotion.id}`;
  const nameId = `banner-name-${promotion.id}`;
  const copiesId = `banner-copies-${promotion.id}`;
  const tipo = PROMOTION_TYPE_LABEL[enumCode(promotion.type, PROMOTION_TYPE)] ?? "—";

  return (
    <li className={`rounded-lg border p-3 ${edit.selected ? "border-primary bg-primary/5" : "bg-card"}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={edit.selected}
          onCheckedChange={onToggle}
          aria-label={`Imprimir o banner de ${promotion.productGroupName}`}
          className="mt-1"
        />

        {/* A foto, como na etiqueta: o catálogo tem muito nome parecido, e o
            banner errado só aparece depois de colado na gôndola. */}
        {promotion.productGroupImageUrl ? (
          <img
            src={buildPublicImageUrl(promotion.productGroupImageUrl)}
            alt=""
            className="h-10 w-10 shrink-0 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded bg-muted" />
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <label htmlFor={checkboxId} className="cursor-pointer break-words font-medium">
              {promotion.productGroupName}
            </label>
            <PromotionSituationBadge situation={promotion.situation} />
            <span className="text-sm text-muted-foreground">
              {tipo} · {bannerPriceLabel(promotion)}
            </span>
          </div>

          {edit.selected && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor={nameId} className="text-xs">
                  Nome no banner
                </Label>
                <Input
                  id={nameId}
                  value={edit.name}
                  placeholder={promotion.productGroupName}
                  onChange={(event) => onNameChange(event.target.value)}
                />
              </div>
              <div className="w-28 space-y-1">
                <Label htmlFor={copiesId} className="text-xs">
                  Cópias
                </Label>
                {/* Campo limpo mostra vazio, e não "0": o zero vira 1 na impressão. */}
                <Input
                  id={copiesId}
                  type="number"
                  min={1}
                  max={BANNER_MAX_COPIES}
                  value={edit.copies === 0 ? "" : edit.copies}
                  onChange={(event) => onCopiesChange(Number(event.target.value))}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
