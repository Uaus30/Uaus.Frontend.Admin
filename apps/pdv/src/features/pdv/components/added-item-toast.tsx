import { ImageIcon } from "lucide-react";
import { buildPublicImageUrl } from "@workspace/api-client-react";

type AddedItemToastProps = {
  name: string;
  /** Caminho da imagem principal, como a busca devolve. Nulo mostra o ícone. */
  imageUrl?: string | null;
};

/**
 * Corpo do aviso de item adicionado ao carrinho.
 *
 * A miniatura existe porque o operador raramente olha para o carrinho no
 * momento do bipe — ele olha para o produto na mão. A imagem é a conferência
 * mais rápida de que o código bipado é o item certo; o nome, sozinho, exige
 * leitura, e no balcão cheio ninguém lê.
 *
 * Vem do resultado da busca (`imageUrl`), sem requisição nova: é o mesmo dado
 * que a lista já usa na miniatura dela.
 */
export function AddedItemToast({ name, imageUrl }: AddedItemToastProps) {
  return (
    <span className="flex items-center gap-2">
      {imageUrl ? (
        <img
          loading="lazy"
          decoding="async"
          src={buildPublicImageUrl(imageUrl)}
          alt=""
          className="h-10 w-10 shrink-0 rounded-md border border-border/40 object-cover"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/50">
          <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
        </span>
      )}
      <span className="min-w-0 leading-tight">{name}</span>
    </span>
  );
}
