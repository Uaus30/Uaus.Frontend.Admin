# Módulo de Custos Fixos (Admin)

CRUD dos custos mensais recorrentes da empresa (aluguel, contador, energia...). Eles alimentam o cálculo do lucro líquido no relatório e no fechamento financeiro: `Lucro Líquido = Lucro Bruto − Custos Fixos do período`. Contrato do backend em `Uaus.Backend.Api/docs/financeiro.md`. Rota futura: `/financeiro/custos-fixos`.

## Estrutura de Arquivos

- `components/FixedCostsTable.tsx`: Tabela com valor mensal, vigência por competência ("jan/2026 — atual"), badge Vigente/Encerrado e as ações Encerrar (só para vigentes sem fim definido), Editar e Excluir.
- `components/FixedCostEditorModal.tsx`: Formulário de cadastro/edição. As vigências usam `<input type="month">` porque a competência é mensal — o backend normaliza qualquer data para o dia 1 do mês.
- `hooks/useFixedCosts.ts`: Hook controlador único — listagem paginada (`useGetFixedCosts`, página de `PAGE_SIZE` itens) com busca debounced (300ms), estado do formulário e as mutações locais (`createFixedCost`/`updateFixedCost`/`deleteFixedCost`). Também exporta os helpers de competência (`currentMonthKey`, `formatMonth`, `isFixedCostActive`...).
- `hooks/__tests__/useFixedCosts.test.tsx`: Testes unitários do hook controlador (Vitest + React Testing Library).
- `types.ts`: Tipo do formulário (`FixedCostForm`) e re-export dos DTOs do api-client.

## Regras de Negócio

### 1. Competência mensal, sem pró-rata

- Cada mês-calendário tocado pela vigência lança o **valor mensal cheio** no fechamento — não existe cálculo proporcional por dias. Um custo vigente em agosto entra com o valor inteiro mesmo que o fechamento cubra só metade do mês (o preview do fechamento emite warning para períodos parciais).
- Por isso o formulário só pede **mês/ano** (`yyyy-MM`); o envio ao backend converte para `yyyy-MM-01`.
- Vigente no mês M: `startsOn <= M && (endsOn == null || endsOn >= M)`.

### 2. Encerrar ≠ Excluir

- **Encerrar** preenche `endsOn` com o mês atual: o custo ainda conta na competência final e sai dos meses seguintes. É o caminho normal quando um contrato acaba. Se o custo só começa num mês futuro, o encerramento usa a própria competência inicial (o backend exige `endsOn >= startsOn`).
- **Excluir** apaga a linha de vez (hard delete) — reservado para lançamentos errados. Fechamentos já confirmados **não mudam**: eles congelam os totais na confirmação e não dependem desta linha.

### 3. Busca e cache

- A busca digitada só vira filtro 300ms depois (debounce, padrão `useSuppliers`) e sempre volta para a página 1.
- Toda mutação invalida o **prefixo** da chave `["FixedCosts"]`, alcançando todas as combinações de busca/página em cache — não apenas a atual.
