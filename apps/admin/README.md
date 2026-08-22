# Uaus! Admin

A retaguarda: cadastro de produtos, estoque, vendas, financeiro e sistema. É o
app que a Vercel hospeda (`vercel.json` → `npm run build:admin` →
`apps/admin/dist/public`).

React 19 + Vite + Tailwind 4 + TanStack Query + wouter.

```bash
npm run dev:admin      # http://localhost:5173, /api → https://localhost:44398
npm run typecheck:admin
npm run test:admin
```

`API_PROXY_TARGET` aponta o proxy do dev server para uma API subida por
`dotnet run` em outra porta.

---

## As features

`src/features/<nome>/` — uma pasta por assunto de negócio, hoje 25, todas com
README próprio explicando a **regra**, não a lista de arquivos:

`cash-register-sessions` · `categories` · `company-settings` · `customers` ·
`dashboard` · `departments` · `financial-closings` · `financial-reports` ·
`fixed-costs` · `gondola-labels` · `grades` · `images` · `inventory` ·
`login` · `logs` · `partners` · `payment-methods` · `products` · `sales` ·
`stock-entries` · `stock-write-offs` · `suppliers` · `tags` · `users`

O contrato de cada uma está no CLAUDE.md da raiz, seção 4. O que vale repetir
aqui:

- **A página não faz query nem mutation.** `src/pages/*.tsx` compõe e renderiza o
  que o hook devolve. Query dentro da página é o começo do caminho em que a mesma
  listagem passa a existir em dois lugares com dois `staleTime` diferentes.
- **Modelo canônico: `features/fixed-costs/`.** Copie essa, não "uma qualquer".
- As features têm teste de hook em `hooks/__tests__/`.

---

## A fronteira de dados

**Todo path HTTP, DTO, chave de cache e hook de query nasce em
`packages/api-client`.** As features consomem os hooks.

Hoje não existe um único `fetch(` em `apps/admin/src` — a fronteira está fechada
e a regra é o que a mantém assim. Ela não é sustentada pelo compilador: chamar
`fetch` à mão compila, roda e funciona no dia em que foi escrito. O que quebra
depois é a sessão (o `client.ts` centraliza 401, deduplicando o redirect quando
várias queries falham juntas) e a chave de cache (a tela salva e não atualiza).

O passo a passo para acrescentar um endpoint está em
`packages/api-client/README.md`. Depois de mexer em `packages/`, rode
`npm run build:types` antes do typecheck — o admin consome o pacote por `file:`.

### `src/services/` está congelado

12 arquivos, ~1.100 linhas, resíduo da fase anterior ao api-client. Ainda mistura
wrapper HTTP (`core.ts`), domínio puro (`mappers.ts`) e catálogo de enums, e
**roda em produção** — 33 arquivos de código ainda importam de `@/services` (49
contando os testes).

Regra: **não crie arquivo novo ali.** Precisou mexer num existente, mexa. Migrar
é tarefa própria (Onda 3).

O lint tranca a única coisa que impedia mover essa pasta: `services` não pode
importar de `@/features/*`. Dois services importavam tipos de features,
invertendo a dependência — nenhum dos dois lados podia ser movido sozinho.

---

## Rota, menu e papel saem do mesmo arquivo

`src/routes.ts` é a **fonte única**. Hoje 27 rotas, cada uma com o componente
`lazy` declarado ali, e o menu da sidebar derivado da mesma lista por
`buildMenu(role)`.

> **Isto contradiz o CLAUDE.md, seção 9, itens 5 e 6** — aquele texto descreve o
> estado anterior a ago/2026 e ainda não foi corrigido. Vale o que está aqui e no
> código.

Antes eram duas listas mantidas à mão em sincronia, e o sintoma já existia: a
tela de formas de pagamento respondia em `/formas-pagamento` e em
`/financeiro/formas-pagamento`, e só uma aparecia no menu. O caminho antigo
continua respondendo, marcado `hidden`, para não quebrar link salvo — mas fora do
menu, porque a mesma tela em dois lugares confunde mais do que ajuda.

### Autorização por papel: existe, e é conveniência

`App.tsx` embrulha toda rota privada no `AuthGate`; as que declaram `roles`
ganham o `RequireRole` por cima (`src/components/route-guards.tsx`). Restritas a
Admin hoje: relatórios, fechamentos, custos fixos, sócios, configurações, logs
(lista e detalhe) e usuários — o dinheiro da sociedade, o cadastro de usuários e
a auditoria não são assunto de operador de caixa.

Duas coisas para não entender errado:

1. **A checagem do cliente não é segurança.** Quem decide é o backend, que recusa
   esses endpoints para `Seller`. O que ela evita é o usuário abrir uma tela que
   só vai mostrar 403 — e, principalmente, ver no menu um caminho que não é dele.
   Um grupo cujos itens sejam todos restritos some inteiro: "Sistema" vazio para
   um vendedor seria pior que nada.
2. **`RequireRole` redireciona para o dashboard**, não mostra "acesso negado".
   Tela de erro não dá ao usuário nada a fazer; o dashboard todo papel abre.

O `AuthGate` mostra spinner enquanto a sessão carrega e **não** redireciona nesse
intervalo — sem essa espera, um F5 jogava o usuário logado no login por um
instante.

Rota nova = uma entrada em `ROUTES`. `src/__tests__/routes.test.ts` cobre o
conjunto.

---

## Decisões que valem para o app inteiro

**Erro 5xx tem aviso, 4xx não.** `hooks/use-api-error-toast.ts`: 500 é problema
do servidor, não há o que o usuário corrija e a tela fica vazia sem explicação;
4xx tem mensagem própria e vai para o toast de quem disparou a ação. O hook
nasceu porque quatro features reimplementavam o mesmo efeito, cada uma com um
`as any` para ler `error.status` e uma delas com texto diferente.

**Reconexão invalida só o que está na tela.** O `OfflineBanner` do `App.tsx` sonda
`/Health` e, ao voltar, chama `invalidateQueries({ type: "active" })`. Sem o
`type: "active"`, todo o cache inativo ressuscitava de uma vez — e como
invalidação ignora `staleTime`, a reconexão virava o pior momento possível para
uma tempestade de requisições.

**Chunks agrupados por frequência de mudança, não por tamanho.** As 27 rotas já
são `lazy`; o `manualChunks` do `vite.config.ts` separa framework, kit de UI e
bibliotecas pesadas (`recharts`, `react-datepicker`) do código da loja. Sem isso,
qualquer deploy invalidava no navegador o pacote inteiro de quem já tinha o app
carregado, e quem só abre a tela de clientes baixava o motor de gráficos.

---

## Dívidas conhecidas (não são bug, são escolha adiada)

- **`confirm()` nativo em exclusões.** Vários pontos ainda confirmam pelo diálogo
  do navegador, que ignora o tema e bloqueia a thread — e num deles o retorno é
  atribuído a uma const chamada `confirm`, que sombreia o global. A troca pelo
  `AlertDialog` do `@workspace/ui` está em andamento; use-o em código novo.
- **Listagem sem paginação.** `grades` renderiza todas as grades vezes
  todas as variantes (`GET /Grades` devolve array cru, sem página). As outras
  listagens são paginadas; várias delas deixam o usuário escolher 100 linhas por
  página. Nada no repositório é virtualizado.
- **Os DTOs não têm detecção de divergência com o backend.** Risco herdado do
  api-client, documentado lá.

---

## Verificação

```bash
npm run typecheck:admin      # roda build:types antes
npm run test:admin
npx eslint apps/admin/src
```
