import type { Extensions } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";

/**
 * O esquema do texto formatado: o que o editor sabe escrever e, pelo mesmo
 * motivo, a ÚNICA coisa que a exibição aceita — `sanitizeRichText` relê o HTML
 * guardado por esta lista, e tag ou atributo fora dela não sobrevive.
 *
 * As opções seguem a barra do ClickUp que o dono mandou de referência
 * (05/10/2026): tipo de bloco (texto, títulos, listas, citação, código), cor,
 * negrito, itálico, sublinhado, tachado, código, alinhamento e link.
 */
export const RICH_TEXT_EXTENSIONS: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    // Sem a régua horizontal: não está na barra, e um "---" digitado viraria uma.
    horizontalRule: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      // O Link já recusa `javascript:` e afins ao ler e ao gravar o HTML.
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
    },
  }),
  TextStyle,
  Color,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

/** As cores da barra: tons médios, legíveis no tema claro e no escuro. */
export const RICH_TEXT_COLORS = [
  { label: "Cinza", value: "#6b7280" },
  { label: "Vermelho", value: "#ef4444" },
  { label: "Laranja", value: "#f97316" },
  { label: "Amarelo", value: "#eab308" },
  { label: "Verde", value: "#22c55e" },
  { label: "Azul", value: "#3b82f6" },
  { label: "Roxo", value: "#a855f7" },
  { label: "Rosa", value: "#ec4899" },
] as const;
