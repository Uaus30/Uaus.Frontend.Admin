import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion, useDragControls, useMotionValue } from "framer-motion";
import { Calculator as CalculatorIcon, History, Trash2, X } from "lucide-react";
import { useCalculatorStore } from "@/stores/use-calculator-store";
import { evaluate, formatResult } from "@/lib/calculator";
import { KEYBOARD_INPUT, KEYS, KEY_STYLES, type Key } from "./calculator-keys";

/** Folga mínima entre a calculadora e as bordas da tela. */
const VIEWPORT_MARGIN = 8;

/**
 * Retângulo em que a calculadora nasce — o espaço de resultados da busca, o
 * mesmo que mostra "Caixa Livre" com o carrinho vazio. Marcado por atributo em
 * `features/pdv/components/pdv-search-panel.tsx`.
 */
const ANCHOR_SELECTOR = "[data-calculator-anchor]";

/** Folga entre a calculadora e as bordas da área em que ela nasce. */
const ANCHOR_MARGIN = 16;

/**
 * Calculadora flutuante do PDV.
 *
 * Fica por cima da tela sem bloquear o atendimento: é translúcida, pode ser
 * arrastada pelo cabeçalho e guarda o histórico dos cálculos da sessão.
 *
 * O teclado físico só é escutado enquanto o foco está dentro dela — o PDV
 * inteiro depende do leitor de código de barras digitando no campo de busca.
 */
export function Calculator() {
  const {
    open,
    expression,
    history,
    historyOpen,
    position,
    close,
    toggleHistory,
    setPosition,
    input,
    backspace,
    clear,
    percent,
    equals,
    recall,
    clearHistory,
  } = useCalculatorStore();

  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(position?.x ?? 0);
  const y = useMotionValue(position?.y ?? 0);

  const preview = evaluate(expression);

  /**
   * Traz a calculadora de volta para dentro da tela.
   *
   * Abrir o histórico faz o painel crescer; perto da borda de baixo isso jogava
   * o teclado para fora da tela, e perto da de cima escondia o cabeçalho — com
   * ele os botões de fechar e de ocultar o histórico, e a janela virava uma
   * armadilha. Quando o painel é mais alto que a viewport, o topo tem
   * prioridade: é onde estão os controles.
   */
  const clampIntoViewport = useCallback(() => {
    const node = panelRef.current;
    if (!node) return;

    // offsetTop/offsetLeft ignoram o transform, então dão a posição de origem do
    // painel. Corrigir por deslocamento relativo (getBoundingClientRect) faria a
    // correção se acumular a cada quadro da animação e jogaria a janela para
    // fora da tela — o alvo precisa ser absoluto.
    const baseTop = node.offsetTop;
    const baseLeft = node.offsetLeft;

    // O topo é aplicado depois do rodapé de propósito: num painel mais alto que a
    // tela, é o cabeçalho — com os botões de fechar e de histórico — que precisa
    // sobrar à vista.
    const targetY = Math.max(
      VIEWPORT_MARGIN - baseTop,
      Math.min(y.get(), window.innerHeight - VIEWPORT_MARGIN - node.offsetHeight - baseTop),
    );

    const targetX = Math.max(
      VIEWPORT_MARGIN - baseLeft,
      Math.min(x.get(), window.innerWidth - VIEWPORT_MARGIN - node.offsetWidth - baseLeft),
    );

    // Só os valores de movimento são tocados aqui: esta função roda a cada quadro
    // da animação do histórico, e gravar na store nesse ritmo re-renderizava o
    // componente sem parar, atropelando a própria animação.
    x.set(targetX);
    y.set(targetY);
  }, [x, y]);

  /**
   * Põe a calculadora no canto superior direito da área de busca.
   *
   * É a posição padrão, usada enquanto o operador não tiver arrastado a janela.
   * Ela é MEDIDA a cada abertura em vez de ser um par de coordenadas fixo porque
   * a área anda na tela: a faixa de offline e a de ambiente de desenvolvimento
   * empurram tudo para baixo quando aparecem, e o controle de tamanho da fonte
   * escala o layout inteiro, que é medido em `rem`.
   *
   * Sem âncora na tela (outra rota, teste), o alvo vira a própria viewport — o
   * canto superior direito dela, que é o mais parecido com o combinado.
   */
  const anchorToSearchArea = useCallback(() => {
    const node = panelRef.current;
    if (!node) return;

    const area =
      document.querySelector(ANCHOR_SELECTOR)?.getBoundingClientRect() ??
      new DOMRect(0, 0, window.innerWidth, window.innerHeight);

    // Mesma correção do clamp: `offsetLeft/offsetTop` descontam a origem que o
    // CSS dá ao painel, para o alvo ser absoluto e não se acumular a cada quadro.
    x.set(area.right - node.offsetWidth - ANCHOR_MARGIN - node.offsetLeft);
    y.set(area.top + ANCHOR_MARGIN - node.offsetTop);
  }, [x, y]);

  /** Coloca a janela onde ela deve estar agora: canto padrão ou onde foi largada. */
  const reposition = useCallback(() => {
    if (position === null) anchorToSearchArea();
    clampIntoViewport();
  }, [position, anchorToSearchArea, clampIntoViewport]);

  // Ao abrir, o foco vai para o painel: sem isso o teclado físico continuaria
  // caindo no campo de busca de produtos atrás da calculadora.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  /**
   * Coloca a janela no lugar a cada abertura — e de novo no quadro seguinte.
   *
   * A repetição não é paranoia: na PRIMEIRA abertura depois de carregar a
   * página, o `x`/`y` gravado aqui era descartado e a calculadora nascia colada
   * no canto superior esquerdo da tela. O efeito roda (conferido: com o nó já
   * montado), mas o framer-motion aplica o `initial` da animação de entrada
   * DEPOIS dele e, ao montar o painel, zera o transform inteiro — inclusive a
   * translação que acabou de ser definida. Da segunda abertura em diante não
   * aparecia, porque os valores de movimento sobrevivem ao fechamento e já
   * estavam certos: o defeito só existia no primeiro uso do turno.
   *
   * Reaplicar no quadro seguinte pega o painel já montado. Não há salto visível:
   * nesse quadro a entrada ainda está em `opacity: 0`.
   *
   * Reposicionar a cada abertura também cobre o caso antigo: a posição guardada
   * pode não caber mais porque a janela mudou de tamanho ou o histórico cresceu.
   */
  useLayoutEffect(() => {
    if (!open) return;

    reposition();
    const quadro = requestAnimationFrame(reposition);
    window.addEventListener("resize", reposition);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", reposition);
    };
  }, [open, historyOpen, history.length, reposition]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;

    if (key === "Escape") {
      close();
      return;
    }

    if (key === "Enter" || key === "=") {
      event.preventDefault();
      equals();
      return;
    }

    if (key === "Backspace") {
      event.preventDefault();
      backspace();
      return;
    }

    if (key === "Delete") {
      clear();
      return;
    }

    if (key === "%") {
      event.preventDefault();
      percent();
      return;
    }

    if (/^\d$/.test(key)) {
      input(key);
      return;
    }

    const mapped = KEYBOARD_INPUT[key];
    if (mapped) {
      event.preventDefault();
      input(mapped);
    }
  };

  const runKey = (key: Key) => {
    if (key.input !== undefined) {
      input(key.input);
      return;
    }

    switch (key.action) {
      case "clear":
        clear();
        break;
      case "backspace":
        backspace();
        break;
      case "percent":
        percent();
        break;
      case "equals":
        equals();
        break;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label="Calculadora"
          tabIndex={-1}
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={0}
          onDragEnd={() => {
            clampIntoViewport();
            setPosition({ x: x.get(), y: y.get() });
          }}
          style={{ x, y }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          onKeyDown={handleKeyDown}
          // A origem do CSS é o canto superior esquerdo da viewport para que `x`
          // e `y` sejam coordenadas absolutas de tela — é o que permite mirar um
          // retângulo medido em `getBoundingClientRect`. Enquanto a origem era
          // `bottom-24 right-8`, todo alvo tinha que ser convertido para
          // deslocamento, e o painel crescia para CIMA ao abrir o histórico.
          //
          // Coluna com altura máxima: em tela baixa quem cede espaço é a lista do
          // histórico, no meio. Cabeçalho, visor e teclado nunca saem de vista.
          className="fixed left-0 top-0 z-50 flex max-h-[calc(100vh-1rem)] w-[300px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl outline-none"
        >
          <div
            onPointerDown={(event) => dragControls.start(event)}
            className="flex shrink-0 cursor-grab items-center justify-between gap-2 rounded-t-2xl border-b border-white/10 bg-foreground/5 px-3 py-2 active:cursor-grabbing"
          >
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <CalculatorIcon className="h-4 w-4 text-primary" /> Calculadora
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={toggleHistory}
                title="Histórico de cálculos"
                aria-pressed={historyOpen}
                className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                  historyOpen ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-foreground/10"
                }`}
              >
                <History className="h-4 w-4" />
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={close}
                title="Fechar calculadora"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-3">
            <div className="mb-3 shrink-0 rounded-xl border border-white/10 bg-background/40 px-3 py-3 text-right">
              <p className="truncate font-mono text-2xl font-bold leading-tight text-foreground">
                {expression || "0"}
              </p>
              <p className="mt-1 h-4 font-mono text-xs text-muted-foreground">
                {preview !== null && expression !== "" ? `= ${formatResult(preview)}` : ""}
              </p>
            </div>

            {/*
              Sem animação de altura de propósito. O painel muda de tamanho e
              precisa ser reposicionado dentro da tela antes da pintura — animar
              a altura deixaria parte dele fora da viewport durante a transição,
              que é justamente o problema que o reposicionamento resolve.
            */}
            {historyOpen && (
              <div className="flex min-h-0 flex-col">
                <div className="mb-3 flex min-h-0 flex-col rounded-xl border border-white/10 bg-background/40">
                  <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Histórico
                    </span>
                    <button
                      type="button"
                      onClick={clearHistory}
                      disabled={history.length === 0}
                      title="Limpar histórico"
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Piso de altura para a lista não sumir de vez quando o espaço aperta. */}
                  <div className="max-h-40 min-h-14 flex-1 overflow-y-auto">
                    {history.length === 0 ? (
                      <p className="px-3 py-4 text-center text-[11px] italic text-muted-foreground">
                        Nenhum cálculo ainda.
                      </p>
                    ) : (
                      history.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => recall(entry.id)}
                          title="Reaproveitar este cálculo"
                          className="flex w-full flex-col items-end px-3 py-1.5 text-right transition-colors hover:bg-foreground/10 cursor-pointer"
                        >
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {entry.expression}
                          </span>
                          <span className="font-mono text-sm font-bold text-foreground">
                            {formatResult(entry.result)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid shrink-0 grid-cols-4 gap-1.5">
              {KEYS.map((key) => {
                const Icon = key.icon;
                return (
                  <button
                    key={key.label}
                    type="button"
                    onClick={() => runKey(key)}
                    aria-label={key.label}
                    className={`flex h-11 items-center justify-center rounded-xl font-mono text-lg font-bold transition-colors active:scale-95 cursor-pointer ${KEY_STYLES[key.variant]}`}
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : key.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
