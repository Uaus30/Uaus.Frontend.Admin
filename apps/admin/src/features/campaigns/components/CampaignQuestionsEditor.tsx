import { Badge, Button, Input, Label, Switch } from "@workspace/ui";
import { AlertTriangle, ChevronDown, ChevronUp, ListChecks, Plus, Trash2 } from "lucide-react";
import type { CampaignOptionDraft, CampaignQuestionDraft } from "../types";
import {
  emptyOptionDraft,
  emptyQuestionDraft,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
} from "../hooks/campaignRules";

interface CampaignQuestionsEditorProps {
  questions: CampaignQuestionDraft[];
  onChange: (questions: CampaignQuestionDraft[]) => void;
  /** True enquanto o questionário da campanha em edição ainda está sendo carregado. */
  isLoading?: boolean;
}

/** Troca dois itens de lugar; devolve a lista original quando o destino não existe. */
function swap<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Aplica uma transformação a uma pergunta, preservando as demais. */
function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, position) => (position === index ? value : item));
}

/** Quantas opções da pergunta estão de fato preenchidas. */
function filledOptions(question: CampaignQuestionDraft): number {
  return question.options.filter((option) => option.label.trim()).length;
}

/**
 * CampaignQuestionsEditor
 *
 * Editor do questionário: adicionar e remover pergunta, adicionar e remover
 * opção, reordenar as duas e marcar a pergunta como obrigatória.
 *
 * Três decisões que valem explicação:
 *
 * 1. **A ordem é a posição na lista.** O `sortOrder` enviado ao servidor é
 *    derivado dela no submit, e não guardado no rascunho — com os dois, a ordem
 *    exibida e a ordem gravada poderiam divergir sem nada acusar.
 * 2. **Remover pergunta aqui só a tira da lista.** No servidor a remoção é
 *    LÓGICA: a linha continua existindo, porque as respostas já dadas apontam
 *    para ela e é isso que mantém o relatório histórico de pé. Se o servidor
 *    recusar a remoção, a tela mostra a frase que ele devolveu — o cliente não
 *    tenta adivinhar quem já foi respondido.
 * 3. **Pergunta com menos de {@link MIN_OPTIONS} opções fica marcada aqui e
 *    barra o submit** no hook. Uma alternativa só não é pergunta, é aviso.
 */
export function CampaignQuestionsEditor({ questions, onChange, isLoading }: CampaignQuestionsEditorProps) {
  const canAddQuestion = questions.length < MAX_QUESTIONS;

  function updateQuestion(index: number, patch: Partial<CampaignQuestionDraft>) {
    onChange(replaceAt(questions, index, { ...questions[index], ...patch }));
  }

  function updateOptions(index: number, options: CampaignOptionDraft[]) {
    updateQuestion(index, { options });
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Carregando o questionário da campanha...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Questionário do caixa</Label>
          <Badge variant="secondary" className="font-mono">
            {questions.length}/{MAX_QUESTIONS}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={!canAddQuestion}
          onClick={() => onChange([...questions, emptyQuestionDraft()])}
        >
          <Plus className="h-4 w-4" /> Pergunta
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Campanha sem perguntas: o cupom aplica o desconto e o caixa não pergunta nada.
        </p>
      )}

      {questions.map((question, questionIndex) => {
        const filled = filledOptions(question);
        const missingOptions = filled < MIN_OPTIONS;

        return (
          <div key={question.key} className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Subir pergunta"
                  disabled={questionIndex === 0}
                  onClick={() => onChange(swap(questions, questionIndex, questionIndex - 1))}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Descer pergunta"
                  disabled={questionIndex === questions.length - 1}
                  onClick={() => onChange(swap(questions, questionIndex, questionIndex + 1))}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 space-y-2">
                <Input
                  aria-label={`Texto da pergunta ${questionIndex + 1}`}
                  placeholder="Ex: Como você conheceu a loja?"
                  maxLength={150}
                  value={question.label}
                  onChange={(event) => updateQuestion(questionIndex, { label: event.target.value })}
                />

                <div className="flex items-center gap-2">
                  <Switch
                    id={`question-required-${question.key}`}
                    checked={question.isRequired}
                    onCheckedChange={(checked) => updateQuestion(questionIndex, { isRequired: checked })}
                  />
                  <Label
                    htmlFor={`question-required-${question.key}`}
                    className="text-xs text-muted-foreground"
                  >
                    Resposta obrigatória para aplicar o cupom
                  </Label>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Remover pergunta"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => onChange(questions.filter((_, position) => position !== questionIndex))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 pl-8">
              {question.options.map((option, optionIndex) => (
                <div key={option.key} className="flex items-center gap-2">
                  <Input
                    aria-label={`Opção ${optionIndex + 1} da pergunta ${questionIndex + 1}`}
                    placeholder={`Opção ${optionIndex + 1}`}
                    maxLength={80}
                    value={option.label}
                    onChange={(event) =>
                      updateOptions(
                        questionIndex,
                        replaceAt(question.options, optionIndex, {
                          ...option,
                          label: event.target.value,
                        }),
                      )
                    }
                    className="h-9"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Subir opção"
                    disabled={optionIndex === 0}
                    onClick={() =>
                      updateOptions(questionIndex, swap(question.options, optionIndex, optionIndex - 1))
                    }
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Descer opção"
                    disabled={optionIndex === question.options.length - 1}
                    onClick={() =>
                      updateOptions(questionIndex, swap(question.options, optionIndex, optionIndex + 1))
                    }
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    title="Remover opção"
                    onClick={() =>
                      updateOptions(
                        questionIndex,
                        question.options.filter((_, position) => position !== optionIndex),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={question.options.length >= MAX_OPTIONS}
                  onClick={() => updateOptions(questionIndex, [...question.options, emptyOptionDraft()])}
                >
                  <Plus className="h-4 w-4" /> Opção
                </Button>

                {missingOptions ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Preencha pelo menos {MIN_OPTIONS} opções.
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {filled}/{MAX_OPTIONS} opções
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
