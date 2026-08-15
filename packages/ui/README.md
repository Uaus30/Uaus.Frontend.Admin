# @workspace/ui

Kit visual compartilhado pelo Admin e pelo PDV. Base shadcn/ui: os componentes de
`src/components`, 3 hooks de UI (`use-mobile`, `use-toast`, `use-debounce`) e o
`cn()` — tudo exposto por um barrel único, `src/index.ts`.

Os apps importam **sempre** de `@workspace/ui`. Nenhum dos dois mantém uma pasta
`components/ui` própria: alterou aqui, valeu para os dois.

---

## O que entra e o que não entra

| Entra | Não entra |
| --- | --- |
| Componente visual, variante, acessibilidade, layout | Regra de domínio (dinheiro, data de negócio, validação) |
| Estado **da própria interface** (aberto/fechado, hover, foco) | Chamada de rede, DTO, chave de cache |
| Formatação puramente visual (classe, ícone, animação) | Import de dentro de um app (`@/...`) |

O pacote é **folha do grafo**: ele não importa nada de `@workspace/*`. Se um
componente parece precisar de `round2`, `parseAmount` ou `describeApiError`, o
cálculo pertence a quem chama — o componente recebe o valor já pronto por prop.

Sem essa fronteira o kit vira dono de regra de negócio, e a primeira tela que
precisar arredondar diferente ganha uma prop de exceção. Foi assim que o
`round2` chegou a cinco implementações antes de existir o `packages/core`.

### `@/*` é erro de lint aqui

`eslint.config.js` proíbe `@/*` dentro de `packages/`. O motivo tem nome: até
ago/2026 `sidebar.tsx` e `toaster.tsx` faziam `import ... from "@/hooks/use-mobile"`
— um alias que **só resolve dentro de um app**. O pacote compilava por acidente,
porque cada app mantinha um arquivo com o nome exato no caminho exato. O arquivo
do admin não tinha nenhum importador próprio: apagá-lo como "código morto"
quebraria o build sem um único arquivo do admin apontando o motivo. Os hooks
moram aqui desde então.

---

## O pacote é consumido em código-fonte

`exports` aponta para `./src/index.ts`. **Não há build**: o Vite de cada app
compila o TypeScript daqui junto com o dele, com as opções **dele**.

Duas consequências que já custaram tempo:

- `npm run build:types` compila `core`, `api-client` e `receipt` — **não** o
  `ui`. Não falta nada: sem `.d.ts` para gerar, não há o que compilar.
- `packages/ui/tsconfig.json` é standalone (não estende o `tsconfig.base.json`) e
  liga `strict`, `noUnusedLocals` e `noUnusedParameters`. O script `typecheck`
  existe, mas **nenhum script da raiz e nenhum passo do CI o chama**. Na prática
  essas três regras nunca rodam: um parâmetro não usado neste pacote passa pelo
  pipeline inteiro. Quem quiser exercê-las precisa rodar
  `npm run typecheck --workspace=@workspace/ui` à mão.

---

## O Tailwind precisa ser mandado escanear este pacote

O `index.css` dos dois apps tem:

```css
@source "../../../packages/ui/src";
```

Sem essa linha o Tailwind não gera as classes que aparecem **só** dentro do
pacote. Não quebra build, não quebra teste, não quebra typecheck — o componente
simplesmente chega na tela sem estilo. App novo que consumir o kit precisa da
mesma linha no primeiro dia.

---

## `sideEffects` é um ARRAY, não `false`

```json
"sideEffects": ["**/*.css", "**/date-picker.tsx", "**/date-range-picker.tsx"]
```

`date-picker.tsx` e `date-range-picker.tsx` fazem
`import "react-datepicker/dist/react-datepicker.css"` — import **puro**, sem
binding. Com `sideEffects: false` o bundler fica autorizado a descartar esse
import: o calendário continua abrindo, continua funcionando, e chega em produção
sem estilo nenhum. É a pior classe de quebra que existe aqui — não aparece em
teste, typecheck nem lint.

### Registro honesto: isto **não** está travando tree-shaking

A leitura intuitiva do array é "esses dois arquivos nunca são descartados, logo
todo app que importa o barrel carrega o `react-datepicker`". A alternativa
óbvia seria tirar o import de dentro do componente, jogar o CSS no `index.css`
de cada app e declarar `sideEffects: false`.

Não compensa, e dá para verificar sem opinião — basta olhar o que cada app
realmente empacotou:

| App | Usa `DatePicker`/`DateRangePicker`? | `react-datepicker` no bundle? |
| --- | --- | --- |
| admin | sim, em 7 features | sim — chunk `vendor-datas`, JS **e** CSS |
| pdv | **nenhum arquivo importa** | **não** — zero ocorrência de `react-datepicker__` nos bundles |

Ou seja: o PDV, que não usa calendário, já descarta os dois componentes **com o
array no lugar**. Mover o CSS para fora não liberaria tree-shaking porque não há
tree-shaking bloqueado — só trocaria uma marca declarativa por um terceiro bloco
de CSS global duplicado nos dois apps (o `.uaus-rdp-dark` já é o segundo), com o
risco de o próximo app esquecer de copiá-lo.

O array fica. Ele custa três linhas e protege o app que **usa** o calendário.

Se um dia mudar o empacotador, refaça a conferência antes de mexer aqui: rode o
build dos dois apps e procure `react-datepicker__` em `dist`.

---

## Padrão de calendário

Documento próprio, em [`src/components/README.md`](src/components/README.md):
por que `<input type="date">` é proibido, a conversão `string ↔ Date` que evita
o dia voltar um no fuso de Brasília, e a guarda de dismiss para calendário
dentro de Dialog/Popover do Radix.

---

## Testes

```bash
npm run test:ui
```

O que existe cobre o **padrão de calendário** (`__tests__/date-field.test.ts` e
`date-range-picker.test.tsx`) — uma fração mínima dos quase 40 componentes do
pacote. E esses dois passaram meses **sem rodar**: não havia script `test` aqui e
a cadeia da raiz não incluía o pacote, enquanto o README do pacote afirmava que
eles cobriam a conversão de datas. O script e o `vitest.config.ts` existem desde
ago/2026.

A leitura correta: o pacote **não** é testado. Componente novo com lógica
(variante, cálculo de posição, estado derivado, foco) traz o próprio teste, senão
a cobertura continua sendo o calendário e mais nada.

---

## Versões divergentes com o admin

Três dependências deste pacote estão declaradas em versões diferentes no
`apps/admin`, e o resultado está instalado em disco — duas cópias vivas:

| Pacote | ui declara | admin declara | Instalado |
| --- | --- | --- | --- |
| `lucide-react` | `^1.14.0` | `^0.545.0` | `packages/ui` 1.31.0 · `apps/admin` 0.545.0 |
| `date-fns` | `^4.1.0` | `^3.6.0` | raiz 4.4.0 · `apps/admin` 3.6.0 |
| `tailwind-merge` | `^3.5.0` | `^3.3.1` | raiz 3.6.0 · `packages/ui` 2.6.1 |

O admin renderiza componentes deste kit, então o bundle dele carrega os dois
majors do pacote de ícones ao mesmo tempo. Unificar é tarefa própria — mexer numa
linha dessas sem rodar o build dos dois apps troca um problema de tamanho por um
de comportamento.

---

## Onde mexer

| Precisa | Arquivo |
| --- | --- |
| Componente novo | `src/components/` **e** o export no `src/index.ts` — fora do barrel ele não existe para os apps |
| Mudar o padrão de calendário | `src/components/date-field.tsx` (primitivos) — leia `src/components/README.md` antes |
| Mudar aparência/duração de um toast | `src/components/toaster.tsx`, no mapa único de variantes |
| Novo import de CSS puro num componente | acrescente o arquivo ao `sideEffects` do `package.json` |
