# Módulo de Configurações da Empresa (`features/company-settings`)

Opções de operação da loja (`company_settings` no backend, uma linha única). Valem para todos os terminais.

---

## 📂 Estrutura de Arquivos

*   `components/CompanySettingsForm.tsx`: Formulário com os toggles e o botão de salvar. Cada opção explica a consequência prática, porque o efeito acontece no PDV e não nesta tela.
*   `hooks/useCompanySettings.ts`: Leitura (`useGetCompanySettings`), estado do formulário e a mutation de gravação.

---

## ⚙️ Regras de Negócio Importantes

### 1. Controlar caixa (`usesCashRegister`)
*   Ligado, o PDV exige abertura de caixa para vender e vincula as operações ao turno.
*   Desligado, o PDV vende sem abertura de caixa e vendas e baixas ficam **sem sessão vinculada** — deixam de aparecer no fechamento de turno.

### 2. Padrão quando não há leitura
*   O formulário assume controle de caixa **ligado** enquanto a resposta não chega, espelhando o backend: sem a linha em `company_settings`, `CompanySettingsService` devolve o padrão em vez de falhar. Um banco com schema atrasado deve deixar o PDV vender do jeito de sempre.

### 3. Sincronia com o servidor
*   O `useEffect` de sincronia depende do **valor** vindo da query, não do objeto: um refetch que traz o mesmo estado não pode apagar o toggle que o usuário ainda não salvou.
*   Ao salvar, `COMPANY_SETTINGS_QUERY_KEY` é invalidada — é o que faz a mudança chegar ao PDV sem recarregar a aplicação.
