# Uaus! PDV

Ponto de venda do balcão: busca de produto, carrinho, checkout com N formas de
pagamento, sessão de caixa, baixa de estoque, cupom em bobina de 80mm — e
**operação offline de verdade**.

React 19 + Vite + Tailwind 4 + Zustand + TanStack Query, com IndexedDB e service
worker.

```bash
npm run dev:pdv        # http://localhost:5174, /api → https://localhost:44398
npm run typecheck:pdv
npm run test:pdv
```

`VITE_API_PROXY_TARGET` aponta o proxy para uma API em outra porta.

O service worker é **desligado em desenvolvimento** de propósito: ele serviria
bundle antigo e atrapalharia o HMR. Para exercitar o offline é preciso o build:

```bash
npm run build:pdv && npm run preview --workspace=@workspace/pdv
```

---

## O que muda em relação ao admin

O admin é uma retaguarda: se a API cai, a tela avisa e espera. O PDV **não pode
esperar** — tem cliente no balcão. É isso que explica quase toda decisão
estranha deste app.

|                     | admin                 | pdv                                      |
| ------------------- | --------------------- | ---------------------------------------- |
| API fora            | mostra faixa e espera | continua vendendo                        |
| Fonte de dados      | só a API              | API **ou** a base local do IndexedDB     |
| Gravação            | direto                | direto **ou** fila local que sobe depois |
| Recarregar a página | precisa de rede       | abre do service worker                   |

---

## O que o caixa consegue e o que não consegue fazer sem internet

**Consegue:**

- **Abrir o app.** O bundle está no precache do service worker. Sem ele, a queda
  de energia mataria o turno: a máquina reinicia, o navegador tenta baixar o app
  e mostra tela de erro — com a base local intacta e inalcançável.
- **Buscar produto e cliente**, com preço e saldo da base local.
- **Vender.** Carrinho, desconto, N formas de pagamento, cupom impresso com
  número provisório (`OFF-14`) e a tarja "VENDA OFFLINE — Nº PROVISÓRIO".
- **Dar baixa de estoque** (consumo interno, perda, doação) pelo menu sanduíche.
- **Recarregar a página** e continuar na mesma sessão de caixa: a sessão aberta
  fica copiada na base local. Sem essa cópia, `GET /CashRegisterSessions/current`
  falharia, o PDV cairia na tela de abertura de caixa — que exige internet — e
  travaria exatamente na situação para a qual o offline existe.

**Não consegue:**

- **Fazer login.** A autenticação é do servidor. O offline cobre a queda _durante_
  o turno, não o começo dele.
- **Abrir o caixa.** A sessão é a âncora contábil da venda; uma sessão criada
  localmente teria que ser reconciliada depois, com risco de duplicar caixa.
- **Fechar o caixa** — e o fechamento é bloqueado mesmo com internet enquanto
  houver venda **ou** baixa na fila. O esperado em gaveta é calculado pelo
  servidor a partir do que ele conhece: fechar com fila pendente produz
  conferência que não fecha, e o backend depois recusaria a venda numa sessão já
  encerrada.
- **Reeditar uma venda.** Criaria duas versões da mesma venda para reconciliar. O
  caminho é cancelar depois e refazer.
- **Ver o histórico do turno**, que vem do servidor. O diálogo avisa quando há
  pendência na fila que não aparece ali.
- **Vender acima do saldo local.** A conferência de estoque roda antes de
  gravar, com a mesma regra do backend. Deixar passar significaria descobrir a
  recusa horas depois, com o cliente já fora da loja.

O documento completo — as três peças, o ciclo de vida do snapshot, cada desfecho
da sincronização e o roteiro de teste — é
[`docs/offline.md`](docs/offline.md). O contrato dos endpoints é
[`Uaus.Backend.Api/docs/pdv-offline.md`](../../../Uaus.Backend.Api/docs/pdv-offline.md).

---

## A fila é idempotente por chave de checkout

`clientReference` (UUID) é a chave primária da fila **e** a chave de idempotência
da API. Ela nasce no primeiro clique em "Confirmar" e é reutilizada em **toda
retentativa daquele mesmo checkout** — não é uma chave por tentativa.

Sem isso, o caso que dá dor: o POST chega ao servidor, o commit acontece, e a
resposta se perde num 504 do proxy. O operador clica de novo. Com chave nova, o
servidor grava uma segunda venda idêntica e o caixa fecha com dinheiro faltando.
Com a mesma chave, o índice único devolve a venda já gravada.

A chave só é descartada quando a venda confirma, é abandonada ou é pausada. A
baixa de estoque usa a mesma mecânica, com a chave presa ao rascunho do diálogo.

Duas outras regras da fila que não são óbvias:

- **Os dois caminhos debitam o estoque local.** Sem isso o caixa venderia offline
  o mesmo produto indefinidamente, e todas as vendas excedentes seriam recusadas
  na sincronização.
- **Venda recusada não é retentada sozinha.** Repetir uma recusa determinística
  (produto excluído, estoque insuficiente) só geraria ruído a cada rodada; ela
  espera decisão do operador no painel — e a recusa já devolveu o saldo local,
  que estava mentindo para baixo.

---

## Armadilha: `DATABASE_VERSION`

Em `src/offline/database.ts`. **Subir essa versão apaga as stores de catálogo**
(`products`, `paymentMethods`, `customers`); sobrevivem só `meta`, `pendingSales`
e `pendingWriteOffs`, que guardam o que **não existe em outro lugar** — movimento
que o servidor nunca viu, o sequencial dos cupons provisórios, a sessão de caixa
e as configurações da empresa.

Só suba se a **estrutura** do IndexedDB mudou (store nova, keyPath diferente).
Acrescentar um campo a um objeto **não é** mudança de estrutura. Subir por
engano faz cada caixa da rede perder o catálogo e depender de um snapshot novo —
que, sem internet, não vem.

Não confunda com o `schemaVersion` do snapshot, que é o formato dos dados vindos
do backend. Um muda sem o outro.

---

## Service worker: o que ele faz e o que ele nunca faz

Configurado no `vite.config.ts` (`vite-plugin-pwa`).

- **Precache do bundle**, com `registerType: 'autoUpdate'` — o caixa não é
  atualizado à mão, a versão nova entra sozinha na abertura seguinte.
- **`navigateFallback: 'index.html'`**, porque o PDV é SPA e um recarregamento
  offline daria 404.
- **Nenhuma requisição para `/api/` entra em cache** (`NetworkOnly`). Servir
  venda, estoque ou sessão de caixa de um cache HTTP é pior do que não responder:
  o operador decidiria sobre dado velho sem saber que é velho. Quem responde
  offline é a base local, que carrega a própria data de atualização e a exibe no
  painel "Operação offline".
- **Chunks separados por biblioteca** no build. O motivo aqui não é o primeiro
  carregamento — o PDV abre uma vez por turno. É o precache: com um arquivo só,
  uma correção de uma linha muda o hash do bundle inteiro e cada caixa rebaixa
  ~650 KB a cada deploy. Numa loja com internet ruim, isso é o caixa esperando
  para abrir.

---

## Estrutura

```
src/
├── features/pdv/    a tela do balcão: hooks, componentes e funções puras
├── offline/         base local, filas e sincronização — SEM React
├── services/        registerSale e registerWriteOff: o único caminho de escrita
├── stores/          Zustand: venda em andamento, calculadora, estado do offline
├── lib/             regras puras da tela (busca, rascunho de baixa, modo de caixa)
├── hooks/           sessão de caixa, conectividade, configurações da empresa
├── components/      diálogos do balcão (checkout, desconto, histórico, baixa)
└── pages/           login e pdv.tsx — que só compõe
```

- **`features/pdv/README.md`** documenta as regras da tela: os dois caminhos da
  venda, desconto separado do preço, taxa por parcela ativa, o cursor que
  pertence ao campo de busca, e o par único de debounce (400ms / 3 caracteres).
- **Nada em `offline/` conhece React.** As regras que valem teste — relevância da
  busca, conferência de estoque, decisão sobre cada desfecho da sincronização —
  são funções puras, testáveis sem IndexedDB e sem DOM.
- `pages/pdv.tsx` **não faz query, mutation nem conta.**

> O CLAUDE.md, seção 4, ainda diz que o PDV não usa `src/features/`. Isso deixou
> de valer em ago/2026, quando o `pdv.tsx` foi fatiado.

Pacotes do workspace consumidos aqui: `@workspace/api-client-react` (HTTP, DTOs,
hooks), `@workspace/core` (desconto, dinheiro, datas), `@workspace/receipt`
(cupom e relatório de caixa), `@workspace/ui`.

---

## Datas: hora da loja, sem fuso

Toda data enviada à API vai como `2026-07-25T17:34:12` — horário local, **sem**
`Z` e sem deslocamento, porque o backend grava em `timestamp without time zone`
no horário de Brasília.

`toISOString()` devolve UTC: a venda das 17h34 entra no painel administrativo
como 20h34. Use `toLocalTimestamp` (`services/sales.service.ts`) ou `toDateKey`
do `@workspace/core`. O formato escolhido também é lexicograficamente ordenável,
que é como a fila offline se ordena.

---

## Verificação

```bash
npm run typecheck:pdv
npm run test:pdv
npx eslint apps/pdv/src
```
