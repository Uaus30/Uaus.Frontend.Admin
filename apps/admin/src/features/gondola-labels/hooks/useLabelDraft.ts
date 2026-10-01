import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProductLabelDraft,
  saveProductLabelDraft,
  type SaveProductLabelDraftPayload,
} from "@workspace/api-client-react";
import { fromDraftDto, isEmptyDraftPayload, type LoadedLabelDraft } from "../draft";

/**
 * Espera entre a última alteração e o salvamento automático.
 *
 * Curta o bastante para a lista estar salva quando a pessoa bloqueia o celular
 * e anda até a próxima prateleira; longa o bastante para digitar um preço
 * inteiro sem uma gravação por tecla. Ao esconder a página o salvamento é
 * imediato, então a espera não é janela de perda.
 */
export const DRAFT_AUTOSAVE_DELAY_MS = 800;

/** Situação da leitura do rascunho, ao abrir a tela. */
export type DraftLoadState = "loading" | "ready" | "failed";

/** Situação do salvamento automático, para o aviso da tela. */
export type DraftSaveState = "idle" | "saving" | "saved" | "error";

export interface LabelDraftSync {
  loadState: DraftLoadState;
  saveState: DraftSaveState;
  /** Horário (deste aparelho) da última gravação bem-sucedida. */
  savedAt: Date | null;
  /** Agenda a gravação da lista inteira. Lista vazia grava (apaga) na hora. */
  schedule: (payload: SaveProductLabelDraftPayload) => void;
  /** Grava agora o que estiver pendente e espera a fila terminar. Nunca lança. */
  flush: () => Promise<void>;
  /**
   * Marca o início da impressão; devolve o número da última alteração local,
   * a entregar ao {@link LabelDraftSync.markPrinted}.
   */
  beginPrint: () => number;
  /**
   * Avisa que a lista foi impressa: o servidor já apagou o rascunho. Alteração
   * feita DURANTE a impressão (depois do `beginPrint`) continua agendada — ela é
   * a lista nova de quem continuou mexendo.
   */
  markPrinted: (changeAtPrint: number) => void;
  /** Tenta ler o rascunho de novo depois de uma falha. */
  retryLoad: () => void;
}

/**
 * Rascunho da lista de etiquetas no servidor: lê ao abrir, salva sozinho a cada
 * alteração e relê quando a pessoa volta para a tela.
 *
 * **Por que no servidor e não no navegador:** a lista é montada no celular,
 * andando pela loja, e impressa no computador. O rascunho é um por usuário —
 * os dois aparelhos precisam estar com o mesmo login.
 *
 * **As gravações saem em fila**, uma de cada vez. Duas em paralelo podiam
 * chegar fora de ordem, e a lista antiga sobrescreveria a nova.
 *
 * **Reler ao voltar para a tela** (foco da janela ou página visível de novo) é o
 * que faz o computador, aberto desde ontem, mostrar o que acabou de ser
 * adicionado no celular. Só acontece sem alteração local pendente: o que a
 * pessoa acabou de digitar nunca é trocado pelo que veio do servidor. Depois de
 * imprimir AQUI, um rascunho ausente no servidor não esvazia a tela — imprimir
 * apaga o rascunho, mas a lista fica para reimprimir (regra de 21/09/2026), e a
 * caixa de impressão sozinha já tira e devolve o foco da janela.
 *
 * @param onLoaded Remonta a lista da tela. Chamado na abertura e nas releituras.
 */
export function useLabelDraft(onLoaded: (draft: LoadedLabelDraft) => void): LabelDraftSync {
  const [loadState, setLoadState] = useState<DraftLoadState>("loading");
  const [saveState, setSaveState] = useState<DraftSaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const pendingRef = useRef<SaveProductLabelDraftPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  /** Há alteração local que ainda não chegou ao servidor (agendada ou em voo). */
  const dirtyRef = useRef(false);
  /**
   * Conta as alterações locais. A releitura compara o valor da saída com o da
   * chegada: o `dirtyRef` sozinho não basta, porque a gravação pode terminar
   * ENQUANTO a releitura está no caminho — e a resposta, anterior à alteração,
   * apagaria da tela o produto que acabou de entrar.
   */
  const changeCountRef = useRef(0);
  const printedHereRef = useRef(false);
  const readyRef = useRef(false);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const save = useCallback(async (payload: SaveProductLabelDraftPayload) => {
    setSaveState("saving");
    try {
      await saveProductLabelDraft(payload);
      setSavedAt(new Date());
      if (pendingRef.current === null) {
        dirtyRef.current = false;
        setSaveState("saved");
      }
    } catch (error) {
      console.error("Erro ao salvar o rascunho de etiquetas:", error);
      // A lista que falhou volta para a fila, a menos que já exista uma mais
      // nova: a próxima alteração (ou o "Tentar de novo") manda a mais recente.
      pendingRef.current ??= payload;
      setSaveState("error");
    }
  }, []);

  const flush = useCallback((): Promise<void> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const payload = pendingRef.current;
    if (payload !== null) {
      pendingRef.current = null;
      queueRef.current = queueRef.current.then(() => save(payload));
    }
    return queueRef.current;
  }, [save]);

  const schedule = useCallback(
    (payload: SaveProductLabelDraftPayload) => {
      // Antes de ler o rascunho, gravar sobrescreveria o que está no servidor
      // com uma lista que a tela ainda nem mostrou.
      if (!readyRef.current) return;

      pendingRef.current = payload;
      dirtyRef.current = true;
      changeCountRef.current += 1;
      printedHereRef.current = false;

      if (timerRef.current !== null) clearTimeout(timerRef.current);
      // Limpar grava na hora: quem limpa e fecha a aba não pode reencontrar a
      // lista velha amanhã.
      if (isEmptyDraftPayload(payload)) {
        void flush();
        return;
      }
      timerRef.current = setTimeout(() => void flush(), DRAFT_AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  const beginPrint = useCallback(() => changeCountRef.current, []);

  const markPrinted = useCallback((changeAtPrint: number) => {
    if (changeCountRef.current !== changeAtPrint) return;
    printedHereRef.current = true;
    dirtyRef.current = false;
    pendingRef.current = null;
    setSaveState("idle");
  }, []);

  const retryLoad = useCallback(() => {
    setLoadState("loading");
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  // Leitura ao abrir (e a cada "Tentar de novo").
  useEffect(() => {
    let cancelled = false;
    getProductLabelDraft().then(
      (dto) => {
        if (cancelled) return;
        onLoadedRef.current(fromDraftDto(dto));
        readyRef.current = true;
        setLoadState("ready");
      },
      (error: unknown) => {
        if (cancelled) return;
        console.error("Erro ao abrir o rascunho de etiquetas:", error);
        setLoadState("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  // Releitura ao voltar para a tela; gravação imediata ao sair dela.
  useEffect(() => {
    let generation = 0;

    const refresh = () => {
      if (!readyRef.current || dirtyRef.current) return;
      const current = ++generation;
      const changesAtStart = changeCountRef.current;
      getProductLabelDraft().then(
        (dto) => {
          // Chegou tarde (outra releitura saiu depois) ou a pessoa mexeu na
          // lista enquanto a resposta vinha: o que está na tela vale mais.
          if (current !== generation || changeCountRef.current !== changesAtStart || dirtyRef.current) return;
          if (dto === null && printedHereRef.current) return;
          onLoadedRef.current(fromDraftDto(dto));
        },
        () => {
          // Releitura é conveniência: falhou, fica o que está na tela.
        },
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flush();
      else refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Sair da tela pelo menu não pode perder a última alteração.
      void flush();
    };
  }, [flush]);

  return { loadState, saveState, savedAt, schedule, flush, beginPrint, markPrinted, retryLoad };
}
