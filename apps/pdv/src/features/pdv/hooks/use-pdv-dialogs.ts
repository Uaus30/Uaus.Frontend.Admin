import { useCallback, useMemo, useState } from "react";

/** Um diálogo do PDV: se está aberto e como abrir/fechar. */
export interface DialogControl {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Abre o diálogo — é o que os itens do menu chamam. */
  show: () => void;
}

function useDialogControl(): DialogControl {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return useMemo(() => ({ open, setOpen, show }), [open, show]);
}

/**
 * Os diálogos do PDV, cada um com o próprio estado de aberto.
 *
 * Continuam **independentes** entre si, e não um único "qual diálogo está
 * aberto": o fechamento de caixa é acionado por um caminho que pode ter outro
 * diálogo por baixo, e trocar isso por um estado único mudaria em silêncio qual
 * tela reaparece ao fechar.
 *
 * O que este hook resolve é a tela: seis `useState` soltos no meio do PDV, sem
 * nada dizendo que são a mesma família.
 */
export function usePdvDialogs() {
  return {
    /** Desconto sobre o total da venda. */
    discount: useDialogControl(),
    salesHistory: useDialogControl(),
    heldSales: useDialogControl(),
    stockWriteOff: useDialogControl(),
    performance: useDialogControl(),
    preferences: useDialogControl(),
    about: useDialogControl(),
  };
}


export type PdvDialogs = ReturnType<typeof usePdvDialogs>;
