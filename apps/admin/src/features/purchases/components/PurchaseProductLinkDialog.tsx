import { Images, Link2, Tag } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@workspace/ui";
import type { ProductSearchOption } from "@/components/product-search-picker";

type PurchaseProductLinkDialogProps = {
  /** O produto escolhido, à espera da resposta. Ausente ou nulo fecha a modal. */
  product: ProductSearchOption | null | undefined;
  /** O nome digitado nesta compra, antes do vínculo. */
  purchaseName: string;
  /** Quantas fotos o formulário tem agora. Zero tira a escolha da tela. */
  imageCount: number;
  /** "Usar as fotos do produto": a galeria do cadastro passa a valer aqui. */
  onUseProductGallery: () => void;
  /** "Manter as fotos desta compra": elas substituem a do produto ao salvar. */
  onKeepPurchaseImages: () => void;
  /** Fecha sem vincular. */
  onCancel: () => void;
};

/**
 * O que acontece com nome e fotos ao vincular a compra a um produto que já existe.
 *
 * Só aparece quando há o que substituir — nome digitado diferente do catálogo ou
 * foto anexada aqui (`purchaseDataWouldBeReplaced`). Antes disso, escolher o
 * produto trocava as duas coisas em silêncio: quem tinha anotado a compra de um
 * produto novo, subido três fotos do anúncio do fornecedor e só depois
 * descoberto que o item já estava cadastrado via o trabalho sumir sem aviso.
 *
 * ## Por que o NOME não é escolha e a FOTO é
 *
 * Nome de compra vinculada é sempre o do catálogo — a modal nem mostra o campo,
 * e o backend regrava `purchases.product_name` a partir do produto de qualquer
 * jeito. Duas grafias do mesmo item confundiriam mais do que ajudam, e essa
 * decisão é de 13/09/2026. Aqui ele é só informado, para o operador não procurar
 * depois pelo nome que digitou.
 *
 * A foto tem duas respostas legítimas porque a galeria da compra e a do produto
 * são A MESMA LISTA (também 13/09/2026): a foto do anúncio pode ser melhor que a
 * que o catálogo tem, e pode ser pior. Quem sabe é quem está olhando para as duas.
 *
 * ## Por que o texto diz "substituem", e não "adicionam"
 *
 * Porque é o que acontece: salvar a compra deixa a galeria do grupo IGUAL à
 * lista daqui (`SyncGroupImagesAsync`), então manter as fotos da compra tira as
 * do produto. Escrever "manter" sem dizer isso seria a versão simpática de uma
 * perda silenciosa — que é justamente o que esta modal existe para acabar.
 */
export function PurchaseProductLinkDialog({
  product,
  purchaseName,
  imageCount,
  onUseProductGallery,
  onKeepPurchaseImages,
  onCancel,
}: PurchaseProductLinkDialogProps) {
  const nomeMuda = product != null && purchaseName.trim().toUpperCase() !== product.name.trim().toUpperCase();
  const temFotos = imageCount > 0;
  const fotos = `${imageCount} ${imageCount === 1 ? "foto" : "fotos"}`;

  return (
    // `!= null` frouxo de propósito: ausente e nulo são a mesma coisa aqui, e
    // `!== null` abriria a modal vazia para quem passasse `undefined`.
    <AlertDialog open={product != null} onOpenChange={(aberto) => !aberto && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular ao produto já cadastrado
          </AlertDialogTitle>
          <AlertDialogDescription>
            {product?.name} já está no catálogo. Parte do que você preencheu nesta compra passa a vir do
            cadastro dele.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {nomeMuda && product && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-3 text-sm">
              <Tag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="leading-relaxed text-muted-foreground">
                A compra passa a se chamar <span className="font-medium text-foreground">{product.name}</span>
                . <span className="font-medium text-foreground">{purchaseName.trim()}</span>, digitado aqui,
                não fica gravado — compra com produto vinculado usa sempre o nome do catálogo.
              </p>
            </div>
          )}

          {temFotos && product && (
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 px-0.5 text-sm">
                <Images className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed text-muted-foreground">
                  As fotos da compra e as do produto são a{" "}
                  <span className="font-medium text-foreground">mesma lista</span>. Qual delas vale?
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={onUseProductGallery}
                className="h-auto w-full flex-col items-start gap-1 whitespace-normal px-3.5 py-3 text-left"
              >
                <span className="text-sm font-semibold text-foreground">Usar as fotos do produto</span>
                <span className="text-xs font-normal leading-relaxed text-muted-foreground">
                  A compra passa a mostrar a galeria de {product.name}. As {fotos} que estão aqui saem da
                  compra — o produto continua com as dele.
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onKeepPurchaseImages}
                className="h-auto w-full flex-col items-start gap-1 whitespace-normal px-3.5 py-3 text-left"
              >
                <span className="text-sm font-semibold text-foreground">Manter as {fotos} desta compra</span>
                <span className="text-xs font-normal leading-relaxed text-muted-foreground">
                  Elas <span className="font-medium text-amber-500">substituem</span> a galeria de{" "}
                  {product.name} quando você salvar a compra.
                </span>
              </Button>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel type="button">Não vincular</AlertDialogCancel>
          {/* Sem foto não há escolha a fazer: o aviso do nome precisa só de um
              "ok", e dois botões de resposta inventariam uma decisão. */}
          {!temFotos && (
            <Button type="button" onClick={onUseProductGallery}>
              Vincular
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
