import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui";
import type { PurchaseProductConflict } from "../../hooks/editor/usePurchaseProductConflict";

type PurchaseProductConflictDialogProps = {
  /** O conflito, ou nada quando não há nenhum — é ele que abre a modal. */
  conflict: PurchaseProductConflict | null | undefined;
  /** "Ajustar a compra": leva à tela de Compras com esta compra aberta. */
  onGoToPurchase: () => void;
  /** "Corrigir o código": fica na tela, com o campo limpo. */
  onDismiss: () => void;
};

/**
 * O código bipado num cadastro vindo de compra já pertence a um produto.
 *
 * É âmbar, e não vermelho: nada foi perdido nem está sendo excluído — o
 * cadastro está sendo interrompido ANTES de criar a duplicata. Vermelho aqui
 * gastaria a cor que no admin significa "resolva agora, isto é destrutivo".
 *
 * A modal nomeia os dois lados de propósito. "Este produto já existe" sozinho
 * obrigaria o operador a adivinhar QUAL produto é, e é justamente esse nome que
 * ele vai procurar no seletor da tela de Compras um clique depois.
 *
 * Duas saídas, porque há dois motivos para o código já ter dono: o item é mesmo
 * o que já está cadastrado (e a compra é que está errada, dizendo "produto
 * novo"), ou o bipe pegou a caixa errada. A primeira leva à compra; a segunda
 * limpa o campo e fica.
 */
export function PurchaseProductConflictDialog({
  conflict,
  onGoToPurchase,
  onDismiss,
}: PurchaseProductConflictDialogProps) {
  return (
    // `!= null` frouxo de propósito: ausente e nulo são a mesma coisa aqui, e
    // `!== null` abriria a modal vazia para quem passasse `undefined`.
    <AlertDialog open={conflict != null} onOpenChange={(aberto) => !aberto && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <AlertDialogTitle>Este código já tem produto cadastrado</AlertDialogTitle>
          <AlertDialogDescription>
            Continuar criaria um segundo cadastro do mesmo item, com o estoque dividido entre os dois.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {conflict && (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-3 text-sm">
            <p className="leading-relaxed">
              O código <span className="font-mono font-medium text-foreground">{conflict.barcode}</span> é de{" "}
              <span className="font-medium text-foreground">{conflict.productName}</span>.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              A compra de <span className="font-medium text-foreground">{conflict.purchaseName}</span> está
              registrada como <span className="font-medium text-foreground">produto novo</span>. Ajuste-a para
              apontar para o produto que já existe e lance o recebimento de novo — ele vai direto para a aba
              Estoque do produto, sem passar por este cadastro.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel type="button">Corrigir o código</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onGoToPurchase}>
            Ajustar a compra
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
