# Módulo de Visão Geral (`features/dashboard`)

Este módulo implementa o painel de faturamento consolidado, contendo KPIs operacionais, gráficos de linha/área para faturamento versus lucros, gráficos circulares (pizza) para categorias de produtos mais vendidas e listagem com micro-animações dos produtos mais vendidos. Ele segue o padrão **AI-First**.

---

## 📂 Estrutura de Arquivos

*   `components/PeriodSelector.tsx`: Seletor de período por dropdown pré-configurado ou popover para intervalo de datas personalizado (data inicial e final).
*   `components/DashboardMetrics.tsx`: Renders cards de faturamento, quantidade de vendas, ticket médio e lucro estimado com comparativos percentuais contra períodos anteriores.
*   `components/DashboardCharts.tsx`: Painéis com gráficos interativos do Recharts (AreaChart e PieChart).
*   `components/TopProductsTable.tsx`: Tabela com animações Framer Motion apresentando os produtos campeões de vendas e seus respectivos níveis de estoque.
*   `hooks/useDashboard.ts`: Controla a filtragem de períodos de tempo, preenchimento de campos de data customizados, e sincronização de dados mockados.
*   `types.ts`: Tipagens estruturadas locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Períodos Disponíveis
*   **7 dias**: Últimos 7 dias.
*   **30 dias**: Últimos 30 dias.
*   **90 dias**: Últimos 90 dias.
*   **1 ano**: Último ano.
*   **Personalizado**: Datas livres selecionadas via calendário/input date.

### 2. Layout Premium e Cores dos Gráficos
*   Utilização de gradientes no gráfico de faturamento e lucro.
*   Gráfico de categorias com paleta de cores harmônica mapeada do HSL do CSS.
*   Animação gradual (delay de entrada) para as linhas dos produtos mais vendidos na tabela principal.
