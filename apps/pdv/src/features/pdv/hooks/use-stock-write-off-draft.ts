import { useCallback, useRef, useState } from "react";
import {
  STOCK_WRITE_OFF_REASON,
  STOCK_WRITE_OFF_REASON_LABEL,
  type ProductPdvSearchDto,
} from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import { useToast } from "@workspace/ui";
import { useOfflinePdv } from "@/hooks/use-offline-pdv";
import {
  addDraftItem,
  findDraftShortages,
  removeDraftItem,
  setDraftQuantity,
  toWriteOffItems,
  type WriteOffDraftItem,
} from "@/lib/write-off-draft";
import { LocalStockError, newClientReference } from "@/services/sales.service";
import { registerWriteOff } from "@/services/stock-write-off.service";
import { useProductSearch } from "./use-product-search";

export interface UseStockWriteOffDraftParams {
  /** O diálogo está aberto. Desliga a busca automática quando fechado. */
  open: boolean;
  /** Fecha o diálogo — chamado pelo hook depois de gravar a baixa. */
  onOpenChange: (open: boolean) => void;
  /** Chamado depois de uma baixa gravada no servidor (não na fila offline). */
  onRegistered?: () => void | Promise<void>;
}

/**
 * Rascunho da baixa de estoque: motivo, lista de produtos, observação e a
 * gravação.
 *
 * ## Por que a conferência acontece aqui
 *
 * O backend recusa baixa acima do saldo. Offline essa recusa só apareceria na
 * sincronização — horas depois, quando ninguém mais lembra o que foi jogado
 * fora. Por isso a lista carrega o saldo conhecido de cada produto e o botão de
 * confirmar fica travado enquanto houver falta.
 *
 * ## Por que o rascunho morre ao fechar
 *
 * Reabrir o diálogo com a lista da vez anterior faria o operador baixar duas
 * vezes o mesmo produto sem perceber. A limpeza mora no fechamento — e não num
 * efeito — porque esse é o único caminho de saída, inclusive Esc e clique fora.
 */
export function useStockWriteOffDraft({ open, onOpenChange, onRegistered }: UseStockWriteOffDraftParams) {
  const { toast } = useToast();
  // Sem sessão: a baixa não pertence a turno nenhum, e passar uma sessão aqui só
  // acionaria o download de snapshot que é responsabilidade da tela principal.
  const { online, hasLocalDatabase, refreshCounts } = useOfflinePdv(null);

  const [reason, setReason] = useState<number>(STOCK_WRITE_OFF_REASON.Consumption);
  const [items, setItems] = useState<WriteOffDraftItem[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  /**
   * Chave de idempotência da baixa em andamento, gerada na primeira tentativa e
   * reutilizada nas retentativas do mesmo rascunho.
   *
   * Igual à venda: se o POST chegou ao servidor mas a resposta voltou como erro
   * (504 do proxy), o clique seguinte em "Confirmar" reenvia a MESMA chave e o
   * servidor devolve a baixa já gravada em vez de baixar o estoque duas vezes.
   * Descartada quando a baixa confirma ou o rascunho é abandonado.
   */
  const writeOffReferenceRef = useRef<string | null>(null);

  const shortages = findDraftShortages(items);

  const search = useProductSearch({
    online,
    // O termo sobrevive ao fechamento; sem isso uma busca dispararia para uma
    // tela que ninguém está olhando.
    enabled: open,
    // O operador bipa o produto quebrado e ele já entra na lista.
    onExactBarcodeMatch: (product) => setItems((current) => addDraftItem(current, product)),
  });

  const { clear: clearSearch } = search;

  /** Acrescenta o produto à lista e limpa a busca. */
  const pickProduct = useCallback(
    (product: ProductPdvSearchDto) => {
      setItems((current) => addDraftItem(current, product));
      clearSearch();
    },
    [clearSearch],
  );

  /** Troca a quantidade de um item; o piso de 1 fica em `lib/write-off-draft.ts`. */
  const changeQuantity = useCallback((productId: number, quantity: number) => {
    setItems((current) => setDraftQuantity(current, productId, quantity));
  }, []);

  /** Tira o produto da baixa. */
  const removeItem = useCallback((productId: number) => {
    setItems((current) => removeDraftItem(current, productId));
  }, []);

  /** Abre e fecha o diálogo, descartando o rascunho na saída. */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setReason(STOCK_WRITE_OFF_REASON.Consumption);
        setItems([]);
        setNotes("");
        clearSearch();
        // O rascunho morreu; a chave morre com ele.
        writeOffReferenceRef.current = null;
      }

      onOpenChange(next);
    },
    [clearSearch, onOpenChange],
  );

  /** Grava a baixa: no servidor com conexão, na fila local sem ela. */
  const confirm = useCallback(async () => {
    if (items.length === 0) {
      toast({ title: "Nenhum produto na lista", variant: "destructive" });
      return;
    }

    if (shortages.length > 0) {
      toast({
        title: "Quantidade acima do estoque",
        description: shortages
          .map((item) => `${item.name}: pedido ${item.quantity}, disponível ${item.availableStock}`)
          .join(" · "),
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    if (!online && !hasLocalDatabase) {
      toast({
        title: "Base local indisponível",
        description:
          "O PDV nunca baixou a base local neste navegador e não pode registrar a baixa offline. Aguarde a conexão voltar.",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    setSaving(true);
    try {
      // A chave é do rascunho, não da tentativa: reutilizada num reenvio após
      // erro de gateway para o servidor reconhecer a baixa já gravada.
      writeOffReferenceRef.current ??= newClientReference();

      const saved = await registerWriteOff(
        { reason, items: toWriteOffItems(items), notes },
        { offline: !online, clientReference: writeOffReferenceRef.current },
      );

      await refreshCounts();
      // Uma baixa que ficou na fila não mudou nada no servidor; recarregar dali
      // só geraria requisição condenada a falhar.
      if (!saved.offline) await onRegistered?.();

      toast({
        title: saved.offline ? "Baixa registrada offline" : "Baixa registrada",
        description: saved.offline
          ? `${saved.totalQuantity} unidade(s) baixadas por ${STOCK_WRITE_OFF_REASON_LABEL[reason]}. Sobe para o servidor quando a conexão voltar.`
          : `${saved.totalQuantity} unidade(s) baixadas por ${STOCK_WRITE_OFF_REASON_LABEL[reason]}.`,
        duration: saved.offline ? 6000 : 3000,
        className: saved.offline
          ? "bg-amber-500 text-amber-950 border-none"
          : "bg-emerald-500 text-white border-none",
      });

      handleOpenChange(false);
    } catch (error) {
      // A conferência da base local recusou. A mesma regra vale no servidor, e
      // deixar passar só adiaria o "não" para a sincronização.
      if (error instanceof LocalStockError) {
        toast({
          title: "Estoque insuficiente na base local",
          description: error.shortages
            .map((item) => `${item.productName}: pedido ${item.requested}, disponível ${item.available}`)
            .join(" · "),
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      toast({
        title: "Não foi possível registrar a baixa",
        description: describeApiError(error),
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setSaving(false);
    }
  }, [
    handleOpenChange,
    hasLocalDatabase,
    items,
    notes,
    onRegistered,
    online,
    reason,
    refreshCounts,
    shortages,
    toast,
  ]);

  return {
    online,
    reason,
    setReason,
    items,
    notes,
    setNotes,
    saving,
    /** Itens cuja quantidade não cabe no saldo conhecido. */
    shortages,
    search,
    pickProduct,
    changeQuantity,
    removeItem,
    handleOpenChange,
    confirm,
  };
}
