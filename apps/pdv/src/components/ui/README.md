# Componentes de UI do PDV

Primitivos visuais do caixa, no mesmo tema escuro do Admin.

## Calendários

`date-field.tsx`, `date-picker.tsx` e `date-range-picker.tsx` são cópias
idênticas às do Admin e implementam o padrão único de calendário do produto:

*   `DateRangePicker` — período (início → fim), para filtros de listagem.
*   `DatePicker` — data única, para formulários.
*   **Nunca** usar `<input type="date">`.

A documentação completa do padrão (uso, conversão `string ↔ Date`, integração
com Dialog do Radix) fica em
[`apps/admin/src/components/ui/README.md`](../../../../admin/src/components/ui/README.md).

O tema escuro do calendário é o bloco `.uaus-rdp-dark` no final de
`src/index.css`. Ao alterar qualquer um desses arquivos, replique no Admin —
os dois apps precisam continuar iguais.

> Hoje nenhuma tela do PDV filtra por data. Os componentes estão prontos para a
> primeira que precisar (ex.: histórico de vendas do caixa).

## Testes

`__tests__/date-field.test.ts` cobre a conversão de datas.

Os testes de **renderização** do calendário ficam só no Admin: no harness de
testes do PDV, qualquer componente que renderize um ícone do `lucide-react`
quebra com *"Invalid hook call"* — o app tem `react` 19.2.5 no seu próprio
`node_modules` enquanto a raiz do workspace fixa 19.1.0 pelo `overrides`. É uma
limitação pré-existente da configuração de testes, não do calendário.
