# Módulo de Inventário de Produtos (`features/inventory`)

Este módulo gerencia o relatório de inventário consolidado de produtos, exibindo métricas agregadas de estoque, análises por categoria, alertas operacionais e listagem detalhada com zoom e exportação para planilhas. Ele segue a metodologia **AI-First**.

---

## 📂 Estrutura de Arquivos

*   `components/InventoryMetrics.tsx`: Renders cards com indicadores gerais (total de produtos controlados, unidades físicas, capital investido em custo, valor total em mercadoria e margem de lucro estimada).
*   `components/CategorySummary.tsx`: Renders o resumo de distribuição de estoque por categoria e os painéis de alertas operacionais de estoque baixo e zerado.
*   `components/InventoryTable.tsx`: Renders os filtros de busca, fornecedores, categorias, estado do estoque, controles de zoom de escala visual, listagem tabular dos produtos e paginação correspondente.
*   `hooks/useInventory.ts`: Centraliza chamadas para `useGetInventoryReport`, requisições adicionais de dropdowns, controle de zoom, exportações de dados para formato CSV com codificação UTF-8 BOM e tratamento de erros do servidor.
*   `types.ts`: Tipagens TypeScript locais estruturadas.

---

## ⚙️ Regras de Negócio Importantes

### 1. Inclusão de Registros no Inventário
*   O inventário exibe apenas produtos com o controle de estoque ativado no cadastro e com quantidade física de estoque positiva (> 0). Serviços e itens zerados são omitidos por padrão.

### 2. Exportação de Planilha Excel
*   Faz uma busca completa de todos os registros do filtro atual (com limite estendido) e gera uma string em formato CSV usando ponto e vírgula `;` como delimitador.
*   Inclui o caractere especial UTF-8 BOM (`\ufeff`) no início do arquivo para que editores de planilha (como o Excel) identifiquem caracteres acentuados corretamente no Windows.
*   Valores decimais e percentuais são convertidos de ponto `.` para vírgula `,` para adequação ao padrão brasileiro.

### 3. Escala Visual (Zoom)
*   Permite redimensionar o grid tabular (escala entre `70%` e `130%`) por meio da propriedade CSS `transform: scale(...)` para melhor legibilidade em telas menores ou maiores.
