# Módulo de Clientes (`features/customers`)

Este módulo gerencia a listagem, busca debounced, paginação, cadastro, edição e estatísticas de vendas por cliente no painel administrativo do sistema. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

- `components/CustomersTable.tsx`: Tabela de apresentação da base de clientes com controles de paginação e botões de ação (editar e deletar). Exibe o consolidado de compras.
- `components/CustomerEditorModal.tsx`: Modal contendo o formulário de cadastro/edição de clientes com auto-formatação do telefone onBlur.
- `hooks/useCustomers.ts`: Centraliza a consulta paginada, a busca debounced e as mutations de persistência.
- `types.ts`: Tipagens e contratos locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. O consolidado de compras é do SERVIDOR, não do navegador

A tela mostra, por cliente, **total gasto**, **número de compras** e **data da última compra**. Os três vêm somados pelo banco, em `GET /Customers/summary` (hook `useGetCustomerSummaries`, no `packages/api-client`).

Antes do item 4.1 esses números eram calculados aqui: o hook chamava `useAllSales()`, que varria a tabela de vendas **inteira** — todas as páginas, sem filtro — e somava por cliente no navegador. Quinze linhas na tela custavam a operação completa da loja em memória. E o custo crescia para sempre:

- catálogo (departamento, categoria, etiqueta) estabiliza em centenas de linhas; **venda não estabiliza nunca**;
- `fetchAllPages` **lança** ao passar de 20 mil itens, em vez de devolver a lista cortada. Meia lista de vendas não parece quebrada, parece faturamento menor — por isso ele falha em vez de truncar;
- ou seja, a tela tinha prazo de validade: parava de abrir quando a loja chegasse a 20 mil vendas.

Custo medido, contando as requisições de rede no teste do hook:

|                      | Antes                                                                   | Depois |
| -------------------- | ----------------------------------------------------------------------- | ------ |
| Requisições ao abrir | 1 + ⌈vendas ÷ 200⌉ (5 mil vendas = 26; 20 mil = 101; acima disso, erro) | **1**  |

`useCustomers.test.tsx` trava isso: ele conta as chamadas de `fetch` de verdade e falha se `/Sales` voltar a ser pedido. Reintroduzir a varredura não quebraria nenhuma tela — ela só voltaria a ficar lenta e, um dia, a não abrir.

**Total já líquido.** `totalPurchased` soma `Sale.Total`, que já teve desconto e cupom abatidos na gravação da venda. Subtrair desconto de novo contaria o abatimento duas vezes.

**Nulo é informação.** `lastPurchaseAt` é nulo para quem nunca comprou, e a tabela mostra `—`. Zerar a data faria a coluna exibir 01/01/0001 com cara de compra real.

### 2. Formato de Dados

- **Telefone**: É formatado automaticamente ao perder o foco (blur) no formulário, mantendo apenas dígitos limpos na base de dados e máscara legível na UI.

### 3. Ações

- A remoção física/lógica do cliente deve ser confirmada pelo usuário.
