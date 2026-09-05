import { ArrowRight, Loader2, Save } from "lucide-react";
import { Button } from "@workspace/ui";

type ProductDetailActionsProps = {
  saving: boolean;
  /** Voltar/cancelar — a página decide se confirma o descarte antes. */
  onCancel: () => void;
  /** Salva e, dando certo, troca para a próxima aba. */
  onAdvance: () => void;
  /** Nome da aba para onde o Avançar leva, para o botão dizer aonde vai. */
  nextTabLabel: string;
};

/**
 * Os três botões da tela de detalhe: Cancelar, Salvar e Avançar.
 *
 * Aparecem DUAS vezes — no cabeçalho e no rodapé do formulário — porque a aba
 * Dados de um produto com variações é longa, e voltar ao topo para salvar era
 * uma rolagem a cada cadastro. Os dois "Salvar" são `type="submit"` do mesmo
 * `<form>`: o Enter no campo dispara o primeiro, e os dois fazem a mesma coisa.
 *
 * **Salvar** grava e fica onde está. **Avançar** grava e vai para a próxima
 * aba — de Dados para Estoque, que é o par que o cadastro de mercadoria nova
 * percorre: cadastrar o item e lançar o que chegou dele, sem sair da tela.
 */
export function ProductDetailActions({
  saving,
  onCancel,
  onAdvance,
  nextTabLabel,
}: ProductDetailActionsProps) {
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
      <Button type="submit" variant="secondary" disabled={saving} className="hover-elevate">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar
      </Button>
      <Button
        type="button"
        disabled={saving}
        onClick={onAdvance}
        title={`Salvar e ir para ${nextTabLabel}`}
        className="bg-primary text-primary-foreground hover-elevate"
      >
        Avançar
        {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}
