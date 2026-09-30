import { Ban, ExternalLink, MoreVertical, RotateCcw, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@workspace/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui";
import type { LowStockScope } from "@workspace/api-client-react";
import type { LowStockItem } from "../types";

type LowStockRowActionsProps = {
  item: LowStockItem;
  scope: LowStockScope;
  /** A linha está gravando: botões desabilitados. */
  mutating: boolean;
  productHref: string;
  onComprar: (item: LowStockItem) => void;
  onDisableStockControl: (item: LowStockItem) => void;
  onEnableStockControl: (item: LowStockItem) => void;
  onInactivate: (item: LowStockItem) => void;
};

/**
 * A célula de ações de uma linha do relatório: o botão principal e o menu.
 *
 * O botão principal depende da aba. Em "Para repor" é **Comprar** — e some
 * quando já há compra em aberto, porque o pedido está feito. Em "Fora do
 * controle" é **Religar**, só para quem foi desligado à mão: o de giro baixo já
 * está com o controle ligado, e sai daqui sozinho quando voltar a vender.
 *
 * Separada da tabela para ela caber no teto de linhas do repositório.
 */
export function LowStockRowActions({
  item,
  scope,
  mutating,
  productHref,
  onComprar,
  onDisableStockControl,
  onEnableStockControl,
  onInactivate,
}: LowStockRowActionsProps) {
  const foraDoControle = scope === "OutOfControl";

  return (
    <div className="flex items-center justify-end gap-1">
      {foraDoControle ? (
        item.stockControlEnabled ? null : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={mutating}
            onClick={() => onEnableStockControl(item)}
            title="Volta a acompanhar o estoque deste produto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Religar
          </Button>
        )
      ) : item.hasOpenPurchase ? (
        <span className="text-xs text-blue-500" title="Já existe pedido de compra deste produto">
          Compra em aberto
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={mutating}
          onClick={() => onComprar(item)}
          title="Abre o pedido de compra deste produto"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Comprar
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Opções de ${item.productName}`}
            disabled={mutating}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={productHref}>
              <ExternalLink className="mr-2 h-4 w-4" /> Abrir produto
            </Link>
          </DropdownMenuItem>
          {item.stockControlEnabled ? (
            <DropdownMenuItem onClick={() => onDisableStockControl(item)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Desligar controle de estoque
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onEnableStockControl(item)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Religar controle de estoque
            </DropdownMenuItem>
          )}
          {/*
            A saída do que esgotou e não se quer repor. Fica por último e em
            âmbar porque é a única que tira o produto da venda.
          */}
          <DropdownMenuItem
            className="text-amber-600 focus:text-amber-600"
            onClick={() => onInactivate(item)}
          >
            <Ban className="mr-2 h-4 w-4" /> Inativar produto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
