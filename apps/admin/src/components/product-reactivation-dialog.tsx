import { PackageCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui";
import type { ReactivatedProductDto } from "@workspace/api-client-react";
import { dismissReactivatedProducts, useReactivatedProducts } from "@/lib/product-reactivation";

/** Os dois status de onde uma entrada reativa; qualquer outro aparece cru. */
const PREVIOUS_STATUS_LABEL: Record<string, string> = {
  Inactive: "Inativo",
  OutOfStock: "Sem estoque",
};

/**
 * O que a volta a Ativo muda para quem compra. "Sem estoque" já era vendido no
 * PDV (`PdvService.SellableStatuses`), então só o Inativo volta ao balcão; o
 * site só mostra Ativo, e é ali que os dois reaparecem.
 */
function describeComeback(products: ReactivatedProductDto[]): string {
  const hadInactive = products.some((product) => product.previousStatus === "Inactive");
  const single = products.length === 1;
  const subject = single ? "O produto" : "Os produtos";

  if (!hadInactive) {
    return `${subject} ${single ? "voltou" : "voltaram"} ao status Ativo e, com o cadastro publicado, ${single ? "volta" : "voltam"} a aparecer no site.`;
  }

  return single
    ? "O produto voltou ao status Ativo: volta a ser vendido no PDV e, com o cadastro publicado, a aparecer no site."
    : "Os produtos voltaram ao status Ativo: os que estavam Inativos voltam a ser vendidos no PDV e, com o cadastro publicado, todos voltam a aparecer no site.";
}

/**
 * "A entrada reativou o produto" — aviso, não pergunta (decisão do dono,
 * 23/09/2026: "apenas para o usuário ficar ciente").
 *
 * Verde, e não âmbar: nada deu errado nem pede ação. É o produto voltando a
 * vender, e o ícone e o título dizem isso também — a cor nunca sozinha.
 *
 * Fica montada na casca do App, fora das telas: o recebimento de compra navega
 * logo depois de gravar, e o aviso tem que sobreviver à troca de tela. O estado
 * mora em `lib/product-reactivation`.
 */
export function ProductReactivationDialog() {
  const products = useReactivatedProducts();
  const single = products.length === 1;

  return (
    <AlertDialog open={products.length > 0} onOpenChange={(open) => !open && dismissReactivatedProducts()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <PackageCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <AlertDialogTitle>
            {single ? "Produto reativado" : `${products.length} produtos reativados`}
          </AlertDialogTitle>
          <AlertDialogDescription>{describeComeback(products)}</AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-1.5 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-3 text-sm">
          {products.map((product) => (
            <li key={product.productId} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 break-words font-medium text-foreground">{product.productName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                era {PREVIOUS_STATUS_LABEL[product.previousStatus] ?? product.previousStatus}
              </span>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogAction type="button">Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
