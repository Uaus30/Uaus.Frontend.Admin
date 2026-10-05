import { Link } from "wouter";
import type { HomeShortcut } from "../types";

type HomeShortcutGridProps = {
  shortcuts: readonly HomeShortcut[];
};

/**
 * A grade de botões da tela inicial.
 *
 * O cartão INTEIRO é o link, e não um botão dentro do cartão: no celular o alvo
 * de toque é o quadrado todo, sem área morta entre o ícone e o texto. Duas
 * colunas no celular é o que deixa cada alvo com mais de 140px de lado num
 * aparelho de 360px — folga larga sobre os 44px que se pede para o dedo.
 *
 * Só número PAR de colunas (duas, e quatro a partir do `lg`): a lista anda em
 * pares de assunto (ver `shortcuts.ts`), e uma grade de três separaria os pares
 * — Lucros ficaria numa linha e Dashboard na outra.
 *
 * O título fica a uma distância FIXA do topo, logo abaixo do ícone, e a sobra de
 * altura vai para o pé do cartão. Com o conteúdo espalhado entre o topo e o pé
 * (`justify-between`), a descrição de três linhas empurrava o título dela para
 * cima, e os dois títulos da mesma linha ficavam desalinhados (dono, 05/10/2026).
 *
 * Cor neutra de propósito: verde, âmbar e vermelho têm significado fixo no
 * sistema (`Uaus.Docs/dominio/convencoes-de-interface.md`), e um atalho não é
 * estado. O laranja da marca no ícone só diz "isto se toca".
 */
export function HomeShortcutGrid({ shortcuts }: HomeShortcutGridProps) {
  return (
    <nav aria-label="Atalhos" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {shortcuts.map(({ label, description, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] sm:p-5"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-base font-semibold leading-tight text-foreground">{label}</span>
            <span className="text-xs leading-snug text-muted-foreground">{description}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
