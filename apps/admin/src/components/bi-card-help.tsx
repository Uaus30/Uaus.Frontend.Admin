import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@workspace/ui";

type BiCardHelpProps = {
  /** Nome do cartão, no título do balão. */
  titulo: string;
  children: React.ReactNode;
};

/**
 * "?" ao lado do título de um cartão de BI, com a explicação daquele cartão.
 *
 * <b>Por que não basta o "Como ler esta tela".</b> O manual da tela é um texto
 * longo atrás de um botão só: quem trava num cartão específico tem de abrir o
 * manual inteiro e caçar a seção certa. A dúvida acontece olhando o cartão, e a
 * resposta precisa estar ali — foi o que o dono pediu depois de não entender o
 * cartão de mix e preço numa tela que tinha manual.
 *
 * Os dois convivem: este responde "o que é este número"; o da tela responde "o
 * que esta tela é e o que ela não sabe".
 *
 * <b>Popover, e não Dialog.</b> Ler a explicação sem perder o cartão de vista é
 * o ponto: um diálogo modal tapa justamente o número sobre o qual fala. O balão
 * fecha clicando fora ou no Esc, como qualquer popover do sistema.
 */
export function BiCardHelp({ titulo, children }: BiCardHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`O que é ${titulo}`}
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[min(30rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto p-4"
      >
        <p className="text-[13px] font-semibold">{titulo}</p>
        <div className="mt-2 flex flex-col gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Um exemplo numérico dentro do balão — moldura igual em todos os cartões. */
export function BiCardHelpExample({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[12px] text-foreground/80">
      {children}
    </div>
  );
}
