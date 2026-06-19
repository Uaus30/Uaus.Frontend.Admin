# Módulo de Grades e Dimensões (`features/grades`)

Este módulo gerencia o cadastro de grades (como Tamanho, Cor, Modelo, Estampa) associadas a categorias específicas para a criação de variações de estoque e produtos no sistema. Ele segue o padrão **AI-First**.

---

## 📂 Estrutura de Arquivos

*   `components/GradeTable.tsx`: Exibe o grid com a listagem de grades cadastradas, seus tipos, opções (com cores hexadecimais correspondentes) e ações de edição e deleção.
*   `components/GradeEditorModal.tsx`: Modal estruturado em Abas (Tabs) para edição de informações básicas (tipo), vinculação de categorias associadas (com busca textual e categorização rápida) e definição das opções de grade (com ordenação via drag-and-drop e suporte a edição instantânea inline).
*   `hooks/useGrades.ts`: Centraliza a busca de enumerações da API, consulta de listagem de grades, busca de categorias/departamentos, ordenação, drag-and-drop e mutations para salvar/atualizar ou deletar a grade no backend.
*   `types.ts`: Definições TypeScript locais e exportações de tipos compartilhados.

---

## ⚙️ Regras de Negócio Importantes

### 1. Tipo de Grade e Vinculação de API
*   Mapeamento de strings amigáveis para inteiros do backend:
    *   `Tamanho` -> `1`
    *   `Cor` -> `2`
    *   `Modelo` -> `3`
    *   `Estampa` -> `4`

### 2. Associação com Categoria
*   Toda grade precisa estar associada a pelo menos uma categoria do sistema.
*   Na tela de associação, as categorias selecionadas são ordenadas no topo da lista para facilitar a visualização e gestão rápida.

### 3. Gerenciamento de Variantes (Opções)
*   **Valor**: Texto obrigatório que identifica a variante (ex: `P`, `M`, `G`, `Preto`).
*   **Hexadecimal de Cor**: Obrigatório somente se a grade for do tipo `Cor`.
*   **Ordem de Exibição**: Controlada via ordenação por arrastar (drag-and-drop) das linhas. A ordem determina como as variações serão sugeridas na criação do produto.
*   **Sem Duplicados**: Valores e cores são validados para evitar entradas repetidas na mesma grade.
