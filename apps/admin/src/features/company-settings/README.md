# Módulo de Configurações da Empresa (`features/company-settings`)

Opções de operação e identidade da loja (`company_settings` no backend, uma linha única). Valem para todos os terminais.

---

## 📂 Estrutura de Arquivos

*   `components/CompanySettingsForm.tsx`: Formulário com a seção "Identidade da loja" (nome, endereço, telefone, CNPJ e mensagem de rodapé dos cupons), os toggles de operação e o botão de salvar. Cada opção explica a consequência prática, porque o efeito acontece no PDV e não nesta tela.
*   `hooks/useCompanySettings.ts`: Leitura (`useGetCompanySettings`), estado do formulário (toggle + identidade) e a mutation de gravação.

---

## ⚙️ Regras de Negócio Importantes

### 1. Identidade da loja nos cupons
*   Os cinco campos (`storeName`, `addressLine`, `phone`, `document`, `receiptFooterMessage`) saem impressos no cabeçalho e no rodapé de todo cupom — do PDV e da reimpressão do painel.
*   **Campo em branco cai no valor padrão embutido** (`resolveStoreInfo`, no pacote `@workspace/receipt`): um cadastro pela metade não imprime cupom com buraco. Os placeholders do formulário mostram exatamente esses padrões.
*   `document` é o **CNPJ cru, sem rótulo** — o cupom imprime o prefixo "CNPJ: " sozinho. O telefone, ao contrário, sai exatamente como digitado (rótulo incluso, se desejado).
*   O PUT envia o **objeto completo** (linha única, não patch por campo), com os textos já `trim`ados.

### 2. Controlar caixa (`usesCashRegister`)
*   Ligado, o PDV exige abertura de caixa para vender e vincula as operações ao turno.
*   Desligado, o PDV vende sem abertura de caixa e vendas e baixas ficam **sem sessão vinculada** — deixam de aparecer no fechamento de turno.

### 3. Padrão quando não há leitura
*   O formulário assume controle de caixa **ligado** enquanto a resposta não chega, espelhando o backend: sem a linha em `company_settings`, `CompanySettingsService` devolve o padrão em vez de falhar. Um banco com schema atrasado deve deixar o PDV vender do jeito de sempre.
*   Um backend anterior aos campos de identidade responde sem eles; o formulário os trata como vazios e o cupom continua saindo com os padrões embutidos.

### 4. Sincronia com o servidor
*   Os `useEffect` de sincronia dependem dos **valores** vindos da query, não do objeto: um refetch que traz o mesmo estado não pode apagar o que o usuário ainda não salvou.
*   Ao salvar, `COMPANY_SETTINGS_QUERY_KEY` é invalidada — é o que faz a mudança chegar ao PDV e à reimpressão de `features/sales` sem recarregar a aplicação.
