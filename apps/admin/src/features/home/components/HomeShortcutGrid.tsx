import { Link } from "wouter";
import { cn } from "@workspace/ui";
import { SHORTCUT_TONES } from "../tones";
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
 * Cada botão tem a sua cor (dono, 24/10/2026) — no ícone, no brilho do canto e
 * na borda ao passar o mouse; o texto continua neutro, para ler igual em todos.
 * A paleta e o que ficou fora dela estão em `tones.ts`.
 *
 * O fundo do cartão é translúcido para os polígonos da tela aparecerem por trás,
 * mas SEM `backdrop-blur`: o desfoque seria recalculado a cada quadro da
 * animação, nos dez cartões, e é o celular que paga.
 */
export function HomeShortcutGrid({ shortcuts }: HomeShortcutGridProps) {
  return (
    <nav aria-label="Atalhos" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {shortcuts.map(({ label, description, href, icon: Icon, tone }) => {
        const colors = SHORTCUT_TONES[tone];
        return (
          <Link
            key={href}
            href={href}
            data-tone={tone}
            className={cn(
              "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-card/95 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] sm:p-5",
              colors.border,
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-30",
                colors.glow,
              )}
            />
            <span
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform group-hover:scale-105",
                colors.icon,
              )}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="relative flex flex-col gap-1">
              <span className="text-base font-semibold leading-tight text-foreground">{label}</span>
              <span className="text-xs leading-snug text-muted-foreground">{description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
