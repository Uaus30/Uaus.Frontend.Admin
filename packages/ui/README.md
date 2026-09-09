# @workspace/ui

Kit visual compartilhado pelo Admin, pelo PDV e pela Loja. Base shadcn/ui: os
componentes de `src/components`, 4 hooks de UI (`use-mobile`, `use-toast`,
`use-debounce`, `use-page-title`) e o `cn()` — tudo exposto por um barrel único,
`src/index.ts`.

O `usePageTitle` escreve `document.title` num efeito. Ele mora aqui porque os
três apps precisam do mesmo comportamento e porque o título é o que o
**histórico do navegador** mostra: com o título fixo do `index.html`, as vinte e
cinco telas do admin apareciam no histórico como "Painel Administrativo", todas
iguais. Passar `undefined` mantém o título anterior em vez de piscar um genérico
enquanto o dado carrega.

Os apps importam **sempre** de `@workspace/ui`. Nenhum dos dois mantém uma pasta
`components/ui` própria: alterou aqui, valeu para os dois.

---

## O que entra e o que não entra

| Entra                                                         | Não entra                                               |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Componente visual, variante, acessibilidade, layout           | Regra de domínio (dinheiro, data de negócio, validação) |
| Estado **da própria interface** (aberto/fechado, hover, foco) | Chamada de rede, DTO, chave de cache                    |
| Formatação puramente visual (classe, ícone, animação)         | Import de dentro de um app (`@/...`)                    |

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
  liga `strict`, `noUnusedLocals` e `noUnusedParameters`. Ele roda por conta
  própria: `npm run typecheck:ui` na raiz e um passo dedicado no job `typecheck`
  do CI. É um programa SEPARADO do de cada app — o que os apps declaram no
  tsconfig deles (por exemplo `types: ["vite/client"]`) não vale aqui, e por isso
  este pacote precisa declarar o que usa. Ver `src/assets.d.ts`.

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

| App   | Usa `DatePicker`/`DateRangePicker`? | `react-datepicker` no bundle?                                 |
| ----- | ----------------------------------- | ------------------------------------------------------------- |
| admin | sim, em 7 features                  | sim — chunk `vendor-datas`, JS **e** CSS                      |
| pdv   | **nenhum arquivo importa**          | **não** — zero ocorrência de `react-datepicker__` nos bundles |

Ou seja: o PDV, que não usa calendário, já descarta os dois componentes **com o
array no lugar**. Mover o CSS para fora não liberaria tree-shaking porque não há
tree-shaking bloqueado — só trocaria uma marca declarativa por um terceiro bloco
de CSS global duplicado nos dois apps (o `.uaus-rdp-dark` já é o segundo), com o
risco de o próximo app esquecer de copiá-lo.

O array fica. Ele custa três linhas e protege o app que **usa** o calendário.

Se um dia mudar o empacotador, refaça a conferência antes de mexer aqui: rode o
build dos dois apps e procure `react-datepicker__` em `dist`.

---

## Clicar no toast copia o relatório dele

Um clique em qualquer toast copia para a área de transferência o que está na
tela **mais** o detalhe técnico que a frase descarta, e mostra uma marca d'água
"Copiado" por no mínimo três segundos. Existe para encurtar o relato de
problema: sem isso o que chega ao suporte é uma foto da tela, sem rota, sem
horário, sem status HTTP e sem a resposta do servidor.

```
[ERRO] Erro ao entrar
Mensagem: Usuário não encontrado!
Quando: 09/09/2026, 15:24:30
Tela: admin-dev.uaus.com.br/login
Versão: 3.0.2

Requisição: POST /Users/authenticate
Status HTTP: 404
Exceção: ApiError: Usuário não encontrado!
Resposta: {"Id":"2cfc53fb-…","Code":404,"Title":"NotFoundException",…}
```

O bloco técnico só aparece quando o chamador passa o **erro cru** no campo
`error` do `toast({ … })` — opcional porque a maior parte das recusas é
validação de formulário, onde não existe exceção nenhuma:

```ts
toast({
  title: "Erro ao salvar o cupom",
  description: describeApiError(error), // a frase para o usuário
  error, // o status, a rota e a resposta, para quem for depurar
  variant: "destructive",
});
```

Três decisões deste componente valem registro, porque desfazê-las não quebra
teste nenhum:

- **Quem fecha o toast é um `setTimeout`, não o `requestAnimationFrame`.** O
  quadro só roda quando a página é pintada — numa aba em segundo plano ele
  simplesmente não é chamado. Enquanto o Radix mantinha o cronômetro dele isso
  não aparecia; agora que a contagem daqui é a única (`duration={Infinity}` no
  Root), prender o fechamento ao quadro deixaria o toast para sempre na tela.
  O quadro ficou só com a barra de progresso, que pode parar sem consequência.
- **A marca d'água não usa `animate-in fade-in-0`.** Ela começaria em
  `opacity: 0` e só chegaria a 1 se a animação rodasse; onde não roda, o clique
  parece não ter feito nada. Confirmação de ação não depende de animação.
- **A pausa é por `pointerType === "mouse"`.** Em tela de toque o `mouseenter`
  sintético fica grudado depois do toque: no PDV, tocar no toast para copiar o
  deixaria preso na tela até alguém achar o X.

O texto copiado é montado por `src/lib/toast-report.ts` — função pura, com
teste, e com plano B por campo oculto para o contexto não seguro (um terminal
alcançado pelo IP da rede da loja não tem `navigator.clipboard`).

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
`date-range-picker.test.tsx`) e o **toast copiável** (`__tests__/toaster.test.tsx`
e `lib/__tests__/toast-report.test.ts`) — uma fração dos quase 40 componentes do
pacote. E os do calendário passaram meses **sem rodar**: não havia script `test`
aqui e a cadeia da raiz não incluía o pacote, enquanto o README do pacote
afirmava que eles cobriam a conversão de datas. O script e o `vitest.config.ts`
existem desde ago/2026.

A leitura correta: o pacote **não** é testado. Componente novo com lógica
(variante, cálculo de posição, estado derivado, foco) traz o próprio teste, senão
a cobertura continua sendo o calendário e mais nada.

---

## Imagem dentro do pacote

`src/assets/` guarda a arte que pertence a um componente daqui — hoje só a do
`NotFoundScreen`, a tela de rota inexistente que os três apps renderizam. Ela
mora no pacote, e não no `public/images/` de cada app, pelo mesmo motivo do
componente: uma cópia por app significa três arquivos para trocar quando a arte
mudar, e o esquecido vira a tela de um app só.

Duas exigências vêm junto:

- **Importe, não escreva o caminho.** `import img from "../assets/x.png"` deixa o
  Vite versionar o arquivo (hash no nome) e o Rollup incluí-lo no bundle. Uma
  string `/images/x.png` daqui apontaria para o `public/` do app que estivesse
  consumindo — que não tem o arquivo.
- **`src/assets.d.ts` declara `*.png`.** O `typecheck` deste pacote não carrega
  os tipos do Vite (ver a seção acima); sem a declaração ele reprova sozinho,
  enquanto os três apps passam.

O PNG entra otimizado: a arte do 404 veio em 1224 px e 229 KB e foi para 512 px
com paleta de 192 cores, 30 KB. O componente a exibe em no máximo 260 px, então
512 px já é o dobro para telas densas — o resto era peso que os três bundles
carregariam.

---

## Versões divergentes com o admin

Três dependências deste pacote estão declaradas em versões diferentes no
`apps/admin`, e o resultado está instalado em disco — duas cópias vivas:

| Pacote           | ui declara | admin declara | Instalado                                   |
| ---------------- | ---------- | ------------- | ------------------------------------------- |
| `lucide-react`   | `^1.14.0`  | `^0.545.0`    | `packages/ui` 1.31.0 · `apps/admin` 0.545.0 |
| `date-fns`       | `^4.1.0`   | `^3.6.0`      | raiz 4.4.0 · `apps/admin` 3.6.0             |
| `tailwind-merge` | `^3.5.0`   | `^3.3.1`      | raiz 3.6.0 · `packages/ui` 2.6.1            |

O admin renderiza componentes deste kit, então o bundle dele carrega os dois
majors do pacote de ícones ao mesmo tempo. Unificar é tarefa própria — mexer numa
linha dessas sem rodar o build dos dois apps troca um problema de tamanho por um
de comportamento.

---

## Onde mexer

| Precisa                                | Arquivo                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Componente novo                        | `src/components/` **e** o export no `src/index.ts` — fora do barrel ele não existe para os apps |
| Mudar o padrão de calendário           | `src/components/date-field.tsx` (primitivos) — leia `src/components/README.md` antes            |
| Mudar aparência/duração de um toast    | `src/components/toaster.tsx`, no mapa único de variantes                                        |
| Mudar o que o clique no toast copia    | `src/lib/toast-report.ts` — função pura; o componente só lê o texto do DOM e chama              |
| Novo import de CSS puro num componente | acrescente o arquivo ao `sideEffects` do `package.json`                                         |
| Imagem nova de um componente           | `src/assets/`, importada pelo componente — nunca `public/` de um app                            |
