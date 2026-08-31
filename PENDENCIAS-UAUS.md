# Uaus — O que ainda falta implementar

> Situação em 09/08/2026. Referência: plano de implementação da auditoria (6 etapas).

## Panorama

| Etapa | Situação | Commits |
|---|---|---|
| **1 — Financeiro do Admin** | ✅ Concluída e publicada | front `6568a93` · back `ac5c807` |
| **0 — Correções críticas** | ✅ Concluída e publicada | front `99fec87` · back `8e39ca7` |
| **1.4 — Identidade da loja no cupom** | ✅ Concluída e publicada | front `eb6602a` · back `f0d6480` |
| **2 — Papéis e endurecimento** | 🔄 **Parcial — não commitada** | — |
| **3 — Performance** | ⏳ Não iniciada | — |
| **4 — Estrutura e DX** | ⏳ Não iniciada | — |
| **5 — Testes** | ⏳ Não iniciada (parte antecipada na Etapa 0) | — |

---

## Etapa 2 — Papéis e endurecimento (parcial, no working tree)

**Já implementado, ainda sem commit** (backend + api-client):

- Endpoints novos no `PdvController`, liberados para o papel Seller: `GET /Pdv/products/search`, `GET /Pdv/sessions/{id}/sales`, `PUT /Pdv/sales/{id}` (reedição atômica).
- `POST /Sales/complete` — criação de venda + itens + pagamentos numa transação (substitui a criação não-atômica do Admin).
- Desconto gerencial auditado: `CompanySettings.MaxSellerDiscountPercentage`, coluna `discount` por item de venda, `discount_authorized_by_user_id` na venda, validação de credenciais de administrador no `PdvService`. Script `2026-08-08_desconto_gerencial_auditado.sql` criado.
- Validade do JWT em DEBUG reduzida de 30 para 7 dias.
- api-client: tratamento global de 401 (limpa sessão e redireciona, sem tocar nas filas offline) + funções novas do contrato.
- Headers de segurança nos dois `vercel.json` (sem CSP — depende do self-host de fontes, item 4.10).

**Falta terminar:**

1. **PDV consumir o contrato novo** — busca online via `searchPdvProducts` (hoje ainda usa `GET /Products`, que dá 403 para Seller), histórico/reimpressão via `getPdvSessionSales`, reedição via `updatePdvSale`, diálogo de autorização gerencial quando o desconto excede o limite, envio do desconto por item.
2. **Admin consumir o contrato novo** — criação de venda via `createCompleteSale`, validação de quantidade contra estoque no carrinho, campo "Limite de desconto do vendedor (%)" nas Configurações.
3. **npm audit conservador** na raiz (corrigir high/critical sem major bumps).
4. Verificação integrada, commit e push das duas pontas.

---

## Etapa 3 — Performance (não iniciada)

| # | Item | Onde |
|---|---|---|
| 3.1 | Timer de 1s na raiz re-renderiza o admin inteiro a cada segundo, mesmo online — isolar o banner offline | `apps/admin/src/App.tsx` |
| 3.2 | Busca sem debounce dispara uma requisição por tecla em ~8 telas | produtos, vendas, inventário, categorias, departamentos, etiquetas, formas de pagamento, imagens |
| 3.3 | Sem code splitting: bundle único de **1,75 MB** de JS para qualquer rota (login inclusive) | `App.tsx` + `vite.config.ts` |
| 3.4 | `/produtos` baixa 7 tabelas completas para renderizar 20 linhas — precisa de endpoint enriquecido no backend | `useProductTable.ts` + backend |
| 3.5 | Relógio em `useState` re-renderiza as 2.400 linhas de `pdv.tsx` a cada segundo; store consumida sem seletor | `apps/pdv/src/pages/pdv.tsx` |
| 3.6 | Miniaturas 40×40 baixam a imagem original, sem lazy loading; `imageOptimizer` converte PNG transparente para JPEG com fundo preto e roda na main thread | admin: `ProductTable.tsx`, `lib/imageOptimizer.ts` |
| 3.7 | `fetchAllPages` pagina em série (waterfall) — paralelizar após a primeira página | `packages/api-client` |
| 3.8 | Edição inline re-baixa o catálogo completo; modal de nova venda baixa 8 tabelas | admin: produtos, vendas |
| 3.9 | Busca do PDV relê o catálogo inteiro do IndexedDB a cada consulta | `apps/pdv/src/offline/catalog.ts` |

---

## Etapa 4 — Estrutura e DX (não iniciada)

| # | Item | Observação |
|---|---|---|
| 4.1 | **CI mínimo** (GitHub Actions: typecheck + testes por PR) | Não existe `.github/` — hoje nada roda automaticamente |
| 4.2 | `strict` no `tsconfig.app.json` do PDV | O app que lida com dinheiro compila sem `strictNullChecks` |
| 4.3 | Remover o código Orval morto (`packages/api-client/src/generated/` + `custom-fetch.ts`, ~3.700 linhas) e fatiar o `index.ts` manual (já passa de 2.500 linhas) em `auth/dtos/enums/hooks` | Dois contratos paralelos com o backend |
| 4.4 | Fatiar `apps/pdv/src/pages/pdv.tsx` (~2.400 linhas, ~30 `useState`) em hooks controladores + componentes | Pré-requisito dos smoke tests (5.6) e do item 3.5 |
| 4.5 | README na raiz do monorepo + `AGENTS.md`/`CLAUDE.md` na raiz (hoje escondido em `.agents/`) + READMEs dos packages | Ponto cego para devs e agentes de IA |
| 4.6 | Extrair `@workspace/ui` — componentes duplicados entre admin e PDV já divergiram (`toast`, `dialog`, `formatters`, `utils`) | A política "replique no Admin" não se sustenta |
| 4.7 | ESLint no admin (reusar o flat config do PDV) + config do Prettier com script `format` | Admin não tem lint |
| 4.8 | Alinhar versões entre workspaces (`date-fns` 3↔4, `lucide-react`, TS 5.9↔6.0, Vite 7↔8); remover deps mortas (`zod`, `react-input-mask`, `@hookform/resolvers`) e **arquivos mortos que ainda existem**: `features/products/mockData.ts`, `apps/admin/src/lib/backend.ts`, `apps/pdv/src/lib/backend.ts` | — |
| 4.9 | Terminar de fatiar `useProductEditor.ts` (a modal virou a tela de detalhe em abas, `components/detail/`) | — |
| 4.10 | Mocks restantes: empacotar **JsBarcode** (hoje via CDN — etiqueta falha sem internet), **self-host das fontes** (PDV offline-first), URL da API por env, `roleLabels` vindo da API, remover o link morto "Esqueceu a senha?" | — |
| 4.11 | **CSP** nos `vercel.json` — adiada da Etapa 2, depende do self-host das fontes (4.10) | — |

---

## Etapa 5 — Testes (não iniciada; parte antecipada na Etapa 0)

Já coberto na Etapa 0: `snapshot`, `meta`, `use-offline-store`, `use-connectivity` no PDV, além de 63 testes de regressão nos dois apps.

**Ainda falta:**

| # | Item | Módulos sem teste hoje |
|---|---|---|
| 5.1 | Camada de persistência IndexedDB com `fake-indexeddb` — **prioridade máxima** (fila de vendas offline pode corromper em silêncio) | `pending-sales.ts`, `pending-write-offs.ts`, `idb.ts`, `database.ts`, `connectivity.ts` |
| 5.2 | Núcleo do api-client (`apiGet`/`apiPost`/`fetchAllPages`/`extractCreatedId`, parsing de erro) — só o 401 tem teste | `packages/api-client` (nenhum teste próprio) |
| 5.3 | Services do admin sem teste | `products` (265 linhas), `mappers`, `core`, `categories`, `customers`, `dashboard`, `grades`, `reports`, `suppliers`, `tags` |
| 5.4 | Feature `inventory-count` — única sem teste de hook | `useInventoryCount.ts` |
| 5.5 | Caminhos de erro nos hooks antigos do admin (nenhum testa `onError`, toast ou confirm negado) | 18 hooks de feature |
| 5.6 | Coverage (`@vitest/coverage-v8`) com threshold inicial e ratchet + smoke tests de página (depende do 4.4) | — |

---

## Pendências pontuais (fora das etapas)

- **Teste flaky no backend**: `DashboardServiceTests.Today_ComparaComOMesmoHorarioDeOntem` falha quando a suíte roda logo após a meia-noite. Pré-existente, comprovado na árvore limpa.
- **`SwaggerTest` ambiental**: falha sem um Postgres acessível ("Invalid port: 0"). Pré-existente.
- **Fallback deprecado do login por querystring** no backend: manter até os frontends em produção estarem atualizados, depois remover.
- **Filtro por tipo na tela de Imagens**: hoje carrega o catálogo completo e filtra no cliente porque `GET /Images` não aceita `type`. O ideal é o backend aceitar o parâmetro.
- **Guard do efeito de checkout no PDV** (correção da Etapa 0) ficou sem teste automatizado — depende do fatiamento de `pdv.tsx` (item 4.4).
- **Frente paralela de etiquetas de gôndola**: o frontend (`features/gondola-labels/`, `pages/gondola-labels.tsx`) segue não commitado e intocado; o backend correspondente foi junto no commit `ac5c807` por estar entrelaçado nos arquivos compartilhados.

## Decisões tomadas (não são mais pendências)

- **Segredos permanecem no `appsettings.json`** — decisão do mantenedor; sem rotação, sem env vars obrigatórias, sem alerta de startup. Registrado em `docs/seguranca-segredos.md`.
- **Custos fixos por competência mensal cheia**, sem pró-rata; o preview avisa quando o período não cobre meses inteiros.
- **Refresh token**: fora de escopo; adotado JWT curto com re-login (validade de produção segue em 1 dia).
