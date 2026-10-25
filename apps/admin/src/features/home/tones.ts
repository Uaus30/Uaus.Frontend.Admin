/** As classes de uma cor de botão da tela inicial. */
interface ToneClasses {
  /** O quadrado do ícone: degradê da cor e a sombra colorida embaixo dele. */
  icon: string;
  /** A borda do cartão ao passar o mouse. */
  border: string;
  /** O brilho difuso no canto do cartão. */
  glow: string;
}

/**
 * A cor de cada botão da tela inicial (pedido do dono, 24/10/2026): com dez
 * botões iguais, achar um era ler os rótulos; com uma cor por botão, o olho vai
 * direto ("Vendas é o ciano").
 *
 * A ORDEM aqui é a do matiz, do verde-azulado ao laranja, e o teste da grade a
 * usa: duas cores vizinhas nesta lista (azul e índigo, ciano e céu) se confundem
 * de relance, então não podem cair em botões vizinhos na grade.
 *
 * As classes são LITERAIS de propósito: o Tailwind só gera a classe que lê
 * inteira no código-fonte, e um `from-${cor}-400` montado em tempo de execução
 * sairia sem cor nenhuma.
 *
 * Fora daqui ficam o verde, o âmbar, o vermelho e o cinza: cada um já tem
 * significado de ESTADO no sistema (`Uaus.Docs/dominio/convencoes-de-interface.md`)
 * — um "Estoque" âmbar leria como alerta, um "Lucros" verde como lucro positivo.
 * Pelo mesmo motivo não entram os vizinhos que se confundem com eles (esmeralda,
 * amarelo, lima, rosa-avermelhado). O teste da grade trava as duas regras.
 */
export const SHORTCUT_TONES = {
  teal: {
    icon: "from-teal-400 to-teal-600 shadow-teal-500/30",
    border: "hover:border-teal-400/60",
    glow: "bg-teal-500",
  },
  cyan: {
    icon: "from-cyan-400 to-cyan-600 shadow-cyan-500/30",
    border: "hover:border-cyan-400/60",
    glow: "bg-cyan-500",
  },
  sky: {
    icon: "from-sky-400 to-sky-600 shadow-sky-500/30",
    border: "hover:border-sky-400/60",
    glow: "bg-sky-500",
  },
  blue: {
    icon: "from-blue-400 to-blue-600 shadow-blue-500/30",
    border: "hover:border-blue-400/60",
    glow: "bg-blue-500",
  },
  indigo: {
    icon: "from-indigo-400 to-indigo-600 shadow-indigo-500/30",
    border: "hover:border-indigo-400/60",
    glow: "bg-indigo-500",
  },
  violet: {
    icon: "from-violet-400 to-violet-600 shadow-violet-500/30",
    border: "hover:border-violet-400/60",
    glow: "bg-violet-500",
  },
  purple: {
    icon: "from-purple-400 to-purple-600 shadow-purple-500/30",
    border: "hover:border-purple-400/60",
    glow: "bg-purple-500",
  },
  fuchsia: {
    icon: "from-fuchsia-400 to-fuchsia-600 shadow-fuchsia-500/30",
    border: "hover:border-fuchsia-400/60",
    glow: "bg-fuchsia-500",
  },
  pink: {
    icon: "from-pink-400 to-pink-600 shadow-pink-500/30",
    border: "hover:border-pink-400/60",
    glow: "bg-pink-500",
  },
  orange: {
    icon: "from-orange-400 to-orange-600 shadow-orange-500/30",
    border: "hover:border-orange-400/60",
    glow: "bg-orange-500",
  },
} as const satisfies Record<string, ToneClasses>;

/** O nome de uma das cores de `SHORTCUT_TONES`. */
export type ShortcutTone = keyof typeof SHORTCUT_TONES;
