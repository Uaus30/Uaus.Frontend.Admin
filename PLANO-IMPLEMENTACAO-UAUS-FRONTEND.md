# Auditoria e Plano de Implementação — Uaus Frontend (PDV + Admin)

> Gerado em 07/08/2026 a partir de auditoria multi-agente (21 agentes; estrutura, fluxos, bugs, segurança, performance, testes, mocks e gap financeiro, com verificação adversarial dos achados graves — 12 verificados, 12 confirmados, 0 refutados).

---

# PARTE 1 — DIAGNÓSTICO

## 1.1 Estrutura e manutenibilidade — **BOA, com 3 pontos fracos estruturais**

**Pontos fortes:**
- Admin: 19/19 features com o mesmo layout (`README.md` + `components/` + `hooks/` + `types.ts`), páginas finas ("página → hook controlador → componentes puros"), camada de services isolada.
- PDV: módulo `src/offline/` exemplar — TypeScript puro sem React, fila/snapshot/sync separados e testados; decisões documentadas em `apps/pdv/docs/offline.md` (379 linhas, atualizado).
- Zero acoplamento entre apps; consumo de packages só via workspace.
- `.agents/AGENTS.md` existe com diretrizes AI-first (raro e valioso).

**Pontos fracos estruturais:**
1. **`apps/pdv/src/pages/pdv.tsx` com 2.429 linhas e ~30 `useState`** — checkout, descontos, caixa, histórico e ~10 diálogos num único componente. Viola a própria regra de 300 linhas do `.agents/AGENTS.md` (21 arquivos de produção acima do limite no repo).
2. **`packages/api-client` tem dois contratos paralelos com o backend**: o cliente real é o `src/index.ts` manual (1.825 linhas); o código gerado por Orval (`src/generated/`, 3.367 linhas + `custom-fetch.ts`) está **morto, desatualizado e não exportado**. Risco de bug silencioso e confusão para agentes de IA.
3. **Duplicação admin↔pdv por cópia manual já com drift**: `toast.tsx`, `dialog.tsx`, `formatters.ts`, `utils.ts` já divergiram; a política "replique no Admin" (`apps/pdv/src/components/ui/README.md`) não se sustenta.

**Documentação:** boa no nível micro (READMEs de feature, docs do offline), **inexistente no nível macro** — sem README na raiz, sem CLAUDE.md/AGENTS.md na raiz (está escondido em `.agents/`), packages sem README.

**Tooling:** ESLint só no PDV; Prettier sem config; **`apps/pdv/tsconfig.app.json` não estende o base e compila SEM `strictNullChecks`** (o app que lida com dinheiro); **CI inexistente**; coverage não configurado.

## 1.2 Fluxos do PDV — **os 5 funcionam**, com ressalvas

| Fluxo | Status | Ressalvas |
|---|---|---|
| Venda (busca, pagamento, cupom, offline) | ✅ FUNCIONA | Busca online usa `GET /Products` (Admin-only no backend) — operador Seller recebe 403 e o fallback local não é acionado; venda com 100% de desconto é recusada só pelo servidor (pagamento R$ 0) |
| Cancelamento | ✅ FUNCIONA | Backend devolve estoque, mas o **estoque local (IndexedDB) não é devolvido**; histórico/reimpressão/edição usam endpoints Admin-only (quebra para Seller) |
| Descontos (item + venda, R$ e %) | ✅ FUNCIONA | **Sem autorização gerencial** — qualquer operador aplica até 100% sem senha/limite/trilha; desconto por item vira preço líquido (invisível na auditoria) |
| Baixa por consumo | ✅ FUNCIONA | Enum e payload 100% aderentes ao backend; idempotente; FIFO em transação |
| Baixa por perda | ✅ FUNCIONA | Idem; estorno só no Admin (por desenho) |

**Divergência de contrato mais relevante:** papéis. O backend libera para `Seller` apenas `/Pdv/*`, `/StockWriteOffs`, `/CashRegisterSessions` e `POST /Sales/{id}/cancel`, mas o PDV consome também `GET /Products`, `GET /Sales`, `PUT /Sales`, `GET|POST|DELETE /SaleItems` — todos `[Authorize(Role.Admin)]`. Com operador Admin tudo funciona; com Seller, busca online, histórico, reimpressão e reedição quebram.

**Resiliência offline:** bem desenhada (idempotência por `clientReference` no sync, contabilidade `stockApplied`, vendas antes de baixas, fechamento bloqueado com fila pendente) — mas com os bugs B1–B4 abaixo.

## 1.3 Bugs confirmados (verificação adversarial)

### PDV
- **B1 [CRÍTICO — confirmado]** `offline/snapshot.ts:95` — instalar snapshot sobrescreve o estoque local ignorando os débitos da fila offline pendente. Botão "Atualizar base local" não checa a fila → estoque local inflado → PDV offline vende sem saldo real.
- **B2 [ALTO — confirmado]** `services/sales.service.ts:226` — `clientReference` é regenerado a cada tentativa: retry manual do operador após erro 502/504 (venda já gravada) cria **venda duplicada** no servidor.
- **B3 [ALTO — confirmado]** `stores/use-offline-store.ts:154` — corrida TOCTOU em `syncNow` (guarda `syncing` só é setada após um `await`): reconexão + fechamento de caixa simultâneos rodam dois syncs em paralelo e **corrompem o estoque local** (restore duplicado).
- **B4 [ALTO]** `offline/write-off-sync.ts:57` — `classifyWriteOffFailure` trata 401/500/502/503 como recusa permanente: baixa legítima é parada e o estoque local é devolvido indevidamente.
- **B5 [ALTO]** `services/sales.service.ts:371` — `updateSale` não atômico (PUT + N×DELETE + N×POST): falha no meio deixa venda com itens parciais e total divergente.
- **B6 [MÉDIO]** `pages/pdv.tsx:942` — cancelar venda não devolve o estoque à base local (IndexedDB).
- **B7 [MÉDIO]** `pages/pdv.tsx:387` — refetch em segundo plano reseta a forma de pagamento no meio do checkout.
- **B8 [MÉDIO]** `pages/pdv.tsx:494` — desconto negativo é aceito e aumenta o total.
- **B9 [MÉDIO]** `hooks/use-connectivity.ts:34` — fila pendente não sincroniza automaticamente quando o PDV abre já online.
- **B10 [BAIXO]** `offline/meta.ts:103` — sequencial de cupom offline não atômico (números `OFF-n` podem duplicar).

### Admin
- **B11 [CRÍTICO — confirmado]** `features/products/hooks/useProductEditor.ts:643` — salvar produto **apaga a descrição do grupo no banco** (envia `description: null`) e o switch "Visível ao público" não persiste nada.
- **B12 [ALTO — confirmado]** `features/inventory/hooks/useInventory.ts:112` — exportar Excel do inventário **falha sempre** (lê `result.items` como array, mas a API devolve objeto paginado).
- **B13 [ALTO — confirmado]** `features/sales/hooks/useSales.ts:52` — filtro de período em Vendas e Baixas **exclui o último dia inteiro** (endDate `yyyy-MM-dd` vs `CreatedAt` com hora).
- **B14 [ALTO]** `services/sales.service.ts:59` — criação de venda não atômica: erro em `/SaleItems` deixa venda órfã com total cheio; carrinho não valida quantidade vs estoque.
- **B15 [MÉDIO]** `features/logs/hooks/useLogs.ts:45` — filtro de datas dos Logs deslocado 3h (usa `toISOString()` contra timestamps naive de Brasília).
- **B16 [MÉDIO]** `useProductEditor.ts:508` — efeito de grades por categoria regenera a matriz e descarta drafts de variação.
- **B17 [MÉDIO]** `lib/imageOptimizer.ts:136` — PNG com transparência vira JPEG com fundo preto.
- **B18 [MÉDIO]** `components/layout.tsx:115` — sessão expirada não redireciona (nenhum tratamento de 401).
- **B19 [MÉDIO]** `features/images/hooks/useImages.ts:63` — filtro por tipo filtra só a página atual (client-side sobre dados paginados).
- **B20-22 [BAIXO]** ordem de imagens corrompida ao salvar; edição inline envia nome do grupo no PUT do produto; `DEFAULT_DATE_RANGE` dos logs congelado no import.

## 1.4 Segurança

- **S1 [CRÍTICO — confirmado]** `packages/api-client/src/index.ts:726` + `UsersController.cs:42` — **senha do login trafega na querystring** (`POST /Users/authenticate?login=...&password=...`): vaza em logs de acesso do Vercel/proxy e histórico.
- **S2 [CRÍTICO — confirmado]** `Uaus.Api/appsettings.json:33` (backend) — **segredo de assinatura JWT, senha de banco e senha padrão commitados**. Quem tem o repo forja JWT de Admin. Exige rotação imediata.
- **S3 [ALTO — confirmado]** `pages/pdv.tsx:936` — "Sair"/fechar caixa do PDV **não faz logout**: token fica no localStorage e o IndexedDB (clientes, catálogo, vendas) não é limpo.
- **S4 [ALTO]** JWT em localStorage, validade de 1 dia (30 em DEBUG), sem refresh/revogação.
- **S5 [MÉDIO]** `vercel.json` sem headers de segurança (CSP, X-Frame-Options, HSTS).
- **S6 [MÉDIO]** Sem tratamento global de 401 no admin.
- **S7 [MÉDIO]** Operações privilegiadas no PDV (desconto ilimitado, cancelamento) sem autorização adicional.
- **S8-11 [BAIXO/MÉDIO]** npm audit com vulnerabilidades high; `escapeHtml` do cupom não escapa aspas simples; JWT backend sem validação de issuer/audience e `RequireHttpsMetadata=false`; `custom-fetch` morto usa `credentials: "include"`.

## 1.5 Performance

- **P1 [ALTO — confirmado]** `/produtos` baixa **7 tabelas completas** (produtos, categorias, tags, imagens...) via `fetchAllPages` para renderizar 20 linhas (`useProductTable.ts:40`).
- **P2 [ALTO — confirmado]** Busca dispara **1 requisição HTTP por tecla** em ~8 telas do admin (sem debounce) — o padrão com debounce já existe em `useCustomers`/`useSuppliers`, basta replicar.
- **P3 [ALTO — confirmado]** Timer de 1s em `App.tsx:110` re-renderiza o admin **inteiro a cada segundo, para sempre** (mesmo online, quando o banner nem aparece).
- **P4 [ALTO]** Admin sem code splitting: bundle único de **1,65 MB** de JS (login paga o dashboard inteiro).
- **P5 [ALTO]** Relógio em `useState` no PDV re-renderiza as 2.429 linhas de `pdv.tsx` a cada segundo.
- **P6-12 [MÉDIO/BAIXO]** `fetchAllPages` sequencial (waterfall); edição inline re-baixa o catálogo; modal de venda baixa 8 tabelas; `usePdvStore()` sem seletor; miniaturas 40×40 baixam a imagem original; busca do PDV relê o catálogo inteiro do IndexedDB; imageOptimizer na main thread.

## 1.6 Testes — **433 passando, 0 falhando** (admin 156, pdv 229, receipt 48)

- Qualidade **acima da média** nos módulos puros do PDV (`sync.test.ts`, `checkout.test.ts` excelentes); testes de hooks do admin são formulaicos e mock-pesados (não testam erro/toast/paginação).
- **Lacunas P0 (risco de dinheiro):** a camada de persistência IndexedDB (`pending-sales.ts`, `pending-write-offs.ts`, `idb.ts`, `snapshot.ts`, `database.ts`) tem **zero testes** — se a fila corromper, vendas offline somem em silêncio; `packages/api-client/custom-fetch`… na verdade o cliente manual `index.ts` (fundação de 100% das chamadas HTTP) tem zero testes diretos.
- **Coverage não configurado; CI inexistente** — os 433 testes só rodam se alguém lembrar.

## 1.7 Mocks e implementações falsas — código **majoritariamente honesto**

Dashboard 100% alimentado pela API; offline usa snapshot real; zero `TODO/FIXME` em produção. Achados:

| # | Achado | Ação | Esforço |
|---|---|---|---|
| M1 | **Identidade da loja (CNPJ/endereço/telefone) hardcoded** em todo cupom e relatório de caixa — `packages/receipt/src/store-info.ts:10` | Implementar cadastro real em CompanySettings | M |
| M2 | "Esqueceu a senha?" com `href="#"` — `LoginForm.tsx:90` | Remover (P) ou implementar fluxo (G) | P/G |
| M3 | JsBarcode via CDN na etiqueta (falha offline em silêncio) — hoje em `features/products/lib/barcode.ts` | Empacotar no bundle | P |
| M4 | Google Fonts via CDN no PDV offline-first — `apps/pdv/index.html:7` | Self-host | P |
| M5 | `mockData.ts` e 2× `backend.ts` mortos | Excluir | P |
| M6 | URL de produção hardcoded (`api-client/index.ts:436`, `vercel.json:8`) | Parametrizar por env | P |
| M7 | `roleLabels` duplicado no layout (`layout.tsx:90`) | Reusar enum da API | P |

## 1.8 Gap financeiro do Admin — **nenhuma das 4 telas pedidas existe**

O que **já existe** e ajuda muito:
- Backend: `CashRegisterSessionsController` (abertura/fechamento de caixa **por turno**, persistido, com resumo por forma de pagamento); `DashboardController` (`GET /Dashboard/overview` já devolve **faturamento, custo, lucro bruto e margem por período** — `PeriodTotalsDto`); `SaleItem.TotalCost` e `Profit` gravados por item; `PurchaseEntry` (compras) e `StockWriteOff` com custo FIFO congelado.
- api-client: hooks de sessões de caixa **já existem** (`useGetCashRegisterSessions` etc.) — o Admin simplesmente não os consome.
- Menu "Financeiro" já existe no sidebar (`layout.tsx:58-65`) com só 2 itens.

O que **não existe em nenhuma camada** (grep confirmado no backend): **Despesa genérica, Custo Fixo, Sócio, Distribuição de Lucro, Fechamento por período.**

---

# PARTE 2 — PLANO DE IMPLEMENTAÇÃO

Organizado em etapas ordenadas por risco/valor. Esforço: **P** (≤½ dia), **M** (1–3 dias), **G** (1+ semana).

## ETAPA 0 — Correções críticas (1º sprint; sem dependências)

### 0.A Segurança urgente
| # | Tarefa | Onde | Esforço |
|---|---|---|---|
| 0.1 | Login por corpo JSON (nunca querystring): DTO `[FromBody]` no backend + `apiRequest` com body no api-client | `UsersController.cs` + `api-client/index.ts:726` | P |
| 0.2 | Tirar segredos do `appsettings.json` → variáveis de ambiente; **rotacionar** chave JWT, senha do banco e `DefaultPassword`; purgar histórico git | Backend | M |
| 0.3 | Logout real no PDV: `clearAuthSession()` + fechar/limpar IndexedDB (cadastros; filas só após sync) ao sair/fechar caixa | `pdv.tsx:936` | P |

### 0.B Bugs de dinheiro/dados (todos confirmados)
| # | Tarefa | Onde | Esforço |
|---|---|---|---|
| 0.4 | Snapshot × fila offline: re-aplicar débitos pendentes após `installSnapshot` e/ou bloquear refresh com fila > 0 | `snapshot.ts:95`, `offline-status.tsx:151` | M |
| 0.5 | `clientReference` estável por checkout (gerar ao entrar no CHECKOUT, reutilizar em toda retentativa) | `sales.service.ts:226` | P |
| 0.6 | Mutex síncrono em `syncNow` (setar `syncing=true` antes de qualquer `await`, try/finally) | `use-offline-store.ts:154` | P |
| 0.7 | Classificar falha de baixa por status HTTP (401/408/429/5xx = retry; 4xx de negócio = rejected) | `write-off-sync.ts:57` | P |
| 0.8 | Corrigir `persistGroup`: enviar `description`; decidir destino do switch `isPublic` (implementar no backend ou remover da UI) | `useProductEditor.ts:643` | P |
| 0.9 | Corrigir export Excel do inventário (`result.items.items`) + cálculo de margem | `useInventory.ts:112` | P |
| 0.10 | Filtro de período inclusivo no último dia (fim do dia local ou endDate exclusivo no backend, padrão do Dashboard) — Vendas, Baixas e Logs (B13+B15) | `useSales.ts:52`, `stock-write-offs.service.ts:87`, `useLogs.ts:45` | P |

## ETAPA 1 — Funcionalidades financeiras do Admin (o pedido principal)

Fórmula de referência (única, congelada no fechamento):
**Faturamento − CMV = Lucro Bruto − Custos Fixos do período = Lucro Líquido → rateio por sócio (ex.: 75%/25%)**
Reutilizar a conta já existente em `DashboardService.GetTotalsAsync` para painel e fechamento nunca divergirem.

### 1.1 Backend (pré-requisito das telas; scripts SQL datados em `Uaus.Data/Scripts`, padrão do repo)
| # | Tarefa | Detalhe | Esforço |
|---|---|---|---|
| 1.1.1 | Entidade + CRUD `FixedCost` | `{ Name, MonthlyAmount, StartsOn, EndsOn (null = vigente), Notes, IsActive }` — vigência permite reajuste sem apagar histórico; `GET /FixedCosts?activeIn=yyyy-MM` | M |
| 1.1.2 | Entidades `Partner` + `PartnerProfitShare` | `Partner { Name, IsActive, UserId? }`; `PartnerProfitShare { PartnerId, Percentage, EffectiveFrom }` com validação **soma = 100%** (`BusinessException`); `GET/PUT /Partners/profit-shares` recebe o array completo | M |
| 1.1.3 | Entidade `FinancialClosing` + `FinancialClosingPartnerShare` | `{ PeriodStart, PeriodEnd, Revenue, CogsCost, GrossProfit, FixedCostsTotal, WriteOffLosses, NetProfit, Status (Draft/Confirmed), ClosedByUserId, ClosedAt }`; shares com **percentual congelado** no fechamento (mudar a divisão depois não reescreve fechamentos antigos — mesma filosofia do `StockWriteOff.TotalCost`) | G |
| 1.1.4 | Endpoints de fechamento | `POST /FinancialClosings/preview` (calcula sem gravar, reutilizando `GetTotalsAsync`), `POST /FinancialClosings` (confirma), `GET` lista/detalhe; recusar períodos sobrepostos | M |
| 1.1.5 | Endpoint consolidado `GET /FinancialReports/summary?startDate&endDate` | Junta PeriodTotals + compras (`PurchaseEntries`) + perdas (`StockWriteOffs`) + custos fixos numa resposta (evita orquestrar 3+ chamadas no front) | M |
| 1.1.6 | Tudo `[Authorize(Role.Admin)]` | Padrão do Dashboard | — |

Decisão a validar com o dono: custos fixos em período parcial — **pró-rata** ou competência mensal simples (recomendo competência mensal: fechamento sempre por mês cheio).

### 1.2 api-client (`packages/api-client/src/index.ts`, padrão manual atual)
| # | Tarefa | Esforço |
|---|---|---|
| 1.2.1 | DTOs + hooks React Query: FixedCosts, Partners/ProfitShares, FinancialClosings (preview/confirm/list/detail), FinancialReports summary | M |

### 1.3 Telas do Admin (feature-based, padrão `features/dashboard`; menu "Financeiro" já existe)
| # | Tela | Detalhe | Esforço | Depende de |
|---|---|---|---|---|
| 1.3.1 | `/financeiro/caixas` — sessões de caixa | **Ganho rápido: API e hooks já prontos** (`useGetCashRegisterSessions`); lista de turnos com filtros, detalhe com resumo por forma de pagamento e diferença de gaveta | M | nada |
| 1.3.2 | `/financeiro/relatorios` — relatórios financeiros | Seletor de período, cards Faturamento / Gastos (compras + perdas + custos fixos) / Lucro Bruto / Lucro Líquido, quebras por forma de pagamento e categoria, exportação | M-G | 1.1.5 |
| 1.3.3 | `/financeiro/custos-fixos` — CRUD com vigência | Lista + modal, campo mensal, vigência de/até | M | 1.1.1 |
| 1.3.4 | `/financeiro/socios` — sócios e distribuição | Cadastro de sócios + percentuais com validação de soma 100% (ex.: 75/25), histórico de vigências | M | 1.1.2 |
| 1.3.5 | `/financeiro/fechamentos` — fechamento por período | Fluxo preview → confirmação; demonstrativo Faturamento − CMV = Lucro Bruto − Custos Fixos = Lucro Líquido + rateio por sócio (R$ por sócio); fechamentos confirmados imutáveis | G | 1.1.3-4, 1.3.3-4 |

### 1.4 Identidade da loja no cupom (mock → real; encaixa aqui por mexer em CompanySettings)
| # | Tarefa | Esforço |
|---|---|---|
| 1.4.1 | Campos de identidade (nome, endereço, telefone, CNPJ, rodapé) em `CompanySettings` (backend + tela company-settings do admin) e alimentar `ReceiptData.store` no PDV e na reimpressão do admin, com cache offline | M |

## ETAPA 2 — Contrato de papéis e endurecimento

| # | Tarefa | Onde | Esforço |
|---|---|---|---|
| 2.1 | Resolver divergência Seller×Admin: ou liberar para Seller os endpoints que o PDV usa (busca de produtos limitada, histórico da própria sessão) ou criar endpoints `/Pdv/*` dedicados (recomendado: `GET /Pdv/products/search`, `GET /Pdv/sessions/{id}/sales`) | Backend + PDV | M |
| 2.2 | Autorização gerencial para desconto no PDV (limite % configurável + PIN de gerente acima do limite) e trilha de auditoria (persistir desconto por item em vez de só preço líquido) | PDV + backend | G |
| 2.3 | Tratamento global de 401 no admin (interceptor no api-client → redirect para login) e no PDV | api-client | P |
| 2.4 | Headers de segurança nos dois `vercel.json` (CSP, X-Frame-Options, HSTS, Referrer-Policy) | raiz + apps/pdv | P |
| 2.5 | Encurtar validade do JWT + refresh token com rotação (ou no mínimo re-login diário no PDV) | Backend + api-client | G |
| 2.6 | `updateSale` atômico: endpoint transacional `PUT /Pdv/sales/{id}` (mesmo padrão do POST) e usar no PDV; idem criação de venda do admin (B14) | Backend + PDV + Admin | M |
| 2.7 | Cancelamento devolve estoque local + demais médios do PDV (B6, B7, B8, B9) | PDV | M |
| 2.8 | npm audit: subir deps com vulnerabilidade high | raiz | P |

## ETAPA 3 — Performance

| # | Tarefa | Onde | Esforço |
|---|---|---|---|
| 3.1 | Isolar banner/countdown offline do admin (timer só quando offline, fora da árvore principal) | `App.tsx:110` | P |
| 3.2 | Debounce de busca nas ~8 telas (replicar padrão de `useCustomers`) + `keepPreviousData` | admin | P |
| 3.3 | Code splitting por rota no admin (`React.lazy` + `Suspense`) — tira recharts e editor de produtos do caminho do login (1,65 MB → ~centenas de KB) | `App.tsx` | P |
| 3.4 | `/produtos`: backend devolver página de grupos enriquecida (ou buscar só registros relacionados aos 20 exibidos); parar de baixar 7 tabelas | backend + `useProductTable.ts` | M-G |
| 3.5 | Extrair `<Clock />` no PDV e seletores no `usePdvStore` | `pdv.tsx` | P |
| 3.6 | Miniaturas: thumbnail no backend ou `loading="lazy"` + `srcset`; imageOptimizer preservar PNG/WebP (junto com B17) | admin | M |
| 3.7 | `fetchAllPages` paralelo (buscar página 1, depois demais em `Promise.all`) | api-client | P |

## ETAPA 4 — Qualidade estrutural e DX

| # | Tarefa | Esforço |
|---|---|---|
| 4.1 | **CI mínimo** (GitHub Actions): `typecheck:admin` + `typecheck:pdv` + `npm test` (+ lint pdv) por PR — pré-requisito para todo o resto valer a pena | P |
| 4.2 | **Strict no PDV**: `tsconfig.app.json` estender o base + `strict: true` (corrigir erros que aparecerem) | M |
| 4.3 | **Resolver api-client**: apagar `src/generated/` + `custom-fetch.ts` mortos (3,7k linhas) OU readotar Orval regenerado; fatiar `index.ts` em `auth.ts` / `dtos.ts` / `enums.ts` / `hooks.ts` | M |
| 4.4 | **Fatiar `pdv.tsx`** (2.429 linhas → hooks controladores + `CheckoutPanel`, `DiscountDialog`, `CashRegisterDialogs`, `SalesHistorySheet`) — fazer antes/junto dos itens 2.2 e 2.7 para não retrabalhar | G |
| 4.5 | README na raiz (mapa dos 4 workspaces + scripts) + mover/linkar `.agents/AGENTS.md` para `AGENTS.md`/`CLAUDE.md` na raiz; README nos packages | P |
| 4.6 | Extrair `@workspace/ui` (ou ao menos os arquivos hoje idênticos) para estancar o drift admin↔pdv | M |
| 4.7 | ESLint no admin (reusar flat config do pdv) + Prettier com script `format` | P |
| 4.8 | Alinhar versões (date-fns 3→4, lucide, TS 5.9/6.0, vite 7/8); remover deps mortas (`zod`, `react-input-mask`, `@hookform/resolvers`…) e arquivos mortos (`mockData.ts`, 2× `backend.ts`) | P |
| 4.9 | Terminar de fatiar `useProductEditor.ts` (a modal virou tela de detalhe em abas: `components/detail/`) | M |
| 4.10 | Demais mocks: JsBarcode no bundle (M3), fontes self-hosted (M4), URL por env (M6), roleLabels da API (M7), remover "Esqueceu a senha?" (M2) | P |

## ETAPA 5 — Testes

| # | Tarefa | Prioridade | Esforço |
|---|---|---|---|
| 5.1 | Testar camada IndexedDB com `fake-indexeddb`: `pending-sales`, `pending-write-offs`, `idb`, `snapshot`, `database` (hoje 100% mockados — vendas offline podem sumir sem nenhum teste acusar) | **P0** | M |
| 5.2 | Testes dos bugs da Etapa 0 (regressão): snapshot×fila, idempotência de checkout, mutex de sync, classificação de falha de baixa, persistGroup, export inventário, filtros de data | **P0** | M |
| 5.3 | Testar o núcleo do api-client manual (`apiGet/apiPost/fetchAllPages/extractCreatedId`, parsing de erro) | **P0** | M |
| 5.4 | `use-offline-store` (orquestrador sem teste) + services do admin sem teste (products, mappers) + feature `inventory-count` | P1 | M |
| 5.5 | Elevar hooks do admin ao padrão do PDV: caminhos de erro, toasts, confirm negado, paginação | P2 | G |
| 5.6 | Coverage (`@vitest/coverage-v8`) com threshold inicial ~40% e ratchet; smoke tests de página (após 4.4) | P2 | M |

## Sequência sugerida

1. **Sprint 1:** Etapa 0 inteira + 4.1 (CI) + 5.2 (testes de regressão dos fixes) — destrava tudo com segurança.
2. **Sprint 2–3:** Etapa 1 backend (1.1) em paralelo com 1.3.1 (caixas, ganho rápido) e Etapa 3 itens P (3.1, 3.2, 3.3, 3.5).
3. **Sprint 4–5:** Etapa 1 telas (1.3.2–1.3.5) + 1.4 (cupom real).
4. **Contínuo:** Etapa 2 (2.1 e 2.6 primeiro), Etapa 4 (4.2–4.4 antes de mexer pesado no PDV), Etapa 5.
