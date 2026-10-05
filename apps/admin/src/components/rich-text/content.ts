import { generateHTML, generateJSON } from "@tiptap/react";
import { RICH_TEXT_EXTENSIONS } from "./extensions";

/**
 * Regras do conteúdo do texto formatado, sem React: converter o que veio do
 * servidor para o editor, saber se há texto de verdade e sanear para exibir.
 */

/** HTML gerado pelo editor começa por um bloco. Texto puro de cartão antigo, não. */
const STARTS_WITH_BLOCK = /^\s*<(p|h[1-6]|ul|ol|blockquote|pre)[\s>]/i;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * O valor do servidor no formato do editor. Até 05/10/2026 a descrição era texto
 * puro: entregue assim ao editor, as quebras de linha sumiriam (HTML junta
 * espaços) e um "<" digitado viraria tag. Cada linha vira um parágrafo, escapada.
 */
export function toEditorHtml(value: string | null | undefined): string {
  if (!value) return "";
  if (STARTS_WITH_BLOCK.test(value)) return value;

  return value
    .split(/\r?\n/)
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<p></p>"))
    .join("");
}

/**
 * O endereço do link como o navegador precisa. "www.fornecedor.com.br" sem
 * protocolo seria gravado como link RELATIVO — e abriria o próprio admin
 * (`admin.uaus.com.br/www.fornecedor.com.br`, a página 404). Com protocolo
 * (https:, mailto:, tel:…), caminho ou âncora, fica como está.
 */
export function normalizeLinkHref(input: string): string {
  const href = input.trim();
  if (!href) return "";
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("/") || href.startsWith("#")) return href;
  return `https://${href}`;
}

/**
 * Sem os parágrafos vazios do fim. O editor mantém um parágrafo depois de uma
 * lista ou bloco de código para dar onde continuar escrevendo; gravado, ele
 * virava um espaço sobrando embaixo do texto (visto no smoke de 05/10/2026).
 */
export function trimTrailingEmptyParagraphs(html: string): string {
  return html.replace(/(?:<p>(?:<br\s*\/?>)?<\/p>)+$/i, "");
}

/**
 * Sem texto visível: vazio, só espaços ou só marcação (`<p></p>`, `<p><br></p>`).
 * É o que o editor vazio devolve — e não pode virar "tem descrição" nem
 * comentário em branco. Espelha `RichText.IsBlank` do backend.
 */
export function isBlankRichText(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();
  return text.length === 0;
}

/**
 * O HTML relido pelo esquema do editor: só sobrevive o que a barra sabe fazer.
 * `<script>`, `onerror`, `style` que não seja cor ou alinhamento e link
 * `javascript:` caem aqui — o servidor guarda o que recebe, e qualquer sessão
 * pode mandar qualquer coisa pela API. Quem exibe com `dangerouslySetInnerHTML`
 * passa por esta função antes, sempre.
 */
export function sanitizeRichText(value: string | null | undefined): string {
  const html = toEditorHtml(value);
  if (!html) return "";
  return generateHTML(generateJSON(html, RICH_TEXT_EXTENSIONS), RICH_TEXT_EXTENSIONS);
}

/**
 * A aparência do texto formatado, igual na leitura e na edição (sem o plugin
 * `prose`, que traz margens e cores próprias que brigam com o tema da modal).
 */
export const RICH_TEXT_CLASSES = [
  "text-sm leading-relaxed break-words text-foreground",
  "[&_p]:my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_h1]:mb-1 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold",
  "[&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold",
  "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li>p]:my-0",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-foreground/25 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-foreground/10 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
].join(" ");
