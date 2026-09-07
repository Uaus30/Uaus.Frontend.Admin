import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui";

/** Uma seção do manual: um título e o conteúdo, que pode ter tabela e destaque. */
export type BiHelpSection = {
  title: string;
  /** Ícone opcional ao lado do título, para casar com o da tela. */
  icon?: React.ComponentType<{ className?: string }>;
  body: React.ReactNode;
};

type BiHelpDialogProps = {
  /** Nome da tela, no título do diálogo. */
  screen: string;
  /** Uma frase dizendo a que pergunta a tela responde. */
  summary: string;
  sections: BiHelpSection[];
  /** Rótulo do botão. O padrão serve para as telas de BI. */
  label?: string;
};

/**
 * "Como ler esta tela" — o manual da tela, dentro da própria tela.
 *
 * As telas de BI carregam vocabulário próprio (classe, nota, cobertura, capital
 * em risco) e o rodapé explicativo que elas já tinham só alcança quem rola até o
 * fim. O botão fica ao lado do título, que é onde a dúvida aparece.
 *
 * É um componente compartilhado, e não uma cópia por tela, porque o formato é o
 * que se quer igual: mesma posição, mesmo rótulo, mesma estrutura de seções. O
 * CONTEÚDO é de cada tela — genérico aqui viraria texto que não ensina nada.
 *
 * A rolagem é nativa (`overflow-y-auto` num filho `min-h-0 flex-1`), e não
 * `ScrollArea`: dentro de um diálogo com `max-h`, o viewport do Radix é
 * dimensionado por `height: 100%` e não encontra altura definida no pai — o
 * conteúdo cresce dentro de uma caixa `overflow: hidden` e o excedente fica
 * inalcançável, sem barra nenhuma (armadilha 7 do CLAUDE.md).
 */
export function BiHelpDialog({ screen, summary, sections, label = "Como ler esta tela" }: BiHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-background text-xs">
          <HelpCircle className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-[17px]">{screen}</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed">{summary}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-6">
            {sections.map((section) => (
              <section key={section.title} className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
                  {section.icon && <section.icon className="h-4 w-4 text-muted-foreground" />}
                  {section.title}
                </h3>
                <div className="text-[13px] leading-relaxed text-muted-foreground">{section.body}</div>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Linha de glossário: o termo em destaque e o que ele quer dizer.
 *
 * Existe para as duas telas de BI escreverem os glossários com a mesma cara —
 * são dezenas de linhas, e formatá-las à mão em cada arquivo é onde a
 * divergência começa.
 */
export function BiHelpTerm({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <p>
      <strong className="text-foreground/85">{term}</strong> — {children}
    </p>
  );
}
