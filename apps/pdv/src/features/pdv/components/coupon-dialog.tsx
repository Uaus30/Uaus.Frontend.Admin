import { useEffect, useState, type KeyboardEvent } from "react";
import { Ticket, TriangleAlert } from "lucide-react";
import { Button, Dialog, DialogContent, DialogTitle, Input } from "@workspace/ui";
import { formatCurrency, formatQuantity } from "@workspace/core";
import { COUPON_DISCOUNT_TYPE } from "@workspace/api-client-react";
import { useCoupon } from "../hooks/use-coupon";
import type { CouponAnswer, CouponQuestion } from "../types";

/** Tecla que abre o diálogo sem tirar a mão do balcão. */
export const COUPON_SHORTCUT_KEY = "F4";

type CouponDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** "10%" ou "R$ 20,00" — o parâmetro do cupom como estava no panfleto. */
function describeParameter(discountType: number, discountValue: number): string {
  return discountType === COUPON_DISCOUNT_TYPE.Percentage
    ? `${formatQuantity(discountValue)}%`
    : formatCurrency(discountValue);
}

type QuestionGroupProps = {
  question: CouponQuestion;
  /** Posição da pergunta, só para dar autofoco à primeira alternativa da primeira. */
  index: number;
  /** Opção já escolhida nesta pergunta, ou `undefined`. */
  chosenOptionId: number | undefined;
  onChoose: (questionId: number, optionId: number) => void;
};

/**
 * Uma pergunta e suas alternativas como **botões grandes**, nunca um `select`.
 *
 * É caixa: o operador está de pé, com o cliente na frente e o próximo da fila
 * atrás. Um `select` custa três interações (abrir, procurar, escolher) e obriga a
 * mirar com o mouse numa lista de 14 pixels de altura. Botão grande é um clique,
 * ou uma tecla — as setas andam entre as alternativas e o número escolhe direto.
 */
function CouponQuestionGroup({ question, index, chosenOptionId, onChoose }: QuestionGroupProps) {
  /** Setas andam entre os botões do grupo; o foco não escapa para o resto da tela. */
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !backward) return;

    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    if (buttons.length === 0) return;

    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (current + (forward ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold uppercase tracking-wide">
        {question.label}
        {question.isRequired && <span className="text-destructive"> *</span>}
      </p>
      <div className="grid grid-cols-2 gap-2" onKeyDown={moveFocus}>
        {question.options.map((option, optionIndex) => (
          <Button
            key={option.optionId}
            type="button"
            variant={chosenOptionId === option.optionId ? "default" : "outline"}
            className="h-14 justify-start gap-3 text-base font-bold"
            autoFocus={index === 0 && optionIndex === 0}
            onClick={() => onChoose(question.questionId, option.optionId)}
          >
            <span className="text-xs opacity-60 font-mono">{optionIndex + 1}</span>
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Consulta e aplicação do cupom, **numa tela só**: o código e o questionário no
 * mesmo diálogo.
 *
 * Duas telas em sequência custariam um clique a mais por venda e abririam a
 * janela clássica do balcão — o operador aplica o cupom, o cliente pergunta
 * alguma coisa, e o questionário fica aberto por cima do carrinho.
 *
 * **O foco volta à busca ao fechar.** Quem o devolve é o Radix, que restaura o
 * foco de antes da abertura; o botão CUPOM do carrinho não rouba o cursor porque
 * cancela o `mousedown` (ver `pdv-cart-panel.tsx`). Sem isso, o próximo bipe do
 * leitor seria digitado num botão e sumiria.
 */
export function CouponDialog({ open, onOpenChange }: CouponDialogProps) {
  const coupon = useCoupon();
  const [code, setCode] = useState("");
  const [answers, setAnswers] = useState<CouponAnswer[]>([]);

  const { reset } = coupon;

  // Atalho de balcão: uma tecla abre o diálogo sem tirar a mão do teclado. Sem
  // modificadores e sem repetição — `Alt+F4` é do sistema operacional e não pode
  // abrir cupom nenhum no caminho de fechar o navegador.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== COUPON_SHORTCUT_KEY || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      event.preventDefault();
      onOpenChange(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  // Reset durante a renderização, e não num efeito: o campo já sai vazio no
  // primeiro paint. Mesmo padrão do diálogo de desconto — um efeito reagiria
  // também ao carrinho e apagaria o código enquanto o operador digita.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setCode("");
    setAnswers([]);
    reset();
  }

  const found = coupon.found;
  const applied = coupon.applied;

  /** Primeira pergunta ainda sem resposta — é nela que as teclas numéricas agem. */
  const activeQuestion = found?.questions.find(
    (question) => !answers.some((answer) => answer.questionId === question.questionId),
  );

  const choose = (questionId: number, optionId: number) =>
    setAnswers((current) => [
      ...current.filter((answer) => answer.questionId !== questionId),
      { questionId, optionId },
    ]);

  /**
   * Teclas numéricas escolhem a alternativa da pergunta corrente.
   *
   * Ignoradas enquanto o foco está no campo de código: ali "1" é parte do código
   * do cupom, não a escolha de uma resposta.
   */
  const chooseByNumber = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!activeQuestion || event.target instanceof HTMLInputElement) return;

    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= activeQuestion.options.length) return;

    event.preventDefault();
    choose(activeQuestion.questionId, activeQuestion.options[index].optionId);
  };

  const confirm = () => {
    if (coupon.apply(answers)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] p-6 bg-card border-border shadow-2xl"
        onKeyDown={chooseByNumber}
      >
        <DialogTitle className="text-xl font-bold flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" /> Cupom de Desconto
        </DialogTitle>

        {applied && !found && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold truncate">
                {applied.code}{" "}
                <span className="font-normal opacity-70">
                  ({describeParameter(applied.discountType, applied.discountValue)})
                </span>
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                - {formatCurrency(coupon.discount)}
              </p>
            </div>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => {
                coupon.remove();
                onOpenChange(false);
              }}
            >
              Remover
            </Button>
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setAnswers([]);
            void coupon.lookup(code);
          }}
        >
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Código do cupom"
            className="h-12 text-lg font-mono uppercase"
            autoFocus={!found}
            autoComplete="off"
          />
          <Button type="submit" className="h-12 px-6 font-bold" disabled={coupon.searching}>
            {coupon.searching ? "..." : "CONSULTAR"}
          </Button>
        </form>

        {coupon.refusal && (
          <p className="text-sm font-bold text-destructive" role="alert">
            {coupon.refusal}
          </p>
        )}

        {found && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="font-bold text-lg">
                {found.code}{" "}
                <span className="font-normal opacity-70">
                  ({describeParameter(found.discountType, found.discountValue)})
                </span>
              </p>
              {found.description && (
                <p className="text-sm text-muted-foreground">{found.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {found.remainingUses === null
                  ? "Usos ilimitados"
                  : `Restam ${found.remainingUses} uso(s)`}
                {found.fromLocalDatabase && " · conferido na base local"}
              </p>
              {found.overLimit && (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <TriangleAlert className="w-3.5 h-3.5" />
                  Limite esgotado na base local. A venda segue e o servidor registra o excedente.
                </p>
              )}
            </div>

            {found.questions.map((question, index) => (
              <CouponQuestionGroup
                key={question.questionId}
                question={question}
                index={index}
                chosenOptionId={
                  answers.find((answer) => answer.questionId === question.questionId)?.optionId
                }
                onChoose={choose}
              />
            ))}

            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                autoFocus={found.questions.length === 0}
                onClick={confirm}
              >
                APLICAR
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
