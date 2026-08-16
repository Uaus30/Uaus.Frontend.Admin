# Módulo de Grades e Dimensões (`features/grades`)

Este módulo gerencia o cadastro de grades (como Tamanho, Cor, Modelo, Estampa) associadas a categorias específicas para a criação de variações de estoque e produtos no sistema. Ele segue o padrão **AI-First**.

---

## 📂 Estrutura de Arquivos

- `components/GradeTable.tsx`: Exibe o grid com a listagem de grades cadastradas, seus tipos, opções (com cores hexadecimais correspondentes) e ações de edição e deleção.
- `components/GradeEditorModal.tsx`: Modal estruturado em Abas (Tabs) para edição de informações básicas (tipo), vinculação de categorias associadas (com busca textual e categorização rápida) e definição das opções de grade (com ordenação via drag-and-drop e suporte a edição instantânea inline).
- `hooks/useGrades.ts`: Costura da tela — qual grade está aberta, quais categorias foram marcadas e o que vai no payload. Leitura e escrita vêm dos hooks do api-client.
- `hooks/useGradeVariants.ts`: Estado da tabela de opções: linha fantasma, drag-and-drop e validação de duplicidade. Saiu do `useGrades` porque são responsabilidades sem relação e juntas passavam de 400 linhas.
- `grade-type-map.ts`: Tradução entre o enum de grade do backend e o rótulo em português, e `mapDtoToGrade`.
- `types.ts`: Definições TypeScript locais e exportações de tipos compartilhados.

---

## 🔌 De onde vêm os dados

`/Grades`, `/Grades/category/{id}` e `/Grades/enums/grade-type` moram em
`packages/api-client/src/hooks/grades.ts` e chegam aqui como `useGetGrades`,
`useGetGradeTypeOptions`, `useCreateGrade`, `useUpdateGrade` e `useDeleteGrade`.

**`GET /Grades` NÃO é paginado** — é o único catálogo do sistema que devolve
lista crua. O serviço antigo do admin chamava `fetchAllPages` nesse caminho, que
lê `pagination.filteredItems` e espalha `items`: sobre um array esses campos são
`undefined`, e a varredura estourava em `[...undefined]`. Quem pagava era o
editor de produtos, que carrega o catálogo de grades por ali.

---

## ⚙️ Regras de Negócio Importantes

### 1. Tipo de Grade e Vinculação de API

- Mapeamento de strings amigáveis para inteiros do backend:
  - `Tamanho` -> `1`
  - `Cor` -> `2`
  - `Modelo` -> `3`
  - `Estampa` -> `4`

### 2. Associação com Categoria

- Toda grade precisa estar associada a pelo menos uma categoria do sistema.
- Na tela de associação, as categorias selecionadas são ordenadas no topo da lista para facilitar a visualização e gestão rápida.

### 3. Gerenciamento de Variantes (Opções)

- **Valor**: Texto obrigatório que identifica a variante (ex: `P`, `M`, `G`, `Preto`).
- **Hexadecimal de Cor**: Obrigatório somente se a grade for do tipo `Cor`.
- **Ordem de Exibição**: Controlada via ordenação por arrastar (drag-and-drop) das linhas. A ordem determina como as variações serão sugeridas na criação do produto.
- **Sem Duplicados**: Valores e cores são validados para evitar entradas repetidas na mesma grade.
- **Linha fantasma**: a última opção digitada e ainda não confirmada entra no payload ao salvar. `commitGhostRow()` DEVOLVE a lista resultante além de gravá-la no estado — ler `variants` logo depois pegaria o estado do render anterior, e era exatamente o que fazia o formulário recusar com "adicione ao menos uma opção" tendo a opção visível na tela.
- **Id de opção**: só é reenviado ao servidor o id da opção que já existia na grade. As criadas na sessão carregam um id local (`Date.now()`), e mandá-lo faria o servidor tentar atualizar uma linha que não é dele.

### 4. Confirmação de exclusão

- A pergunta é do `ConfirmDialog` do `packages/ui`, renderizado pela `GradeTable`, e diz quantas opções somem junto com a grade. O `window.confirm` que existia no hook travava a thread do navegador e não tinha como ser coberto por teste.
