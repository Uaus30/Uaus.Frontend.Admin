# Padrão de Calendário (Uaus Design System)

Documento canônico do padrão de calendário do Admin e do PDV. A referência
visual é a barra de filtros da tela de **Logs**: rótulo em caixa alta, gatilho
com ícone de calendário e a data em fonte mono, abrindo um painel escuro
flutuante com o dia selecionado em laranja (`--primary`).

---

## 🚫 Regra principal

**Nunca usar `<input type="date">`.** O controle nativo ignora o tema, muda de
aparência conforme o navegador e não fala português em todos eles. Toda data
passa por um dos dois componentes abaixo.

---

## 📂 Arquivos

*   `date-field.tsx`: primitivos compartilhados — portal flutuante, gatilho,
    conversão `string ↔ Date` e a guarda de dismiss do Radix. Não é usado
    direto pelas telas.
*   `date-range-picker.tsx`: `DateRangePicker` — seleção de **período**
    (início → fim). Usado em filtros de listagem.
*   `date-picker.tsx`: `DatePicker` — seleção de **uma** data. Usado em
    formulários.
*   `index.css` (raiz do app): bloco `.uaus-rdp-dark`, o tema escuro aplicado
    sobre o `react-datepicker`.

---

## 🧩 Uso em barra de filtros

O campo de período ocupa `w-64` e vem com rótulo, no mesmo bloco dos demais
filtros (`flex flex-wrap items-end gap-3`):

```tsx
<div className="flex flex-col gap-1.5 w-64">
  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
    Período
  </Label>
  <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
</div>
```

O componente **não** dispara busca sozinho: ele apenas notifica o `onChange`.
Quem decide se a tela filtra na hora (Vendas) ou só ao clicar em *Buscar*
(Logs) é o componente pai.

## 🧩 Uso em formulário

```tsx
<DatePicker
  value={parseDateInput(entryDate)}
  onChange={(date) => setEntryDate(formatDateInput(date))}
  clearable={false}   // campo obrigatório: não oferece o "x" de limpar
  className="h-10"    // alinha com inputs de 40px do formulário
/>
```

---

## ⚙️ Detalhes que evitam bug

### 1. Data como string
Filtros e payloads trafegam data como `yyyy-MM-dd`. A conversão fica na borda
do componente, com `parseDateInput` / `formatDateInput` — **não** com
`new Date("2026-07-18")`, que é lido como meia-noite UTC e, no horário de
Brasília, volta um dia no calendário.

### 2. Calendário dentro de Dialog/Popover do Radix
O painel é renderizado num portal no `document.body`, então para o Radix
clicar num dia é "clicar fora" e a camada fecharia. Quem hospeda um calendário
precisa da guarda:

```tsx
<DialogContent
  onInteractOutside={guardCalendarDismiss}
  onFocusOutside={guardCalendarDismiss}
>
```

Quando o popover existe só para abrigar o calendário, o certo é remover o
popover: o próprio `DateRangePicker` já é a camada flutuante (foi o caso do
seletor de período do Dashboard).

### 3. Posicionamento
O painel se ancora abaixo do gatilho e se reposiciona sozinho quando não cabe à
direita ou embaixo — filtros costumam ficar colados na borda da tela.

---

## 🔄 Admin e PDV

Estes componentes vivem **só aqui**. Admin e PDV os consomem por
`import { ... } from "@workspace/ui"` — nenhum dos dois apps mantém cópia
própria, e a pasta `components/ui` por app não existe mais. Alterou aqui,
valeu para os dois.

A única parte que continua duplicada é o bloco `.uaus-rdp-dark` do
`index.css` de cada app, porque é estilo global e não componente.

## 🧪 Testes

`__tests__/date-field.test.ts` cobre a conversão de datas (incluindo o
deslocamento de fuso) e a guarda de dismiss.
