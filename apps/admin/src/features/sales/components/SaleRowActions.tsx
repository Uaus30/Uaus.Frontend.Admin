import React from "react";
import { Eye, Loader2, MoreVertical, Printer, Trash2 } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui";

type SaleRowActionsProps = {
  saleId: number;
  printing: boolean;
  deleting: boolean;
  onView: () => void;
  onPrint: () => void;
  onDelete: () => void;
};

/** Para o clique no botão não chegar à linha, que também abre a venda. */
function stop(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/**
 * As ações da linha de Vendas: três ícones no computador, um menu ⋮ no celular.
 *
 * Os três ícones de 32px, colados (a lixeira a 8px da impressora), ficavam além
 * da borda direita da tela no celular, e o "Reimprimir" só se explicava no
 * `title`. Abaixo do `lg` um botão só, de 40px, abre o menu com os nomes por
 * extenso — e tocar na linha já abre a venda.
 */
export function SaleRowActions({
  saleId,
  printing,
  deleting,
  onView,
  onPrint,
  onDelete,
}: SaleRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2" onClick={stop} onKeyDown={stop}>
      <div className="hidden items-center gap-2 lg:flex">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Ver a venda ${saleId}`}
          className="h-8 w-8 text-muted-foreground hover-elevate hover:text-primary"
          onClick={onView}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Reimprimir o cupom da venda ${saleId}`}
          className="h-8 w-8 text-muted-foreground hover-elevate hover:text-primary"
          onClick={onPrint}
          disabled={printing}
          title="Reimprimir cupom"
        >
          {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Remover a venda ${saleId}`}
          className="h-8 w-8 text-muted-foreground hover-elevate hover:text-destructive"
          onClick={onDelete}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Opções da venda ${saleId}`}
            className="h-10 w-10 text-muted-foreground lg:hidden"
          >
            {printing || deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" /> Ver a venda
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPrint} disabled={printing}>
            <Printer className="mr-2 h-4 w-4" /> Reimprimir cupom
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Remover venda
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
