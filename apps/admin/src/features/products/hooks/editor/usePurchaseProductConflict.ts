import { useState } from "react";
import { useLocation } from "wouter";
// Cruza a fronteira da feature de propósito, como `useProductDetailFromUrl` já
// faz: `purchases-route.ts` existe justamente para o caminho da compra ser UMA
// string no repositório. Repeti-la aqui é o que diverge no primeiro rename.
import { purchaseDetailPath } from "@/features/purchases/purchases-route";
import type { BarcodeMatch } from "./useBarcodeLookup";

/**
 * O código bipado num cadastro vindo de compra já pertence a um produto.
 *
 * Guarda os dois lados porque a modal mostra os dois: o que o catálogo já tem e
 * o que a compra achava que estava comprando.
 */
export type PurchaseProductConflict = BarcodeMatch & {
  /** Como a COMPRA chama o que está sendo recebido. */
  purchaseName: string;
  /** A compra a ajustar — é ela que a modal abre ao confirmar. */
  purchaseId: number;
};

type UsePurchaseProductConflictParams = {
  /**
   * Apaga o código de barras do formulário.
   *
   * Chamado no "Corrigir o código": deixar o código duplicado no campo só
   * adiaria a recusa para o salvar, e o leitor de código ACRESCENTA ao que já
   * está lá — o bipe seguinte viraria dois códigos emendados.
   */
  limparCodigo: () => void;
};

/**
 * A modal que impede o cadastro duplicado nascido de uma compra.
 *
 * O caminho de recebimento de produto NOVO (`/produtos?compra=<id>`) abre um
 * cadastro em branco preenchido pela compra. Se o código bipado ali já for de um
 * produto do catálogo, seguir em frente criaria um SEGUNDO cadastro do mesmo
 * item — com o estoque dividido entre os dois, duas etiquetas e duas linhas na
 * vitrine. Quem sabe disso é o `useBarcodeLookup`; quem decide o que fazer é
 * esta modal.
 *
 * O conserto não é aqui, e é por isso que ela leva embora: a compra é que está
 * dizendo "produto novo". Ajustado o vínculo lá, o recebimento vira o caminho de
 * produto já cadastrado — o que grava a entrada direto, sem passar por esta tela.
 *
 * A navegação mora no hook, e não no componente, pelo mesmo motivo que a de
 * `usePurchases`: a tela renderiza o que o hook decide.
 */
export function usePurchaseProductConflict({ limparCodigo }: UsePurchaseProductConflictParams) {
  const [, navigate] = useLocation();
  const [conflict, setConflict] = useState<PurchaseProductConflict | null>(null);

  /** Chamado pelo `useBarcodeLookup` quando o código já tem dono. */
  function reportConflict(conflito: PurchaseProductConflict) {
    setConflict(conflito);
  }

  /**
   * "Ajustar a compra": vai para a tela de Compras com a modal desta compra
   * aberta (`/estoque/compras?compra=<id>`).
   *
   * Sem fechar o detalhe antes: a navegação desmonta a página inteira, e um
   * `setDetailOpen(false)` no mesmo tick faria o `useProductDetailHistory`
   * disparar um `history.back()` correndo com o `pushState` do wouter.
   */
  function goToPurchase() {
    if (conflict === null) return;
    const destino = purchaseDetailPath(conflict.purchaseId);
    setConflict(null);
    navigate(destino);
  }

  /** "Corrigir o código": fica na tela, com o campo limpo para bipar de novo. */
  function dismissConflict() {
    setConflict(null);
    limparCodigo();
  }

  /** Fechar a tela esquece o conflito, como esquece o contexto da compra. */
  function clearConflict() {
    setConflict(null);
  }

  return { conflict, reportConflict, goToPurchase, dismissConflict, clearConflict };
}
