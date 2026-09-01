import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import notFoundImage from "../assets/404-error.png";

/** Título fixo da tela. Exportado para os testes dos apps afirmarem sobre ele. */
export const NOT_FOUND_TITLE = "PÁGINA NÃO ENCONTRADA";

/** Linha de apoio padrão, usada por quem não passa `description`. */
const DEFAULT_DESCRIPTION = "O endereço que você tentou abrir não existe.";

export interface NotFoundScreenProps {
  /** Linha de apoio abaixo do título, quando o app tem algo melhor a dizer. */
  description?: ReactNode;
  /** Ação de retorno. Cada app passa o `Link` do próprio roteador. */
  action?: ReactNode;
  /** Ajuste do contêiner — na prática, a altura. Ver nota sobre `min-h`. */
  className?: string;
}

/**
 * Tela de rota inexistente dos três apps.
 *
 * Mora no pacote de UI, e não em cada app, porque "padrão" aqui é literal: até
 * ago/2026 o admin mostrava o boilerplate do shadcn em inglês ("Did you forget
 * to add the page to the router?", endereçado ao programador e não a quem
 * estava na tela), o PDV redirecionava calado para o caixa — sem dizer que o
 * endereço não existia — e só a loja tinha um 404 de verdade. Três respostas
 * diferentes para o mesmo acontecimento.
 *
 * Imagem e título não são configuráveis de propósito: são o que faz a tela ser
 * reconhecível entre os apps. Varia só o que precisa variar — a linha de apoio
 * e a ação de retorno, que depende do roteador de cada app (o pacote não
 * conhece o wouter, e não deve conhecer).
 *
 * A altura padrão é `min-h-[60vh]`, e não `min-h-screen`, porque a loja
 * renderiza esta tela DENTRO do layout do site, entre cabeçalho e rodapé —
 * ocupar a viewport inteira ali empurraria o rodapé para fora. Admin e PDV, que
 * a renderizam soltas, passam `min-h-screen` pelo `className`.
 */
export function NotFoundScreen({ description, action, className }: NotFoundScreenProps) {
  return (
    <div
      data-slot="not-found-screen"
      className={cn(
        "flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-6 py-12 text-center",
        className,
      )}
    >
      {/*
       * Decorativa: o `h1` logo abaixo já diz o que aconteceu, e a arte repete
       * "ERROR" em inglês. Anunciada, o leitor de tela ouviria a mesma coisa
       * duas vezes, uma delas no idioma errado.
       */}
      <img
        src={notFoundImage}
        alt=""
        aria-hidden
        width={512}
        height={521}
        draggable={false}
        className="w-full max-w-[200px] select-none sm:max-w-[260px]"
      />

      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-black tracking-wide text-foreground sm:text-3xl">{NOT_FOUND_TITLE}</h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          {description ?? DEFAULT_DESCRIPTION}
        </p>
      </div>

      {action}
    </div>
  );
}
