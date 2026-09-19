import {
  Alert,
  AlertDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui";
import { formatCurrency, marginBand } from "@workspace/core";
import { AlertTriangle, Info, TrendingDown } from "lucide-react";
import type { PromotionPreviewDto } from "../types";

/**
 * Cor da margem — verde ≥ 40%, âmbar de 30% a 40%, vermelho abaixo.
 *
 * Vem de `marginBand` do `packages/core`, e não de um corte próprio desta tela:
 * a faixa de margem já é vocabulário da loja, e um segundo corte aqui faria o
 * mesmo produto sair âmbar na entrada de estoque e verde na promoção.
 */
function marginClass(margin: number | null | undefined): string {
  const band = marginBand(margin ?? null);

  if (band === "healthy") return "text-emerald-600 dark:text-emerald-400";
  if (band === "tight") return "text-amber-600 dark:text-amber-400";
  if (band === "low") return "text-destructive";
  return "text-muted-foreground";
}

/** Margem em texto. Nula é "—", nunca "0%": desconhecida não é zero. */
function formatMargin(margin: number | null | undefined): string {
  return margin == null ? "—" : `${margin.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

interface PromotionPricePanelProps {
  preview?: PromotionPreviewDto;
  isLoading: boolean;
  /** Meta digitada, só para a frase do investimento fazer sentido. */
  targetQuantity: string;
}

/**
 * O efeito da promoção antes de ela existir: preço, custo, margem e investimento.
 *
 * Os números vêm do **servidor** (`/Promotions/preview`), e é a mesma conta que
 * vai decidir o preço no carrinho. Refazê-la aqui pouparia uma requisição e
 * criaria a divergência clássica — a tela prometendo um número que o balcão não
 * pratica.
 */
export function PromotionPricePanel({ preview, isLoading, targetQuantity }: PromotionPricePanelProps) {
  if (isLoading && !preview) {
    return <p className="text-sm text-muted-foreground">Calculando o efeito da promoção...</p>;
  }

  if (!preview) {
    return (
      <p className="text-sm text-muted-foreground">
        Escolha o produto e o desconto para ver preço, margem e investimento.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {preview.hasNoActiveVariations && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Este produto não tem nenhuma variação ativa. A promoção pode ser cadastrada, mas não vai aparecer
            no balcão nem no site enquanto ele não voltar.
          </AlertDescription>
        </Alert>
      )}

      {preview.hasMixedPrices && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            As variações custam de {formatCurrency(preview.referencePriceMin)} a{" "}
            {formatCurrency(preview.referencePriceMax)}. Com preço final, todas passam a custar o mesmo.
          </AlertDescription>
        </Alert>
      )}

      {preview.hasPriceBelowCost && (
        <Alert variant="destructive">
          <TrendingDown className="h-4 w-4" />
          <AlertDescription>
            Alguma variação fica <strong>abaixo do custo</strong>. É uma decisão possível — a isca da porta é
            assim —, mas confira antes de salvar.
          </AlertDescription>
        </Alert>
      )}

      {!preview.hasPriceBelowCost && preview.hasTightMargin && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>A margem fica abaixo de 30%, que é o corte apertado da loja.</AlertDescription>
        </Alert>
      )}

      {preview.projectedInvestment != null && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Investimento projetado</p>
          <p className="text-2xl font-display font-bold">{formatCurrency(preview.projectedInvestment)}</p>
          <p className="text-xs text-muted-foreground">
            É quanto a loja deixa de faturar vendendo as {targetQuantity} unidades da meta neste preço. Não é
            prejuízo — é o que a promoção custa para acontecer.
          </p>
        </div>
      )}

      {preview.variations.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Variação</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                {/* Custo e Estoque saem primeiro em tela estreita: são contexto,
                    enquanto preço, promocional e margem são a decisão. A regra é
                    esconder coluna, nunca rolar — `convencoes-de-interface.md`. */}
                <TableHead className="hidden text-right 2xl:table-cell">Custo</TableHead>
                <TableHead className="text-right">Promocional</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="hidden text-right 2xl:table-cell">Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.variations.map((variation) => (
                <TableRow key={variation.productId}>
                  <TableCell className="max-w-[14rem] truncate" title={variation.name}>
                    {variation.name}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground line-through">
                    {formatCurrency(variation.price)}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground 2xl:table-cell">
                    {formatCurrency(variation.costPrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(variation.promotionalPrice)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${marginClass(variation.marginPercent)}`}>
                    {formatMargin(variation.marginPercent)}
                  </TableCell>
                  <TableCell className="hidden text-right 2xl:table-cell">{variation.stock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
