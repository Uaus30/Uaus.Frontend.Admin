# Regras do repositório (AI-First)

Monorepo dos frontends da Uaus. Este arquivo é carregado automaticamente por
agentes de IA — as regras estão aqui **em texto**, não por link, porque um
ponteiro que ninguém segue não é regra.

---

## 1. Git é automático — com três freios

> Esta regra foi **invertida** em 16/08/2026, a pedido do dono do repositório.
> Antes proibia commit e push autônomos. Se você viu a versão antiga em algum
> resumo ou memória, vale esta.

**Fluxo padrão, sem pedir permissão:** `git pull` antes de começar, `git commit`
e `git push` quando o trabalho estiver concluído e verificado. Direto na `main`,
que é o que o histórico dos dois repositórios da Uaus já faz — sem branch, sem
PR. Outros comandos de git entram quando forem necessários.

Vale o mesmo no repositório vizinho `Uaus.Backend.Api`, que tem cópia desta
seção no CLAUDE.md dele.

### Os três freios — pare e mostre antes de commitar

1. **Gate vermelho.** Teste, `typecheck` ou `lint` falhando. Conserte primeiro;
   nunca suba quebrado. Os comandos e o smoke test obrigatório estão na seção 8.
2. **Migração de banco ou de esquema.** Migration do EF no backend, script de
   esquema, e `DATABASE_VERSION` do IndexedDB do PDV (ver armadilha 4).
3. **Configuração de deploy e segredo.** `vercel.json`, `railway.json`,
   `Dockerfile`, `appsettings*.json`, variável de ambiente, workflow de CI.

Push na `main` do front **dispara deploy na Vercel**. É por isso que os freios
existem: o custo de um commit errado aqui não é um rebase, é a loja com a tela
quebrada.

### Em dúvida ou em conflito, pergunte

Conflito de merge, divergência com o remoto, histórico que não bate — **nunca
resolva sozinho**. Traga o estado e pergunte. Vale também para qualquer coisa
que reescreva histórico já publicado: force-push, `rebase` de commit que já
subiu, `--amend` depois do push.

### Nunca `git add -A`

Outros chats compartilham este working tree. Adicione **só os arquivos que você
mesmo tocou**, nominalmente. `git add -A` e `git add .` varrem o trabalho de
outra conversa para dentro do seu commit, e quem descobre é o `git log`.

### Formato do commit

Conventional commit, assunto em português **sem acento** (é o padrão do
histórico), corpo explicando o **porquê** — não o quê, que o diff já dá. Um
tema por commit: se o trabalho misturou feature e correção, são dois commits.

---

## 2. Mapa dos workspaces

| Workspace             | O que é                                                                                  | O que NÃO entra                    |
| --------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| `apps/admin`          | Retaguarda. 25 features.                                                                 | —                                  |
| `apps/pdv`            | Ponto de venda, offline-first.                                                           | —                                  |
| `apps/loja`           | Site público (uaus.com.br). Só leitura anônima (`/storefront`, hooks com `auth: false`). | Login, sessão, chamada autenticada |
| `packages/api-client` | Cliente HTTP, DTOs e hooks React Query. Escrito à mão.                                   | Regra de negócio                   |
| `packages/core`       | Regra de domínio pura: dinheiro, datas, texto, máscara, erro.                            | React, rede, DOM                   |
| `packages/ui`         | Componentes visuais (shadcn).                                                            | Regra de domínio                   |
| `packages/receipt`    | Montagem e impressão do cupom.                                                           | Chamada de API                     |

Cada package tem README próprio. Leia o do pacote antes de mexer nele.

---

## 3. Camada de dados — o caminho é UM só

Esta é a regra que mais importa, porque violá-la **não gera erro de
compilação**.

**Todo path HTTP, DTO de resposta, chave de cache e hook de query/mutation nasce
em `packages/api-client`.** As features consomem os hooks. O passo a passo está
em `packages/api-client/README.md`.

- `apps/admin/src/services/` está **congelado**. Ele é resíduo de uma fase
  anterior e ainda mistura wrapper HTTP, domínio puro e catálogo de enums. Não
  crie arquivo novo ali. Se precisar mexer num existente, mexa; migrar é tarefa
  separada (Onda 3).
- Nunca chame `fetch` direto nem monte `Authorization` à mão. O `client.ts`
  já resolve sessão, 401 e paginação.
- Regra de negócio que os dois apps precisam calcular igual vai para
  `packages/core`, nunca para o `src/lib/` de um app. Duplicata aqui **já
  divergiu na prática**: `round2` teve cinco implementações e três algoritmos,
  e o total da tela não batia com o total gravado.

---

## 4. Estrutura de uma feature (admin)

```
src/features/<nome>/
  hooks/use<Nome>.ts          queries, mutations, estado de form, paginação
  hooks/__tests__/            teste do hook
  components/                 subcomponentes puros, só props
  types.ts                    tipagem estrita
  README.md                   arquitetura + regras de negócio, em português
```

- **A página nunca contém query ou mutation.** Ela renderiza o que o hook devolve.
- **Modelo canônico: `apps/admin/src/features/fixed-costs/`.** É a única feature
  com os seis artefatos, JSDoc completo, zero `any` e README com regra de
  negócio de verdade. Copie ela, não "uma feature qualquer".
- **Teste canônico: `apps/admin/src/features/partners/hooks/__tests__/usePartners.test.tsx`.**
- **Exceção conhecida:** o PDV ainda não usa `src/features/` — ele tem
  `components/`, `hooks/`, `lib/`, `offline/`, `services/`, `stores/`. Migrar é
  tarefa da Onda 3. Enquanto isso, siga a estrutura local do PDV, não invente uma
  terceira.

### Cerimônia dos testes de hook

Mockar o api-client exige `vi.mock` com `importOriginal`, dublando **só o que
fala com a rede**:

```ts
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetX: mocks.useGetX,
}));
```

Não redefina chaves de cache no mock. Já aconteceu de o teste de invalidação
validar a chave inventada no mock em vez da que a tela usa — e a quebra real
passar batida.

---

## 5. Tamanho e tipagem

- **Máximo 300 linhas por arquivo.** Vale para código novo; o lint avisa
  (`max-lines` é warning porque 13 arquivos legados estouram hoje). Arquivo
  grande custa contexto de agente.
- **`any` é proibido.** O lint trata como **erro**. As 240 violações legadas
  estão em `eslint-suppressions.json`, arquivo que só encolhe. Se você precisou
  de `any`, quase sempre o tipo certo já existe em `packages/api-client`.

---

## 6. Documentação

- README por feature, em português, explicando **regra de negócio** — não a
  lista de arquivos, que o `ls` já dá.
- JSDoc em português nas funções, hooks e tipos exportados, explicando o
  **porquê**. Os melhores exemplos do repo: `apps/pdv/src/offline/` (idempotência,
  TOCTOU), `sales.service.ts` (fuso horário).
- Documentou uma decisão não óbvia? Diga o que aconteceria sem ela.

---

## 7. Testes

- Lógica de dinheiro, cálculo, validação e hook customizado **têm que ter teste**
  (Vitest + React Testing Library).
- Regra prática: se a lógica é importante o bastante para ser compartilhada, é
  importante o bastante para ser coberta.
- Teste comportamento, não o mock. Um teste que afirma o que o próprio mock
  devolve não testa nada — foi assim que a perda do desconto por item passou.

---

## 8. Comandos de verificação

```bash
npm run build:types      # obrigatório depois de mexer em packages/
npm run typecheck:admin
npm run typecheck:pdv
npm test                 # core, admin, pdv, receipt, api-client
npm run lint             # monorepo inteiro
npm run lint:prune       # tira do baseline o que já foi limpo
```

O CI roda typecheck, lint, testes e build dos dois apps. Rode `npm test` e
`npm run lint` antes de dizer que terminou.

### Gate de regressão antes de produção

Push na `main` publica o Admin. Portanto, **build verde sozinho não autoriza
push** quando houve alteração de comportamento, tela ou integração:

1. Reproduza a falha antes de corrigir e adicione um teste de regressão com o
   mesmo formato de dado ou sequência que a provocou.
2. Depois da correção, execute os testes, `typecheck`, `lint` e build aplicáveis.
3. Faça um smoke test do fluxo afetado, localmente ou em preview: a tela deve
   renderizar, a ação principal deve funcionar, o console não pode ter exceções
   e as requisições essenciais não podem falhar.
4. Registre no handoff quais comandos e qual cenário foram verificados. Se
   autenticação, ambiente ou dependência externa impedir o smoke test, **pare
   antes do commit/push** e informe o bloqueio; não presuma que compilação prova
   que a implementação funciona.

---

## 9. Armadilhas conhecidas

1. **Chave de cache.** A factory devolve só o prefixo; quem consulta acrescenta
   os parâmetros. Detalhe e motivo em `packages/api-client/README.md`. Errar
   aqui não gera erro — a tela só não atualiza.
2. **`toISOString()` em data de calendário.** Converte para UTC e joga o dia para
   trás no Brasil. Use `toDateKey` do `packages/core`.
3. **`parseAmount` devolve `NaN` em campo vazio.** Use `parseAmountOrNull`, que
   separa "não informou" de "digitou bobagem".
4. **Migração do IndexedDB do PDV apaga as stores de catálogo.** Só suba
   `DATABASE_VERSION` se o esquema realmente mudou — acrescentar campo a um
   objeto não muda. Ver `apps/pdv/docs/offline.md`.
5. **`toISOString()` também estraga instante com hora.** A armadilha 2 vale para
   data de calendário; para "23:59:59 do dia escolhido" não existe helper no
   `packages/core` ainda — o único conversor do repo é o `toLocalTimestamp` de
   `apps/pdv/src/services/sales.service.ts`, preso dentro do PDV. Precisando de
   instante local no admin, mova esse helper para o `core` antes; não copie.
6. **Data de fim de vigência é o caso clássico:** gravar `2026-09-30T23:59:59`
   como UTC faz a validade acabar às 20:59 do dia 30 no Brasil, e a recusa cita
   uma hora que o cliente não tem como conferir.

> Duas armadilhas antigas **deixaram de valer** e estão registradas aqui para
> ninguém orçar de novo o que já existe:
>
> - **Autorização por papel existe.** `apps/admin/src/routes.ts` declara
>   `roles?: RoleCode[]` por rota (8 já usam `SO_ADMIN`), `podeAcessar` e
>   `buildMenu` derivam menu e acesso dos mesmos dados, e `RequireRole` em
>   `src/components/route-guards.tsx` redireciona quem não tem o papel. "Só Admin
>   faz X" é **uma linha** na rota, não feature nova.
> - **Rota e menu não divergem mais.** `routes.ts` é a fonte única; `App.tsx` e o
>   menu do `layout.tsx` são derivados dela. Não há mais string solta para errar.

---

## 10. Deploy (Vercel)

- `buildCommand` no `vercel.json` aponta para o script do workspace hospedado.
- `package.json` da raiz mantém `"build"` como fallback para o mesmo alvo.
- `outputDirectory` mapeia a pasta final do Vite (`apps/admin/dist/public`).

### Qual API o front chama — decide o host, não a branch

O rewrite de `/api/` existe porque a API **não tem CORS**: o front só a alcança
na mesma origem. Qual API ele alcança é escolhido pelo `has: host` do
`vercel.json` — e não por um arquivo diferente em cada branch. Assim o
`vercel.json` fica idêntico na `dev` e na `main`, e o merge nunca leva a API de
dev para produção nem gera conflito recorrente nesse arquivo.

A ordem das regras é deliberada: **só** `admin.uaus.com.br` (e `pdv.uaus.com.br`
no `apps/pdv/vercel.json`, e `uaus.com.br`/`www.uaus.com.br` no
`apps/loja/vercel.json`) cai em `api.uaus.com.br`; todo o resto — `*-dev`,
previews de branch, `*.vercel.app` — cai em `api-dev.uaus.com.br`. O padrão
seguro é dev, não produção. Invertendo a ordem ou apagando o `has`, qualquer
preview passa a gravar venda no banco da loja.

São **três projetos Vercel**: o do admin usa a raiz do repo (este
`vercel.json`); PDV e loja usam Root Directory no próprio app, com
`vercel.json` local. Host novo de produção também entra em
`packages/ui/src/lib/environment.ts`, senão a faixa de dev aparece em produção.
