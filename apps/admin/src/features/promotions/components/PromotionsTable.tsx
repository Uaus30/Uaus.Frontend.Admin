import {
  Button,
  ConfirmDialog,
  ImageHoverZoom,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui";
import {
  PROMOTION_DISCOUNT_TYPE,
  PROMOTION_TYPE,
  PROMOTION_TYPE_LABEL,
  buildPublicImageUrl,
  enumCode,
} from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import { CopyPlus, PowerOff, Tag, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { PromotionSituationBadge } from "./PromotionSituationBadge";
import type { PromotionDto, PromotionRow } from "../types";

/** Desconto no formato que o cartaz promete: "30%" ou "R$ 0,99". */
function formatDiscount(promotion: PromotionDto): string {
  const type = enumCode(promotion.discountType, PROMOTION_DISCOUNT_TYPE);

  return type === PROMOTION_DISCOUNT_TYPE.Percentage
    ? `${promotion.discountValue.toLocaleString("pt-BR")}%`
    : formatCurrency(promotion.discountValue);
}

/**
 * Faixa de preço "de/por".
 *
 * Variações com preços diferentes viram faixa: mostrar um preço só mentiria para
 * metade delas, que é a mesma razão do "A partir de" da vitrine.
 */
function formatPriceRange(min: number, max: number): string {
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

/** Vigência em data e hora. Sem fim é "sem prazo", não uma data em branco. */
function formatWindow(promotion: PromotionDto): string {
  const inicio = formatInstant(promotion.validFrom);
  return promotion.validUntil
    ? `${inicio} → ${formatInstant(promotion.validUntil)}`
    : `${inicio} · sem prazo`;
}

/**
 * Lê o instante da API pelos componentes da string.
 *
 * `new Date("2026-09-19T14:00:00")` funcionaria hoje, mas basta o backend um dia
 * acrescentar `Z` para a mesma linha passar a mostrar três horas a menos.
 */
function formatInstant(value: string): string {
  const [data, hora = ""] = value.split("T");
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} ${hora.slice(0, 5)}`.trim();
}

interface PromotionsTableProps {
  items: PromotionRow[];
  isLoading: boolean;
  /** True enquanto uma ação está em voo — bloqueia o segundo clique. */
  isBusy: boolean;
  onOpen: (promotion: PromotionRow) => void;
  /** Abre o cadastro já preenchido com esta promoção, para a semana seguinte. */
  onRepeat: (promotion: PromotionRow) => void;
  onEnd: (promotion: PromotionRow) => Promise<unknown>;
  onDelete: (promotion: PromotionRow) => Promise<unknown>;
}

/**
 * Tabela das promoções.
 *
 * A confirmação mora aqui porque é aqui que está o nome da linha clicada —
 * "tem certeza?" sozinho obriga a lembrar em qual linha se clicou, que é o que
 * `convencoes-de-interface.md` proíbe.
 *
 * Em tela estreita as colunas saem por prioridade (`hidden 2xl:table-cell`), e
 * nunca viram rolagem horizontal: o que a barra empurra para fora é a ponta
 * direita, onde moram a situação e as ações.
 */
export function PromotionsTable({
  items,
  isLoading,
  isBusy,
  onOpen,
  onRepeat,
  onEnd,
  onDelete,
}: PromotionsTableProps) {
  const [pendente, setPendente] = useState<{ acao: "encerrar" | "excluir"; item: PromotionRow } | null>(null);

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando promoções...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card">
        <Zap className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-base">Nenhuma promoção encontrada</p>
        <p className="text-sm">
          Cadastre o produto, o desconto e a vigência. O preço do produto não é alterado — ele volta sozinho
          quando a promoção acaba.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead className="hidden 2xl:table-cell">De</TableHead>
              <TableHead>Por</TableHead>
              <TableHead className="hidden 2xl:table-cell">Limite</TableHead>
              {/* Ao lado da situação, e NÃO dentro de uma nota: a nota mede
                  movimento ("funcionou?") e mora na aba Performance; o
                  investimento mede preço ("quanto custou?"). Fundir os dois faria
                  uma nota baixa virar ambígua — não vendeu, ou vendeu caro? */}
              <TableHead className="text-right">Investimento</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const isFlash = enumCode(item.type, PROMOTION_TYPE) === PROMOTION_TYPE.Flash;
              const podeEncerrar = item.situation === "no-ar" || item.situation === "programada";

              return (
                <TableRow key={item.id} className="cursor-pointer hover-elevate" onClick={() => onOpen(item)}>
                  <TableCell className="max-w-[20rem]">
                    <div className="flex items-center gap-2">
                      {item.productGroupImageUrl ? (
                        <ImageHoverZoom
                          src={buildPublicImageUrl(item.productGroupImageUrl)}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                      <span className="truncate font-medium" title={item.productGroupName}>
                        {item.productGroupName}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      {isFlash ? (
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <Tag className="h-3.5 w-3.5" />
                      )}
                      {PROMOTION_TYPE_LABEL[enumCode(item.type, PROMOTION_TYPE) ?? 0] ?? "—"}
                    </span>
                  </TableCell>

                  <TableCell>{formatDiscount(item)}</TableCell>

                  <TableCell className="hidden 2xl:table-cell text-muted-foreground line-through">
                    {formatPriceRange(item.referencePriceMin, item.referencePriceMax)}
                  </TableCell>

                  <TableCell className="font-medium">
                    {formatPriceRange(item.promotionalPriceMin, item.promotionalPriceMax)}
                  </TableCell>

                  <TableCell className="hidden 2xl:table-cell">
                    {item.maxQuantityPerSale == null ? "—" : `${item.maxQuantityPerSale} un`}
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm">
                    {/* Zero aparece como traço: "R$ 0,00" numa promoção que ainda
                        não vendeu parece medida, e é ausência dela. */}
                    {item.investment > 0 ? (
                      formatCurrency(item.investment)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">{formatWindow(item)}</TableCell>

                  <TableCell>
                    <PromotionSituationBadge situation={item.situation} />
                  </TableCell>

                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {podeEncerrar && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isBusy}
                          title="Encerrar agora"
                          onClick={() => setPendente({ acao: "encerrar", item })}
                        >
                          <PowerOff className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Repetir é o fluxo que o dono descreveu: a promoção de
                          sábado que deu certo volta no sábado seguinte. Sem ele, a
                          decisão de repetir vira redigitação — produto, desconto,
                          limite e meta, tudo de novo. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isBusy}
                        title="Repetir promoção"
                        onClick={() => onRepeat(item)}
                      >
                        <CopyPlus className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isBusy}
                        title="Excluir"
                        onClick={() => setPendente({ acao: "excluir", item })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={pendente != null}
        title={pendente?.acao === "encerrar" ? "Encerrar a promoção agora?" : "Excluir a promoção?"}
        itemName={pendente?.item.productGroupName}
        description={
          pendente?.acao === "encerrar"
            ? "O preço volta ao normal agora, e a janela em que a promoção valeu fica registrada para a medição."
            : "A promoção sai da listagem. O preço do produto no cadastro não muda — ele nunca foi alterado."
        }
        confirmLabel={pendente?.acao === "encerrar" ? "Encerrar" : "Excluir"}
        destructive={pendente?.acao === "excluir"}
        loading={isBusy}
        onConfirm={async () => {
          if (!pendente) return;
          // A Promise é devolvida de propósito: o diálogo só fecha quando ela
          // resolve, e permanece aberto se o servidor recusar.
          await (pendente.acao === "encerrar" ? onEnd(pendente.item) : onDelete(pendente.item));
          setPendente(null);
        }}
        onOpenChange={(aberto) => {
          if (!aberto) setPendente(null);
        }}
      />
    </>
  );
}
