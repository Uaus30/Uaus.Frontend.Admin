import { Button } from "./button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { cn } from "../lib/utils";

/**
 * Rótulo do que está sendo contado no resumo ("12 custos fixos").
 *
 * São duas formas e não uma porque o resumo cita o número: "1 custos fixos" é
 * o tipo de detalhe que faz a tela parecer inacabada, e concatenar "s" não
 * resolve português ("formas de pagamento", "sócios").
 */
export interface TablePaginationItemLabel {
  /** Forma singular, usada quando o total é exatamente 1. Ex.: "custo fixo". */
  singular: string;
  /** Forma plural, usada em todos os outros casos. Ex.: "custos fixos". */
  plural: string;
}

/**
 * Contrato único de paginação do admin.
 *
 * ## Por que ESTE contrato, e não os três que existiam
 *
 * Antes deste componente o admin tinha três rodapés de paginação diferentes,
 * cada um com uma fonte de verdade própria:
 *
 * 1. **Derivado na marra** (vendas, categorias, clientes, departamentos):
 *    `Mostrando página X de Math.ceil(total / limit)`, com o "Próxima"
 *    desabilitado por `data.length < limit`. Essa heurística **erra** quando o
 *    total é múltiplo exato do tamanho da página: 40 itens em páginas de 20
 *    deixam a última página cheia, o botão liberado, e o operador cai numa
 *    página vazia sem entender por quê.
 * 2. **`totalPages` do servidor** (custos fixos, campanhas, cupons,
 *    fechamentos, sócios): correto, mas escondido inteiro atrás de
 *    `total > PAGE_SIZE` — some com o total da tela junto, e o operador perde
 *    a resposta para "isso é tudo mesmo?".
 * 3. **Com itens por página** (catálogo de imagens): o único com seletor de
 *    tamanho, e o único que mostrava `X / Y` em vez de "Página X de Y".
 *
 * E havia um quarto meio-caminho: formas de pagamento **não tinha**
 * `totalPages` — comparava `page * 10 >= filteredItems` com o `10` escrito na
 * página, longe do `size: 10` do hook. Dois literais que precisavam concordar
 * e nada garantia que concordassem.
 *
 * ## As decisões
 *
 * - **A entrada é `total` + `pageSize`; `totalPages` é derivado aqui.** É o par
 *   que os quatro dialetos tinham (o `totalPages` não). Derivar num lugar só
 *   mata a divergência de fórmula e faz o caso do múltiplo exato ser resolvido
 *   por aritmética, não por palpite sobre o tamanho do array.
 * - **O nome da prop é `pageSize`, deliberadamente nem `size` nem `limit`.** O
 *   repositório diverge nos dois nomes na camada HTTP (`useGetPaymentMethods`
 *   recebe `size`, `useGetFixedCosts` recebe `limit`) e adotar um dos dois aqui
 *   pareceria endossar aquele lado numa discussão que é de outra camada. O
 *   componente não fala com a rede; o nome dele é de UI.
 * - **`onPageChange` recebe o número da página, não um updater.** Isso mantém
 *   `setPage` de `useState` compatível por atribuição direta e, ao mesmo tempo,
 *   permite hooks que persistem a página em querystring.
 * - **O rodapé não some quando só existe uma página.** O que sumia com ele era
 *   o total, e o total é a informação mais útil da linha. Os botões ficam
 *   desabilitados; a linha continua respondendo "quantos são".
 * - **O seletor de itens por página é opcional, mas existe.** Sem ele o
 *   catálogo de imagens ficaria de fora e continuaria com rodapé próprio para
 *   sempre — que é exatamente como três formatos viram quatro.
 */
export interface TablePaginationProps {
  /** Página exibida, começando em 1. Valores fora do intervalo são apresentados travados no limite. */
  page: number;
  /** Itens por página em vigor. Usado para derivar o total de páginas e o intervalo mostrado. */
  pageSize: number;
  /** Total de itens **do filtro atual** (o `filteredItems` do backend), não o total da tabela. */
  total: number;
  /** Recebe a página destino já calculada. `setPage` de `useState` serve direto. */
  onPageChange: (page: number) => void;
  /** Nome do que está sendo contado, para o resumo ganhar sentido. Sem ele o resumo cita só o número. */
  itemLabel?: TablePaginationItemLabel;
  /**
   * Tamanhos oferecidos no seletor de itens por página. Só aparece junto com
   * `onPageSizeChange` — opções sem quem as receba seriam um controle morto.
   */
  pageSizeOptions?: number[];
  /**
   * Troca de itens por página. Quem trata deve voltar para a página 1: com 100
   * itens por página a página 7 costuma não existir mais, e o operador cairia
   * numa tela vazia logo após mudar o tamanho.
   */
  onPageSizeChange?: (pageSize: number) => void;
  /** Classes extras do contêiner, para a página ajustar espaçamento e borda. */
  className?: string;
}

/** Seletor de itens por página. Separado para o `onChange` chegar aqui já garantido. */
function PageSizePicker({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span>Itens por página:</span>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger className="h-8 w-20 bg-background text-xs" aria-label="Itens por página">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Rodapé de paginação das tabelas do admin.
 *
 * Monta o resumo ("Mostrando 1–10 de 43 custos fixos"), a navegação
 * Anterior/Próxima e o seletor opcional de itens por página. Ver o JSDoc de
 * {@link TablePaginationProps} para o motivo de cada decisão do contrato.
 *
 * Não renderiza nada quando não há itens **e** não há seletor de tamanho: a
 * tabela vazia já exibe o próprio aviso, e uma barra de paginação embaixo dela
 * só somaria ruído. Com seletor, ele fica — senão quem trocou para 100 por
 * página e esvaziou o filtro não teria como voltar.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const hasSizePicker = onPageSizeChange != null && pageSizeOptions != null && pageSizeOptions.length > 0;

  if (total <= 0 && !hasSizePicker) return null;

  // `pageSize` zerado (ou negativo) viria de um hook meio inicializado; dividir
  // por ele daria Infinity e a tela mostraria "Página 1 de Infinity".
  const safePageSize = Math.max(1, Math.trunc(pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  // A página é travada no intervalo para a tela nunca anunciar "Página 7 de 3".
  // Isso acontece de verdade: excluir o último item da última página encolhe o
  // total antes de o hook recuar a página.
  const currentPage = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);

  const firstItem = total === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const lastItem = Math.min(currentPage * safePageSize, total);
  const noun = itemLabel ? (total === 1 ? itemLabel.singular : itemLabel.plural) : "";

  const summary =
    total === 0
      ? "Nenhum resultado"
      : `Mostrando ${firstItem}–${lastItem} de ${total}${noun ? ` ${noun}` : ""}`;

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        "flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {hasSizePicker && pageSizeOptions && onPageSizeChange && (
          <PageSizePicker value={safePageSize} options={pageSizeOptions} onChange={onPageSizeChange} />
        )}
        {/* `aria-live` porque a troca de página não move o foco: sem isso o
            leitor de tela não anuncia que o conteúdo da tabela mudou. */}
        <span aria-live="polite">{summary}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Anterior
        </Button>

        <span>
          Página {currentPage} de {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Próxima
        </Button>
      </div>
    </nav>
  );
}
