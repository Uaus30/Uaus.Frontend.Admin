# Módulo de Produtos (`features/products`)

Este módulo gerencia a visualização, filtragem, criação, edição e controle de histórico de produtos e suas variações. Ele é projetado seguindo princípios **AI-First** para garantir desacoplamento estrito entre UI (Aparência) e Business Logic (Regras e Chamadas de API).

---

## 📂 Estrutura de Arquivos

*   `components/ProductTable.tsx`: Renderiza a listagem de produtos com paginação e suporte a edição rápida inline de preço e estoque.
*   `components/ProductEditorModal.tsx`: Formulário principal (Modal) para criação e edição de produtos simples ou com variações.
*   `components/ProductHistoryModal.tsx`: Modal com a linha do tempo do histórico de auditoria (criação, edições e remoção).
*   `components/CurrencyInput.tsx`: Componente de entrada controlada formatado para moeda brasileira (R$).
*   `components/ProductImagesSection.tsx`: Gerencia o upload, ordenação (drag-and-drop) e exclusão de fotos do produto.
*   `components/ProductVariationsSection.tsx`: Tabela interativa para gerenciar variações do produto (SKUs), preços individuais e associação com grades.
*   `hooks/useProductTable.ts`: Gerencia o carregamento de dados da listagem, controle de paginação, busca e chamadas de mutations para edição rápida de preço/estoque.
*   `hooks/useProductEditor.ts`: Centraliza o estado do formulário de criação/edição, geração da matriz cartesiana de variações, validações e persistência no banco.
*   `types.ts`: Tipagens TypeScript estritas que modelam os dados de formulários, imagens locais e variações.

---

## ⚙️ Regras de Negócio Importantes

### 1. Produto Simples vs. Produto com Variações
*   **Produto Simples**: Possui preço, estoque e status definidos no próprio produto principal.
*   **Produto com Variações**: O produto principal funciona apenas como um "Grupo de Produtos" (`ProductGroup`). O preço, estoque, código de barras e imagens são definidos individualmente em cada variação (SKU). É necessário ter pelo menos 2 variações cadastradas para salvar.

### 2. Geração da Matriz Cartesiana de Grades
*   Ao selecionar grades (ex: Cor, Tamanho), o hook `generateVariationsMatrix` realiza o cruzamento cartesiano de todos os variantes destas grades.
*   A matriz resultante pré-popula a tabela de variações com nomes e combinações correspondentes.
*   Se o usuário tentar salvar variações com combinações de grades repetidas, o sistema bloqueia e emite um erro de validação.

### 3. Associação de Imagens e Etiquetas (Tags)
*   As imagens do produto podem ser ordenadas via drag-and-drop. A primeira imagem é considerada a "principal".
*   Ao salvar, o sistema sincroniza de forma incremental as tags e imagens de cada variação com o servidor através das funções `syncProductTags` e `syncProductImages`.

### 4. Visibilidade Simplificada (Botão de Olho)
*   Por padrão, ao abrir a modal, os campos opcionais (**Descrição**, **Estoque mínimo/atual**, **Visibilidade** e **Etiquetas**) são ocultados para focar no fluxo principal do usuário.
*   O clique no botão de olho (no topo esquerdo ao lado do título da modal) alterna a visibilidade desses campos.
*   Os campos **Código de Barras** e **Imagens** permanecem sempre visíveis.
