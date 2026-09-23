import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { enumCode, PRODUCT_STATUS, setProductGroupShowOnSite } from "@workspace/api-client-react";
import { CATALOG_KEYS, RESOURCE_KEYS } from "@/hooks/use-catalog";
import type { ProductTableRow } from "../types";

/** Alguma variação Ativa — sem ela, a vitrine não mostra o grupo (`StorefrontService`). */
function hasActiveVariation(row: ProductTableRow): boolean {
  const ativo = (status: ProductTableRow["status"]) =>
    enumCode(status, PRODUCT_STATUS) === PRODUCT_STATUS.Active;
  return ativo(row.status) || row.variations.some((variation) => ativo(variation.status));
}

/**
 * A primeira foto pela lupa só pergunta quando o cadastro não tinha foto, está
 * fora do site E tem variação Ativa. Sem esta última, o "sim" ligaria o
 * interruptor de um produto que a vitrine não mostra, e o aviso "publicado no
 * site" mentiria.
 */
export function shouldAskSiteAfterListPhoto(row: ProductTableRow): boolean {
  return row.images.length === 0 && !row.productGroup.showOnSite && hasActiveVariation(row);
}

/**
 * A pergunta da primeira foto na LISTAGEM de produtos (decisão do dono,
 * 23/09/2026) — a mesma do editor (`useFirstPhotoSitePrompt`), para o outro
 * caminho que põe foto: a lupa da linha, que grava a imagem direto no servidor.
 *
 * Aqui não há "próximo Salvar": o "sim" liga o "Exibir no site" na hora, pela
 * rota própria (`setProductGroupShowOnSite`). Regravar o grupo inteiro com a
 * cópia que a linha tem na memória desfaria a edição que outra pessoa tivesse
 * feito no meio tempo.
 *
 * Quem chama é a página, depois de a foto ser gravada: `offerFor` recebe a linha
 * como estava ANTES da foto, que é o que diz se esta era a primeira.
 */
export function useListFirstPhotoSitePrompt() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [row, setRow] = useState<ProductTableRow | null>(null);

  const mutation = useMutation({
    mutationFn: (target: ProductTableRow) => setProductGroupShowOnSite(target.productGroupId, true),
    onSuccess: async (_, target) => {
      setRow(null);
      // O catálogo de grupos junto: é dele que o detalhe aberto por link lê o
      // "Exibir no site". Velho, ele mostraria o interruptor desligado, e o
      // próximo Salvar tiraria o produto do site sem ninguém perceber.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
        queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productGroups }),
      ]);
      toast({
        title: "Produto publicado no site",
        description: `${target.name} passa a aparecer na vitrine.`,
      });
    },
    onError: (error: unknown) =>
      toast({
        title: 'Não foi possível ligar o "Exibir no site"',
        description: describeApiError(error, "Ligue pela aba Opcionais do cadastro."),
        error,
        variant: "destructive",
      }),
  });

  return {
    open: row !== null,
    isPublishing: mutation.isPending,
    /** Pergunta, se a foto recém-gravada foi a primeira de um cadastro fora do site. */
    offerFor(previous: ProductTableRow) {
      if (shouldAskSiteAfterListPhoto(previous)) setRow(previous);
    },
    publish() {
      if (row) mutation.mutate(row);
    },
    dismiss() {
      setRow(null);
    },
  };
}
