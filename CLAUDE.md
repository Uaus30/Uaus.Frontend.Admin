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
   nunca suba quebrado. Os comandos e o smoke test obrigatório estão na seção 9.
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

## 2. A base de conhecimento vem antes e depois do código

`C:\Projects\Uaus\Uaus.Docs` é a base de conhecimento dos projetos Uaus —
repositório **próprio** (`Uaus30/Uaus.Docs`, privado), pasta vizinha a esta, com
`main` já rastreando `origin/main`. Guarda o que atravessa repositórios: regra
de domínio que backend, admin, PDV e site aplicam igual, ambientes, fluxo de
publicação, o histórico do **porquê** de cada mudança e as pendências.

Ela não é documentação opcional; é onde está a resposta que o código não dá. O
código diz _o que_ o sistema faz hoje. A base diz _por que_ faz assim, o que já
foi tentado, e o que quebrou quando alguém fez diferente. Para o front importam
especialmente `dominio/convencoes-de-interface.md` (ordem dos selects,
vocabulário de cores, confirmações) e `dominio/vitrine.md` — decisões de tela
que **já foram tomadas** e que refazer do zero custa retrabalho e divergência.

### Antes de atender qualquer demanda — leia

1. `Uaus.Docs/README.md` — é o índice, e existe para você não ler 29 arquivos.
2. A página de `dominio/` que a demanda toca, e `operacao/fluxo-de-trabalho.md`.
3. `Uaus.Docs/pendencias.md` — a demanda pode já estar ali, com contexto.
4. Em `historico/`, a entrada do tema; um `grep` pelo assunto resolve.

Isso **não substitui** o README da feature nem o do pacote (seção 3): a base
dá o porquê que atravessa repositórios, o README local dá a regra daquela tela.

**Use o que encontrar.** Achou a regra, o número medido, a decisão e o motivo?
Parta deles em vez de redescobrir, e diga na resposta de onde veio, para o dono
poder conferir. Se a base contradisser o código, o **código é o fato** e a base
está velha: corrija a base no mesmo trabalho, porque a próxima pessoa vai
confiar nela de novo.

### Ao terminar — escreva, commite e dê push

Todo trabalho termina com uma passada na base. O que muda lá depende do que o
trabalho mudou aqui:

| O trabalho...                                             | Na base                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| mudou regra de negócio, comportamento de tela ou contrato | atualize a página de `dominio/` **e** crie `historico/<aaaa-mm-dd>-<tema>.md` |
| resolveu uma pendência                                    | mova de `pendencias.md` para o histórico, riscada (`~~...~~`) e com o link    |
| revelou armadilha, número medido ou porquê não óbvio      | registre, ainda que dentro de uma página existente                            |
| não mudou conceito nenhum (typo, formatação, renomeação)  | nada — entrada de histórico para isso é ruído que afoga o resto               |

Criou entrada em `historico/`? **Acrescente o link no índice do `README.md`.**
Entrada fora do índice é entrada que ninguém acha: em 12/09/2026 havia sete
assim, e o efeito prático era o mesmo de não ter escrito.

Depois, dentro de `Uaus.Docs`, **commite e dê push sem pedir confirmação**:

```bash
cd C:/Projects/Uaus/Uaus.Docs && git add <os arquivos que voce tocou> && git commit -m "docs: ..." && git push
```

**Por que ali o push é automático e aqui tem freio:** nada é publicado a partir
do `Uaus.Docs`. Não há build, não há Vercel, não há loja com a tela quebrada. O
pior commit possível lá custa um `git revert`; o pior commit aqui vai ao ar em
minutos. Os três freios da seção 1 valem para **este** repositório, não para a
base.

### Cuidados ao escrever na base

- **Segredo nenhum.** Nem senha, nem chave, nem string de conexão, nem token.
  O repositório é privado, mas privado não é cofre — e o que entra no histórico
  do git continua lá depois de apagado do arquivo.
- **Não copie código para lá.** Aponte o caminho do arquivo: o código muda, o
  caminho sobrevive melhor, e a cópia vira mentira em silêncio.
- **Só o que aconteceu de verdade.** Histórico é registro do que foi entregue e
  verificado, não plano nem intenção. Entrada sobre trabalho que não subiu faz a
  próxima pessoa construir em cima do que não existe.
- **Datas absolutas** (dd/mm/aaaa), e decisão não óbvia acompanhada do que
  aconteceria sem ela. São as convenções do `README.md` de lá.
- **Nunca `git add -A`** — vale ali pelo mesmo motivo que vale aqui: o working
  tree é compartilhado com outras conversas.

---

## 3. Mapa dos workspaces

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

## 4. Camada de dados — o caminho é UM só

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

## 5. Estrutura de uma feature (admin)

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

## 6. Tamanho, tipagem e acoplamento

- **Máximo 300 linhas por arquivo.** Vale para código novo; o lint avisa
  (`max-lines` é warning porque 13 arquivos legados estouram hoje). Arquivo
  grande custa contexto de agente.
- **`any` é proibido.** O lint trata como **erro**. As 240 violações legadas
  estão em `eslint-suppressions.json`, arquivo que só encolhe. Se você precisou
  de `any`, quase sempre o tipo certo já existe em `packages/api-client`.

### Acoplamento é o que a seção 4 está defendendo

A camada de dados e a tabela da seção 3 ("o que NÃO entra") são regras de
acoplamento escritas caso a caso. A generalização vale para tudo o mais:

- **Dependa do contrato, não do vizinho.** Componente recebe por props;
  `components/` é puro e não busca dado. A página não contém query nem mutation
  — quem busca é o hook.
- **Nada de import atravessando feature.** `features/a` não importa de
  `features/b`. O que os dois precisam desce para `packages/core` (regra),
  `packages/ui` (visual) ou `packages/api-client` (rede). Import cruzado é o
  jeito mais rápido de fazer duas telas caírem juntas por um motivo só.
- **Sinal de alerta:** mudar uma regra e ter que editar arquivos em três
  features. Se acontecer, a regra estava copiada, não compartilhada — foi assim
  que `round2` chegou a cinco implementações e três algoritmos, com o total da
  tela divergindo do total gravado.
- Acoplamento a **detalhe** é o caro: formato de resposta, nome de coluna, ordem
  de array, índice fixo. Acoplamento a **contrato** estável é barato e desejável.

Um aviso contra o excesso: abstrair cedo demais também acopla, e ainda esconde.
Duas ocorrências parecidas não são duplicata; três iguais, com a mesma razão de
mudar, são.

---

## 7. Documentação e idioma

**O código é em inglês; tudo o que explica o código é em português do Brasil.**

| Em inglês                                                                   | Em português                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| nome de variável, função, componente, hook, tipo, arquivo e pasta de código | comentário e JSDoc                                     |
| chave de objeto e campo de DTO (espelham a API)                             | README de feature e de pacote                          |
| —                                                                           | texto de tela, rótulo, mensagem de erro e de validação |
| —                                                                           | assunto e corpo do commit (sem acento no assunto)      |

Motivo: o identificador é lido junto com React, TypeScript e as bibliotecas,
todos em inglês — `orderCatalogByName` não muda de idioma no meio da linha. Já a
explicação é para quem toma decisão de negócio, e essa pessoa pensa em português.

**Não saia renomeando o que existe.** Medido em 13/09/2026: 50 de 2433
identificadores do front estão em português (`nomeDaTela`, `comporTitulo`,
`destinoAposLogin`, `codigoDoPapel`). A regra vale para código **novo** e para o
arquivo que você já está editando por outro motivo; renomeação em massa é diff
gigante, risco de regressão e zero valor para a loja.

- README por feature, em português, explicando **regra de negócio** — não a
  lista de arquivos, que o `ls` já dá.
- JSDoc em português nas funções, hooks e tipos exportados, explicando o
  **porquê**. Os melhores exemplos do repo: `apps/pdv/src/offline/` (idempotência,
  TOCTOU), `sales.service.ts` (fuso horário).
- Documentou uma decisão não óbvia? Diga o que aconteceria sem ela.

---

## 8. Testes

- Lógica de dinheiro, cálculo, validação e hook customizado **têm que ter teste**
  (Vitest + React Testing Library).
- **Implementação nova sai com teste no mesmo commit**, não em tarefa seguinte.
  Teste que fica para depois é teste que não existe, e quem descobre é a loja.
- Regra prática: se a lógica é importante o bastante para ser compartilhada, é
  importante o bastante para ser coberta.
- Teste comportamento, não o mock. Um teste que afirma o que o próprio mock
  devolve não testa nada — foi assim que a perda do desconto por item passou.

### O caso de borda é onde mora o bug

O caminho feliz raramente quebra. Quando a borda **fizer sentido no domínio**,
cubra-a — e neste repositório ela já cobrou o preço três vezes:

| Borda                            | O que já aconteceu aqui                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| divisor zero / lista vazia       | a primeira compra pendente **sem custo** derrubou a listagem de Compras (09/09/2026)                      |
| campo vazio vs. valor inválido   | `parseAmount` devolve `NaN`; `parseAmountOrNull` separa "não informou" de "digitou bobagem" (armadilha 3) |
| virada de fuso e fim de vigência | `toISOString()` joga o dia para trás no Brasil (armadilhas 2, 5 e 6)                                      |

Outras que costumam valer o teste: zero e negativo, primeiro e último item da
paginação, duplicata, arredondamento no meio (`.005`), coleção com um elemento
só, e o retorno que a API **omite** por ser nulo. Não cubra borda impossível —
teste de caso que o domínio não produz é manutenção sem retorno.

---

## 9. Comandos de verificação

```bash
npm run build:types      # obrigatório depois de mexer em packages/
npm run typecheck:admin
npm run typecheck:pdv
npm run typecheck:loja
npm test                 # core, admin, pdv, loja, receipt, api-client, ui
npm run lint             # monorepo inteiro
npm run format:check     # Prettier — gate separado, ver abaixo
npm run lint:prune       # tira do baseline o que já foi limpo
```

O CI roda typecheck, lint, formatação, testes e build dos três apps. Rode
`npm test`, `npm run lint` e `npm run format:check` antes de dizer que terminou.

### `format:check` é um gate à parte — o lint não o cobre

Os dois moram no mesmo job (`Lint`) do CI, e é fácil confundir. O `npm run lint`
passa com o arquivo fora do formato do Prettier; quem reprova é o
`format:check`, e quem descobre é o CI — **depois** do push, que na `main` já
disparou deploy.

Para corrigir, formate **só o que você tocou**:

```bash
npx prettier --write <arquivos que você mexeu>
```

`npm run format` é `prettier --write .` e reescreve o repositório inteiro — no
working tree compartilhado, isso varre o trabalho de outro chat exatamente como
o `git add -A` da seção 1.

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

### Antes de mexer em código compartilhado, veja quem consome

Mudar assinatura, retorno ou chave de cache em `packages/core`,
`packages/api-client` ou `packages/ui` atinge **admin, PDV e loja ao mesmo
tempo**. O `typecheck` pega a quebra de tipo; não pega a de comportamento —
quem trocou a ordem de um array ou o arredondamento de uma função continua
compilando e passa a errar em três telas.

Procure os chamadores (`grep` pelo nome) antes de mudar, e rode os testes dos
três apps, não só o do seu. É a mesma razão da seção 4: o caminho é um só
justamente para a mudança valer nos três — e por isso o erro também vale.

### Performance: o custo que não aparece no teste verde

Teste verde e tela bonita não dizem nada sobre peso. Os quatro que mais custam
aqui, em ordem de frequência:

- **Payload.** Mande só o que a tela desenha. A listagem de produtos carregava o
  grupo inteiro para exibir três colunas — peso em **toda** página, para todo
  mundo (corrigido em 12/09/2026).
- **Requisição por linha.** Uma chamada dentro do `map` da lista vira N
  chamadas. Busque em lote, ou traga o campo junto na primeira resposta.
- **Render.** Objeto ou array literal criado no corpo do componente muda de
  identidade a cada render e derruba o `memo` de quem recebe. Com 1000+ produtos
  no catálogo isso deixa de ser teoria.
- **Bundle.** Importar a biblioteca inteira por causa de uma função entra no
  build dos três apps e no tempo de carregamento da loja, que é a tela que o
  cliente abre no celular, no 4G da cidade.

Não otimize por suspeita: **meça** (aba Network, React DevTools Profiler,
tamanho do chunk) e diga o número no handoff. Otimização sem medida é
complexidade acoplada — o que a seção 6 pede para evitar.

---

## 10. Armadilhas conhecidas

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
7. **`ScrollArea` dentro de diálogo com `max-h` não rola — corta.** O viewport
   do Radix é dimensionado por `height: 100%`, e porcentagem exige pai com
   altura DEFINIDA; `max-h-[85vh]` no `DialogContent` não dá isso. Sobrando
   conteúdo, o viewport cresce até a altura do conteúdo dentro de uma caixa
   `overflow: hidden` — sem barra, sem rolagem, e o excedente fica
   inalcançável. O histórico do PDV mostrava 4 vendas com 5 no banco, e a
   suspeita caiu no endpoint (medido em 01/09/2026: viewport de 2177px numa
   caixa de 445px). Em diálogo, use rolagem nativa:
   `<div className="min-h-0 flex-1 overflow-y-auto">`. O `ScrollArea` continua
   certo onde a cadeia de altura é definida — o carrinho e a busca do PDV, que
   descendem de `h-screen`.

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

## 11. Deploy (Vercel)

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
