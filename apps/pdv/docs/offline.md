# PDV offline — base local e fila de vendas

O caixa não pode parar quando a internet ou a energia cai. Este documento
descreve como o PDV continua vendendo nesses momentos e como as vendas voltam
para o servidor depois.

O contrato dos endpoints está em `Uaus.Backend.Api/docs/pdv-offline.md`. Aqui é a
metade que roda no navegador.

---

## As três peças

```
┌─────────────────────────────────────────────────────────────┐
│ Service worker (vite-plugin-pwa)                            │
│   faz o PDV **abrir** sem internet                          │
├─────────────────────────────────────────────────────────────┤
│ Base local (IndexedDB)                                      │
│   produtos, formas de pagamento, clientes, estoque          │
│   → faz o PDV **vender** sem internet                       │
├─────────────────────────────────────────────────────────────┤
│ Filas de pendências (IndexedDB)                             │
│   vendas · baixas de estoque                                │
│   → fazem o movimento **chegar** ao servidor depois         │
└─────────────────────────────────────────────────────────────┘
```

As três são necessárias e nenhuma substitui as outras. Sem o service worker, a
base local é inútil depois de um reboot — o navegador tentaria baixar o app e
mostraria tela de erro. Sem a base local, o app abre mas não sabe preço nem
estoque. Sem a fila, a venda acontece e se perde.

---

## Ciclo de vida

### 1. Abertura da sessão de caixa → baixa a base local

Ao detectar uma sessão de caixa nova, `useOfflinePdv` chama `GET /Pdv/snapshot` e
**substitui o cadastro local por inteiro**. Uma vez por turno.

Não há mesclagem incremental de propósito: um produto excluído no admin precisa
desaparecer do caixa, e reconciliar diferenças abriria uma classe de bugs de
estado parcial por um ganho de desempenho que ninguém pediu.

A fila de vendas pendentes **não** é tocada — ela contém venda que o servidor
ainda não conhece.

Se a API estiver fora nesse momento, o snapshot não é baixado e a base do turno
anterior continua valendo. A data em que ela foi baixada aparece no painel
"Operação offline" para o operador julgar se confia nela.

**Abrir o caixa exige internet.** A sessão é a âncora contábil da venda; uma
sessão criada localmente teria que ser reconciliada depois, com risco de duplicar
caixa. Decisão de produto — o offline cobre a queda *durante* o turno.

Mas a sessão aberta **é guardada na base local** (`use-cash-register.ts`). Isso
cobre o cenário que dá nome ao problema: a energia volta, a máquina reinicia, a
internet ainda não voltou. Sem a cópia, `GET /CashRegisterSessions/current`
falharia, o PDV cairia na tela de abertura de caixa — que também exige internet —
e ficaria travado justamente na situação para a qual o offline existe. Com ela, o
caixa reabre na sessão certa e o cabeçalho marca "sessão da base local", avisando
que o resumo do caixa é o do último contato com o servidor.

A cópia é apagada no fechamento do caixa, para que uma sessão encerrada não
ressuscite num recarregamento offline.

**As configurações da empresa também são guardadas** (`META_KEY.companySettings`,
lidas por `hooks/use-company-settings.ts`). Elas decidem se o PDV exige abertura
de caixa — uma decisão que a primeira tela toma, antes de qualquer requisição ter
dado certo. Sem a cópia, um PDV que abre sem internet mostraria o comportamento
padrão em vez do da loja. A leitura tem três degraus: servidor → cópia local →
padrão (controle de caixa ligado, o mesmo do backend).

### 2. Venda no balcão

```
                          ┌─ online?  ── sim ─► POST /Pdv/sales ─► gravada
handlePayment ─► payload ─┤                        │
                          │                        └─ falha de REDE ─┐
                          └─ não ───────────────────────────────────►├─► fila local
                                                                     │
                          (falha com resposta HTTP = recusa de negócio, propaga)
```

`registerSale` (em `services/sales.service.ts`) é o único caminho de escrita, e
decide sozinho:

- **Online**: uma requisição atômica para `POST /Pdv/sales`. Cabeçalho, itens e
  pagamentos numa transação só.
- **Offline**: grava na fila e imprime cupom com número provisório (`OFF-14`).
- **Falha de rede no meio da requisição**: cai para a fila. Entre perder a venda e
  guardá-la para sincronizar, guardar é sempre melhor.
- **Erro que o servidor respondeu** (`ApiError` — estoque insuficiente, sessão
  fechada): propaga. Ali a venda foi recusada por regra de negócio, e enfileirá-la
  só adiaria o mesmo "não".

Nos dois caminhos o **estoque local é debitado**. Sem isso, o caixa venderia
offline o mesmo produto até o infinito e todas as vendas excedentes seriam
recusadas na sincronização.

A conferência de estoque local acontece **antes** de qualquer gravação, e a venda
offline é bloqueada quando o saldo não cobre — a mesma regra do backend, que
recusa estoque negativo. Deixar passar significaria descobrir o problema horas
depois, com o cliente já fora da loja.

### 2b. Baixa de estoque no balcão

Saída de mercadoria **sem venda** — consumo interno, perda, doação. Mesmo
desenho: `registerWriteOff` (em `services/stock-write-off.service.ts`) é o único
caminho de escrita, grava no servidor quando há conexão, cai para a fila quando a
rede falha, propaga o `ApiError` que o servidor respondeu, e debita o estoque
local nos dois casos.

O que muda em relação à venda:

- **Nada é impresso.** Baixa não tem comprovante.
- **A tela de finalização não ganha nada.** O acesso é pelo menu sanduíche, num
  diálogo próprio (`components/stock-write-off-dialog.tsx`).
- **Não vai sessão de caixa no corpo.** Quem a resolve é o servidor, e só quando
  a empresa usa controle de caixa. Baixa não exige caixa aberto — é movimento de
  estoque, não de dinheiro.
- **Inventário não aparece na lista de motivos.** Ele é gerado só pela importação
  da contagem, o único caminho autorizado a baixar acima do saldo em lote.

#### Por que uma fila própria

`pendingWriteOffs` é uma store separada, e não a fila de vendas com um
discriminador. Três razões, detalhadas em `offline/pending-write-offs.ts`: o
caminho de subida é outro (a baixa não tem endpoint de lote), os registros quase
não se sobrepõem (baixa não tem pagamento, total, desconto nem cupom), e os
desfechos são diferentes (a baixa é aceita ou recusada, sem
`Created`/`Duplicated`/`Rejected` por item).

O que as duas filas compartilham é a mecânica, de propósito: chave primária
`clientReference` (UUID, que é a chave de idempotência da API), marcador
`stockApplied`, recusa que não é retentada sozinha, e sobrevivência à migração
do schema local.

### 3. Conexão volta → sincroniza

`watchConnectivity` sonda `/Health` a cada 15s (5s quando está fora). Na
transição para online, `syncPendingQueues` drena as duas filas: as vendas em
lotes de 25 para `POST /Pdv/sales/sync`, depois as baixas uma a uma para
`POST /StockWriteOffs`.

A ordem não é acidental — se a conexão só aguentar metade da rodada, é melhor
que a metade que subiu seja a que trava o fechamento do caixa.

A baixa não tem endpoint de lote e não precisa: `POST /StockWriteOffs` é
idempotente por `clientReference` e devolve a baixa já gravada em vez de baixar
o estoque duas vezes. Recusa (`ApiError`) marca a baixa e devolve o saldo local;
falha de rede para a drenagem e deixa o resto para a próxima rodada.

Cada venda tem o seu próprio desfecho:

| Desfecho     | O que o PDV faz |
| ------------ | --------------- |
| `Created`    | tira da fila |
| `Duplicated` | tira da fila — já estava gravada (resposta de um lote anterior se perdeu) |
| `Rejected`   | mantém na fila marcada com o motivo **e devolve o estoque local** |

A devolução de estoque na recusa é importante: aquela venda não existe, então o
saldo local estava mentindo para baixo.

Uma venda recusada **não** é retentada automaticamente. Repetir uma recusa
determinística (produto excluído, estoque insuficiente) só geraria ruído a cada
rodada; ela espera decisão do operador, que pode reenfileirar ou descartar pelo
painel.

#### O marcador `stockApplied`

Cada venda da fila carrega `stockApplied`, que diz se o estoque local está
debitado por ela. Nasce `true` e vira `false` na recusa, junto com a devolução do
saldo.

Ele existe porque `status` não serve para isso: reenfileirar uma venda recusada a
devolve para `pending`, apagando o rastro de que o débito já havia sido desfeito.
Sem o marcador, uma venda recusada e depois reenviada com sucesso deixaria o
estoque local inflado até o próximo snapshot — liberando venda offline de produto
que já saiu da prateleira. `applySyncResults` usa o marcador para redebitar
quando a venda finalmente entra, e para não devolver o mesmo saldo duas vezes
numa recusa repetida.

`PendingWriteOff` carrega o mesmo marcador, com a mesma mecânica e pelo mesmo
motivo — `syncPendingWriteOffs` o consulta nos dois pontos.

### 4. Fechamento do caixa

**Bloqueado enquanto houver movimento pendente** — venda **ou** baixa de estoque.

Para a venda: o esperado em gaveta é calculado pelo servidor a partir das vendas
que ele conhece; fechar com venda na fila produziria conferência que não fecha —
e o backend recusaria depois a venda numa sessão já encerrada.

Para a baixa, o motivo é outro: ela é carimbada com a sessão aberta **na hora em
que sobe**, então subir depois do fechamento a jogaria no turno seguinte.

A tentativa de fechar dispara uma sincronização das duas filas. Se ela resolver,
o operador segue direto.

> Esta regra tem duas metades: o bloqueio aqui e a recusa de venda em sessão
> fechada no `PdvService`. Ao mexer numa, confira a outra.

---

## Arquitetura do código

```
src/
├── offline/                     ← dados e regras, sem React
│   ├── idb.ts                   wrapper de IndexedDB em Promises
│   ├── database.ts              schema: stores, versão, chaves de metadados
│   ├── meta.ts                  snapshot, sequencial de cupom, sessão, configurações
│   ├── snapshot.ts              baixa o cadastro e substitui a base local
│   ├── catalog.ts               busca de produtos e clientes na base local
│   ├── stock.ts                 projeção local do estoque
│   ├── pending-sales.ts         a fila de vendas
│   ├── sync.ts                  envio em lotes e aplicação dos desfechos
│   ├── pending-write-offs.ts    a fila de baixas de estoque
│   ├── write-off-sync.ts        envio das baixas, uma a uma
│   ├── queues.ts                as duas filas vistas como uma coisa só
│   ├── connectivity.ts          se a API responde (não só se há rede)
│   └── types.ts
├── lib/
│   ├── product-search.ts        busca de produtos (API → base local)
│   ├── write-off-draft.ts       regras da lista de itens da baixa
│   └── cash-register-mode.ts    o que as configurações da empresa mudam
├── stores/use-offline-store.ts   estado observável + ações assíncronas
├── hooks/
│   ├── use-connectivity.ts       liga o monitor ao app (uma vez, na raiz)
│   ├── use-company-settings.ts   configurações da loja: API → base local → padrão
│   └── use-offline-pdv.ts        o que a tela precisa saber e disparar
├── components/
│   ├── offline-status.tsx        indicador no cabeçalho + painel das filas
│   └── stock-write-off-dialog.tsx  a baixa, aberta pelo menu sanduíche
└── services/
    ├── sales.service.ts             registerSale: online e offline
    └── stock-write-off.service.ts   registerWriteOff: online e offline
```

**Nada em `offline/` conhece React.** As regras que valem a pena testar —
relevância da busca, conferência de estoque, decisão sobre cada desfecho da
sincronização — são funções puras (`filterProducts`, `findStockShortages`,
`readSyncStatus`, `applySyncResults`, `classifyWriteOffFailure`), testáveis sem
IndexedDB e sem DOM. As regras da tela que também são puras moram em `lib/`
(`findDraftShortages`, `resolveCashRegisterMode`), pelo mesmo motivo.

### Stores do IndexedDB

Banco `uaus-pdv-offline`, versão em `database.ts` (v2: entrou `pendingWriteOffs`):

| Store              | Chave             | Conteúdo | Sobrevive à migração? |
| ------------------ | ----------------- | -------- | --------------------- |
| `meta`             | `key`             | data do snapshot, sequencial offline, sessão de caixa, configurações da empresa | **sim** |
| `products`         | `id`              | catálogo + estoque local | recriada |
| `paymentMethods`   | `id`              | formas ativas com taxas | recriada |
| `customers`        | `id`              | clientes cadastrados | recriada |
| `pendingSales`     | `clientReference` | vendas offline | **sim** |
| `pendingWriteOffs` | `clientReference` | baixas de estoque offline | **sim** |

O critério é simples: sobrevive o que **só** existe aqui. As filas contêm
movimento que o servidor nunca viu; os metadados guardam o sequencial dos cupons
provisórios, a sessão de caixa e as configurações da empresa, que também não têm
de onde ser recuperados sem internet. O cadastro é cópia descartável — o próximo
snapshot o repovoa.

### Duas versões, não confunda

- `DATABASE_VERSION` (`database.ts`) — estrutura do IndexedDB. Suba ao mudar
  store.
- `schemaVersion` do snapshot (backend) — formato dos dados. Suba lá ao mudar o
  DTO.

Um muda sem o outro.

### Detecção de conexão

`navigator.onLine` **não** serve como fonte da verdade: ele continua `true` com o
roteador ligado e a internet caída, que é exatamente o cenário da loja. A verdade
é a sondagem em `/Health`; os eventos `online`/`offline` do navegador só disparam
uma sondagem imediata.

### O que o service worker **não** faz

Nenhuma requisição para `/api/` entra em cache (`NetworkOnly` no
`vite.config.ts`). Servir venda, estoque ou sessão de caixa de um cache HTTP seria
pior do que não responder: o operador decidiria sobre dado velho sem saber. Quem
responde offline é a base local, que carrega a própria data de atualização.

O service worker é desligado em desenvolvimento (`devOptions.enabled: false`) —
ele serviria bundle antigo e atrapalharia o HMR.

---

## Como testar o modo offline

O service worker só existe no build:

```bash
npm run build:pdv && npm run preview --workspace=@workspace/pdv
```

Depois, no navegador:

1. Faça login e abra o caixa **com internet** (a base local é baixada aqui).
2. DevTools → Network → `Offline`, ou pare a API.
3. Confirme a faixa âmbar "vendendo com a base local".
4. Busque produto, feche uma venda — o cupom sai como `OFF-1` com a tarja
   "VENDA OFFLINE — Nº PROVISÓRIO".
5. Recarregue a página ainda offline: o PDV deve abrir (service worker) e a venda
   deve continuar na fila (IndexedDB).
6. Ainda offline, abra o menu → **Baixa de Estoque**, escolha um motivo, busque um
   produto e confirme. Ela entra na fila de baixas e o estoque local já cai.
7. Volte a rede. Em até 5s a sincronização roda sozinha e avisa o resultado das
   duas filas.
8. Confira no histórico da sessão que a venda apareceu com número definitivo, e
   no admin que a baixa entrou com a **hora em que foi feita**, não com a da
   sincronização.

Para inspecionar: DevTools → Application → IndexedDB → `uaus-pdv-offline`.

---

## Onde mexer

| Precisa                                        | Arquivo |
| ---------------------------------------------- | ------- |
| Levar mais dados para a base local             | `PdvSnapshotDto` no backend, `offline/types.ts`, `offline/snapshot.ts` — e suba as duas versões |
| Mudar a relevância da busca local              | `offline/catalog.ts` → `filterProducts` (tem teste) |
| Mudar o fallback da busca de produtos          | `lib/product-search.ts` → `searchProducts` (tem teste) |
| Mudar a regra de estoque offline               | `offline/stock.ts` → `findStockShortages` (tem teste) |
| Mudar o que fazer com cada desfecho            | `offline/sync.ts` → `applySyncResults` (tem teste) |
| Mudar o tamanho do lote                        | `offline/sync.ts` → `SYNC_BATCH_SIZE` (≤ 50, limite do backend) |
| Mudar o que a baixa envia ao servidor          | `offline/write-off-sync.ts` → `buildWriteOffRequestBody` (tem teste) |
| Mudar a regra da lista de itens da baixa       | `lib/write-off-draft.ts` (tem teste) |
| Ligar o modo sem controle de caixa             | `lib/cash-register-mode.ts` — leia o bloqueio no topo do arquivo |
| Mudar o intervalo de sondagem                  | `offline/connectivity.ts` |
| Mudar o que o cupom offline mostra             | `packages/receipt/src/render.ts` (banner) e `types.ts` (`offline`) |
| Mexer em data enviada à API                    | `services/sales.service.ts` → `toLocalTimestamp` (tem teste) — leia a nota abaixo |

## Datas: hora da loja, sem fuso

Toda data enviada à API vai no formato `2026-07-25T17:34:12` — horário local,
**sem** `Z` e sem deslocamento. É a convenção do sistema inteiro: o backend grava
em `timestamp without time zone` no horário de Brasília.

Nunca use `toISOString()` para isso. Ele devolve UTC, e a venda das 17h34 entra
no painel administrativo como 20h34. Use `toLocalTimestamp` de
`services/sales.service.ts`.

O formato escolhido também é lexicograficamente ordenável (a fila offline ordena
por ele) e é relido como horário local por `new Date()` — sem fuso declarado, a
especificação manda tratar assim.

A convenção completa, incluindo o fuso do contêiner da API, está em
[`Uaus.Backend.Api/docs/fuso-horario.md`](../../../Uaus.Backend.Api/docs/fuso-horario.md).

## Limitações conscientes

- **Abrir e fechar o caixa exigem internet.** Ver as justificativas acima.
- **O modo sem controle de caixa está desligado.** `company_settings.uses_cash_register`
  já é lido e guardado na base local, e toda a tela consulta
  `lib/cash-register-mode.ts` em vez de assumir sessão obrigatória. Mas o modo não
  liga enquanto `RegisterPdvSaleRequest.EnsureIsValid()` recusar
  `cashRegisterSessionId` ≤ 0: esconder a abertura de caixa hoje trocaria um
  diálogo por uma venda impossível de gravar. Quando o backend aceitar venda sem
  sessão, vire `BACKEND_REQUIRES_SESSION_ON_SALE`. A **baixa de estoque** não tem
  esse bloqueio e já funciona sem caixa aberto.
- **Reeditar venda exige internet.** Fazer isso offline criaria duas versões da
  mesma venda para reconciliar; sem conexão, o caminho é cancelar depois e refazer.
- **O histórico da sessão vem do servidor.** Vendas na fila não aparecem nele — o
  diálogo avisa isso quando há pendências.
- **O estoque local é uma projeção.** A fonte da verdade é o servidor, com baixa
  por FIFO nos lotes de compra. O saldo local serve para bloquear venda no balcão,
  não para calcular custo.
- **Uma aba por caixa.** Duas abas do PDV na mesma máquina compartilham a base
  local e a migração de schema é bloqueada por abas abertas.
