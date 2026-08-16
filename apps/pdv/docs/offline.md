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
│   produtos, formas de pagamento, clientes, estoque, cupons  │
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
ainda não conhece. E é por isso que a instalação tem duas proteções:

1. **A fila sobe antes.** `refreshSnapshot` dispara uma sincronização e só
   depois baixa o snapshot — o estoque do servidor só fica correto depois que
   as vendas/baixas presas no navegador chegarem lá.
2. **Os débitos pendentes são re-aplicados.** O que não subiu (recusada, rede
   caiu de novo, corrida entre o GET do snapshot e o POST do lote) já debitou a
   projeção local, e o estoque que veio do servidor não sabe disso.
   `installSnapshot` re-aplica os débitos de tudo que está na fila com
   `stockApplied ≠ false` (ver `collectPendingStockDebits`). Sem isso, instalar
   o snapshot com fila pendente ressuscitava saldo que já saiu do balcão, e a
   venda offline seguinte era recusada na sincronização — com o cliente já fora
   da loja.

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

A chave de idempotência (`clientReference`) é **do checkout, não da
tentativa**: gerada no primeiro clique em "Confirmar" e reutilizada em toda
retentativa daquela venda (o estado mora em `use-pdv-store.ts`,
`saleClientReference`). Se o POST chegou ao servidor mas a resposta voltou como
erro — um 504 do proxy depois do commit —, o clique seguinte reenvia a mesma
chave e o índice único devolve a venda já gravada em vez de criar uma segunda.
A chave só é descartada quando a venda confirma (`finishSale`) ou é abandonada
(`cancelSale`, pausa, logout). A baixa de estoque segue a mesma regra, com a
chave presa ao rascunho do diálogo.

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

### 2c. Cupom de desconto no balcão

O snapshot traz os cupons vigentes **com o questionário da campanha já
resolvido**. É isso que permite ao caixa encontrar a campanha **pelo código do
cupom** sem rede: o PDV pergunta pelo código, recebe as perguntas prontas e
nunca sabe o `campaignId` — nem na base local, nem na fila, nem no payload da
venda. Quem fotografa o vínculo com a campanha é o servidor, na gravação. É essa
regra que mantém a camada mais cara de mexer (offline, fila, idempotência,
comprovante) estável a qualquer evolução do modelo de campanha.

Com internet, quem responde é `GET /Pdv/coupons/{code}`. Sem internet, é
`lookupLocalCoupon(code)` (`offline/coupons.ts`), que devolve o cupom encontrado
ou uma recusa com mensagem pronta para o operador ("Cupom expirado em 30/09/2026
às 23:59!"). A decisão em si é pura (`resolveLocalCoupon`) e testada sem
IndexedDB.

#### O que o snapshot precisa trazer

```jsonc
// PdvSnapshotDto.coupons[] — e suba PdvSnapshotDto.CurrentSchemaVersion,
// que é a ÚNICA versão que muda por causa desta feature.
{
  "couponId": 12,
  "code": "10OFFSET26",
  "description": "Setembro 2026",
  "discountType": "Percentage",          // enum; o PDV resolve para 1/2 na carga
  "discountValue": 10,
  "validFrom": "2026-09-01T00:00:00",    // instante, nunca data pura
  "validUntil": "2026-09-30T23:59:59",   // omitido = sem prazo
  "remainingAtSnapshot": 40,             // omitido = ILIMITADO, nunca "zero usos"
  "questions": [                          // já resolvidas; SEM campaignId
    { "questionId": 7, "label": "Como conheceu a loja?", "isRequired": true,
      "options": [ { "optionId": 21, "label": "Instagram" } ] }
  ]
}
```

Só cupom **ativo, não excluído e ainda vigente** entra na lista; o
questionário segue a mesma regra do `GET /Pdv/coupons/{code}` (campanha ativa e
dentro do período, senão vem vazio). O campo `coupons` inteiro é **opcional** no
PDV: um snapshot de um backend anterior a esta feature simplesmente não o traz, e
aí a base local responde "este caixa não tem a lista de cupons" em vez de "cupom
não encontrado" — ausência e lista vazia são coisas diferentes, e só a segunda
autoriza dizer que o cupom não existe.

#### O limite de uso é conferido contra o snapshot, menos a fila

```
remainingUses = remainingAtSnapshot − resgates já enfileirados neste caixa
```

`remainingAtSnapshot` **não é saldo corrente**, e o nome do campo foi escolhido
para isso: ele é o que o servidor sabia no instante em que gerou o snapshot.
Outro caixa pode ter consumido usos desde então, e nada nessa leitura reserva
coisa alguma. A subtração da fila existe porque o servidor ainda não conhece as
vendas presas aqui — sem ela, dez vendas offline com o mesmo cupom continuariam
anunciando o mesmo número de usos restantes. Entram na conta só as vendas
`pending`: uma venda `failed` foi recusada pelo servidor, então nenhum resgate
foi gravado e nenhum uso foi consumido.

#### Estourar o limite offline é ACEITO

O PDV **não recusa venda** por limite de cupom, nem quando sabe que ele já
acabou. O cliente está no balcão com o panfleto na mão, e a conta do PDV nem é a
verdade corrente. A venda entra, sobe na fila e o servidor carimba `over_limit`
no resgate (modo tolerante do sync); o relatório da campanha mostra quantos
resgates entraram por cima do teto. `overLimit` na resposta existe para a tela
**avisar**, nunca para bloquear.

> Limite de cupom é **orçamento de marketing, não estoque**. Estoque recusado
> devolve saldo e o prejuízo é de inventário; cupom recusado depois do
> pagamento não tem compensação — o cliente já pagou o valor com desconto e a
> transação do adquirente já passou. A mesma regra vale no backend: ele nunca
> recusa uma venda por causa do cupom depois que o dinheiro mudou de mãos.

#### Sanidade de relógio

Sem internet, a vigência do cupom é conferida contra o relógio da máquina — o
único que existe. `snapshotGeneratedAt` é a **hora do servidor**, gravada na
instalação do snapshot, e serve de piso: se o relógio local está antes dela, ele
está mentindo, porque aquele instante já aconteceu. Nesse caso a validação
offline do cupom é recusada por inteiro, antes mesmo de procurar o código —
numa máquina com a data errada, "cupom não encontrado" mandaria o operador
procurar o problema no panfleto do cliente em vez de no relógio.

O cenário é concreto: queda de energia com a bateria do RTC gasta. A máquina
reinicia em 2010, todo cupom vencido volta a parecer válido e todo cupom futuro
parece ainda não vigente. Há uma folga de cinco minutos porque o relógio do
caixa nunca está perfeitamente sincronizado com o do servidor, e sem folga um
atraso de três segundos recusaria todos os cupons do turno; o erro que a
conferência existe para pegar é de horas ou de anos.

**Relógio ADIANTADO continua indetectável, e isto não está resolvido.**
Descobrir que o relógio está à frente exige perguntar a hora a alguém, e
perguntar exige rede — que é o que não há aqui. Um caixa adiantado aceita um
cupom já vencido; a venda sobe, o servidor **não a recusa** (o cliente já pagou)
e grava o resgate com `definition_drift`, que é o que faz a divergência aparecer
na reconciliação e no relatório da campanha.

### 3. Conexão volta → sincroniza

`watchConnectivity` sonda `/Health` a cada 15s (5s quando está fora). Em toda
sondagem que dá online — **inclusive a primeira** —, `syncPendingQueues` drena
as duas filas: as vendas em lotes de 25 para `POST /Pdv/sales/sync`, depois as
baixas uma a uma para `POST /StockWriteOffs`.

A primeira sondagem conta de propósito: se o PDV abre já online com fila de uma
queda anterior (energia e internet voltaram antes do reboot, F5, crash do
navegador), não existe "reconexão" para disparar a subida. O custo é nulo na
abertura normal — `syncNow` é no-op com a fila vazia. E `syncNow` é serializado
por uma promise única: dois gatilhos quase simultâneos (o watcher e o
fechamento de caixa, por exemplo) compartilham a mesma rodada em vez de drenar
a fila duas vezes em paralelo.

A ordem não é acidental — se a conexão só aguentar metade da rodada, é melhor
que a metade que subiu seja a que trava o fechamento do caixa.

A baixa não tem endpoint de lote e não precisa: `POST /StockWriteOffs` é
idempotente por `clientReference` e devolve a baixa já gravada em vez de baixar
o estoque duas vezes. A falha é classificada pelo **status HTTP**
(`classifyWriteOffFailure`): recusa de regra de negócio (400/404/409/422...)
marca a baixa e devolve o saldo local; 401/408/429/5xx são transientes — o
servidor não avaliou a baixa — e param a rodada deixando-a na fila, como uma
falha de rede.

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

O fechamento (e o botão "Sair", que também é bloqueado por fila pendente) faz
**logout de verdade**: `clearAuthSession()` tira o token do navegador e
`clearLocalCatalog()` apaga o cadastro local — produtos, formas de pagamento e
clientes, que carregam nome/CPF/telefone, **e a lista de cupons de desconto**,
que carrega as perguntas da campanha. As filas e os metadados que só existem
aqui (sequencial do cupom impresso, configurações da empresa) **não** são
tocados; a fila só chega vazia nesse ponto porque a saída é bloqueada enquanto
houver pendência.

> Os cupons são o único item do cadastro que mora numa store preservada, então
> `clearAll(CATALOG_STORES)` não os alcança: quem os apaga é uma linha
> explícita em `clearLocalCatalog`. Ao mexer nessa função, confira que ela
> continua lá — a perda é silenciosa.

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
│   ├── coupons.ts               cupons de desconto e a consulta pelo código, sem rede
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
| `meta`             | `key`             | data do snapshot, sequencial offline, sessão de caixa, configurações da empresa, **cupons** | **sim** |
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

**A única exceção ao critério são os cupons de desconto**, que são cadastro
descartável e mesmo assim moram numa chave de `meta` (`META_KEY.coupons`). O
motivo está em "Por que a versão do banco não subiu", logo abaixo. A
contrapartida é que eles não são apagados por `clearAll(CATALOG_STORES)`, e por
isso `clearLocalCatalog` remove essa chave **explicitamente** — sem a linha, os
cupons e as perguntas de campanha do operador anterior sobreviveriam ao logout,
que é exatamente o que aquela limpeza existe para impedir.

### Duas versões, não confunda

- `DATABASE_VERSION` (`database.ts`) — estrutura do IndexedDB. Suba ao mudar
  store.
- `schemaVersion` do snapshot (backend) — formato dos dados. Suba lá ao mudar o
  DTO.

Um muda sem o outro.

### Por que a versão do banco NÃO subiu com os cupons

Os cupons de desconto entraram na base local **sem** subir `DATABASE_VERSION`:
ele continua em 2. Eles moram numa chave da store `meta`, e só o
`snapshotSchemaVersion` — o formato do DTO, que é decisão do backend — sobe.

Uma store `coupons` própria seria mais arrumada e custaria caro: qualquer store
nova exige `DATABASE_VERSION` 3, e a migração **apaga `products`,
`paymentMethods` e `customers` de todo caixa da rede** na primeira abertura
depois do deploy. Um caixa que abrisse essa versão sem internet ficaria sem
catálogo — sem preço, sem estoque, sem vender — justamente na situação para a
qual o offline existe. É a armadilha 4 do `CLAUDE.md`, e aqui ela seria paga por
nada: cupom é uma lista curta de registros pequenos, lida inteira a cada
consulta. Não há índice, varredura nem volume que justifique o preço.

O que a escolha cobra em troca está escrito em dois lugares no código, porque é
fácil esquecer: `clearLocalCatalog` apaga a chave à mão, e `installSnapshot`
grava a lista (ou `null`) a cada instalação, já que nenhum `clear` de store passa
por ali.

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
6. Ainda offline, aplique um **cupom de desconto** cadastrado no admin: ele é
   encontrado pelo código na base local e, se estiver ligado a uma campanha
   vigente, as perguntas aparecem — tudo sem rede. Adiante o relógio do sistema
   para depois do fim da vigência e confirme que o cupom é recusado; **atrase**-o
   para antes da data do snapshot e confirme que a validação inteira é recusada
   com o aviso de relógio.
7. Ainda offline, abra o menu → **Baixa de Estoque**, escolha um motivo, busque um
   produto e confirme. Ela entra na fila de baixas e o estoque local já cai.
8. Volte a rede. Em até 5s a sincronização roda sozinha e avisa o resultado das
   duas filas.
9. Confira no histórico da sessão que a venda apareceu com número definitivo, e
   no admin que a baixa entrou com a **hora em que foi feita**, não com a da
   sincronização. Se a venda levou cupom, confira o resgate no relatório da
   campanha — e o carimbo `over_limit` quando o limite já estava estourado.

Para inspecionar: DevTools → Application → IndexedDB → `uaus-pdv-offline`.

---

## Onde mexer

| Precisa                                        | Arquivo |
| ---------------------------------------------- | ------- |
| Levar mais dados para a base local             | `PdvSnapshotDto` no backend, `offline/types.ts`, `offline/snapshot.ts` — e suba as duas versões |
| Mudar a relevância da busca local              | `offline/catalog.ts` → `filterProducts` (tem teste) |
| Mudar a regra do cupom offline                 | `offline/coupons.ts` → `resolveLocalCoupon` (tem teste) — leia "Estourar o limite offline é ACEITO" antes |
| Mudar o que a venda envia de cupom             | `offline/sync.ts` → `toCouponBody` (tem teste) |
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
- **O limite de uso do cupom offline é uma estimativa, e a loja se organiza para
  um caixa offline por vez.** Dois caixas offline com o mesmo cupom partem do
  mesmo `remainingAtSnapshot` e não conhecem a fila um do outro. O sistema não
  finge o contrário: o estouro é aceito, carimbado no sync e visível no
  relatório da campanha.
- **Relógio adiantado no caixa não é detectável sem servidor.** O atrasado é
  (ver "Sanidade de relógio"); o adiantado aceita cupom vencido, e o desvio só
  aparece depois, como `definition_drift` no resgate.
- **Cupom desativado no meio do turno continua valendo offline.** A base local é
  do início do turno e não tem como saber da mudança. A venda entra, e é o
  servidor que registra a divergência no sync.
