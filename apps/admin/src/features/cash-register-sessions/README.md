# Módulo de Sessões de Caixa (Admin)

Consulta dos turnos de caixa do PDV no painel administrativo. A tela é **somente leitura**: abrir e fechar o caixa acontece no PDV; aqui o administrador acompanha abertura, fechamento e a conferência da gaveta de cada operador.

## Estrutura de Arquivos

- `types.ts`: Tipo do filtro de status da listagem e re-export dos DTOs (`CashRegisterSessionDto`, `CashRegisterSessionSummaryDto`).
- `hooks/useCashRegisterSessions.ts`: Hook controlador único — listagem paginada com filtros de status e período, detalhe da sessão selecionada e aviso via toast quando a listagem falha.
- `components/CashRegisterSessionsTable.tsx`: Barra de filtros (Select de status + `DateRangePicker`) e tabela dos turnos; clicar na linha abre o detalhe.
- `components/CashRegisterSessionDetailsDialog.tsx`: Dialog com a conferência da gaveta, o resumo consolidado das vendas do turno (`summary`), a tabela por forma de pagamento e as observações de abertura/fechamento.
- `hooks/__tests__/useCashRegisterSessions.test.tsx`: Testes unitários do hook controlador (Vitest + React Testing Library).

## Regras de Negócio

- **Turno ≠ fechamento financeiro por período** (ver feature `financial-closings`): a sessão de caixa confere a **gaveta de um operador** em um turno; o fechamento financeiro congela os números contábeis de um período inteiro. Um não substitui o outro.
- O status trafega como código numérico (`1` = Aberto, `2` = Fechado — constantes `CASH_REGISTER_SESSION_OPEN`/`CASH_REGISTER_SESSION_CLOSED` do api-client); o Select da tela trabalha com as chaves legíveis `all`/`open`/`closed` e a conversão fica em `statusFilterToCode`.
- **Diferença = contado − esperado**, calculada pelo backend no fechamento do turno. Badge verde quando a gaveta bateu (zero) e `destructive` quando houve sobra ou falta; turnos abertos ainda não têm diferença ("—").
- Só o **dinheiro em espécie** entra na conferência da gaveta: o esperado é o fundo de troco somado ao recebido em dinheiro (`summary.expectedCashAmount`); as demais formas de pagamento aparecem no resumo apenas para consulta.
- As datas do filtro trafegam como string `yyyy-MM-dd` no hook; a conversão para `Date` (e vice-versa) fica no componente, com `parseDateInput`/`formatDateInput` de `@workspace/ui`.
