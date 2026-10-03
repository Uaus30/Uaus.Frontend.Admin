# @workspace/api-client-react

Cliente HTTP e hooks React Query do backend Uaus. **Escrito à mão** — não é
gerado. Todo endpoint novo entra aqui manualmente.

> Houve uma tentativa de adotar Orval que nunca foi concluída. O código gerado
> foi removido em ago/2026 porque declarava um contrato _contraditório_ com o
> real e colidia em nome com o vivo. Se um dia o Orval voltar, tem que ser em PR
> próprio, gerando **só tipos** — nunca dois contratos vivos ao mesmo tempo.

## Camadas

| Arquivo                  | Responsabilidade                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `src/client.ts`          | Transporte: `apiGet/apiPost/apiPut/apiDelete`, sessão, tratamento de 401, paginação |
| `src/models.ts`          | DTOs e enums do backend                                                             |
| `src/hooks/<domínio>.ts` | Hooks React Query e funções de acesso, um arquivo por domínio                       |
| `src/hooks/index.ts`     | Barrel — o import público não muda                                                  |

Os apps importam sempre de `@workspace/api-client-react`, nunca de um caminho
interno.

## Como adicionar um endpoint

1. **DTO em `src/models.ts`.** Se tiver enum, siga o padrão `EnumValue` +
   tabela de códigos (como `USER_ROLE`), e leia com `enumCode()`.
2. **Arquivo do domínio em `src/hooks/`.** Existe um? Use. Não existe? Crie e
   exporte no `src/hooks/index.ts`.
3. **Chave de cache** seguindo a convenção abaixo.
4. **Função de leitura** com `apiGet` + `mapPagedResult` quando for paginado.
5. **Mutações** como funções puras (`createX`, `updateX`, `deleteX`); o
   `useMutation` fica no hook da feature, não aqui.
6. `npm run build:types` antes de rodar o typecheck dos apps — eles consomem o
   pacote por `file:` e dependem dos `.d.ts` recém-gerados.

## Convenção de chaves de cache

A factory devolve **só o prefixo** do recurso. Quem consulta acrescenta os
parâmetros:

```ts
export const getGetCouponsQueryKey = (): QueryKey => ["Coupons"];

// na query:
queryKey: [...getGetCouponsQueryKey(), params ?? {}],
```

Isso não é estilo, é correção. O `partialMatchKey` do React Query v5 compara
elemento a elemento: uma factory que embutisse os parâmetros faria
`invalidateQueries({ queryKey: getGetCouponsQueryKey() })` produzir o filtro
`["Coupons", undefined]`, que **não casa** com a query registrada como
`["Coupons", { search, page }]`. O resultado é o pior possível — compila, roda,
não lança erro, e a listagem não atualiza depois de salvar. Já mordeu três vezes
neste repositório.

`src/query-keys.test.ts` trava a regra: varre os exports do pacote e exige arity
zero, prefixo só de strings e prefixos distintos entre recursos. Uma factory nova
fora do padrão quebra o teste sem ninguém precisar lembrar de cobri-la.

## Contratos que não são óbvios

- **`useCrudMutation` não invalida nada.** Quem invalida é o hook da feature.
- **Campos nulos são omitidos do JSON.** O backend serializa com
  `WhenWritingNull`, então eles chegam como `undefined` e não `null` — por isso
  os DTOs usam `campo?: T | null` e a comparação tem que ser `== null` ou `??`.
- **401 é tratado centralmente** (`client.ts`): limpa a sessão, deduplica o
  redirecionamento quando várias queries respondem 401 juntas, isenta o caminho
  de autenticação e preserva o `BASE_URL` do deploy. Não replique isso nas
  features. O 401 de um token que a sessão já substituiu é ignorado: a troca de
  senha grava um token novo, e uma requisição ainda em voo com o antigo não pode
  derrubar a sessão que acabou de nascer.
- **A sessão se renova sozinha** (`client.ts`). O token vale 7 dias a contar do
  último acesso: depois de toda requisição autenticada que deu certo, o client
  troca o token em segundo plano (`POST /Users/renew-session`) — na primeira
  requisição de cada abertura do app e, com a página aberta, de hora em hora. A
  resposta traz também o cadastro atual, e é assim que mudança de nome ou de
  papel chega ao aparelho sem novo login. Falha de rede ou do servidor **não**
  desloga (tenta de novo em um minuto); só o 401 desloga, e ele agora chega
  também quando o usuário foi inativado ou teve a senha trocada ou resetada — o
  servidor confere isso a cada requisição. Admin e PDV não precisam fazer nada:
  usar o sistema é o que mantém a sessão viva. Não renove por conta própria.
- **`fetchAllPages` serve a catálogo, não a tabela que cresce.** Ele pede as
  páginas restantes numa janela de 6 por vez e **lança** ao passar de 20 mil
  itens (`FETCH_ALL_PAGES_MAX_ITEMS`), em vez de devolver a lista cortada — meia
  lista não parece quebrada, parece que o registro não existe. Se você bateu no
  teto, o endereço precisa de filtro ou agregação no servidor; aumentar o teto só
  adia. `useAllSales` no admin é o caso que vai bater primeiro.

## Testes

```bash
npm run test:api-client
```

## Risco conhecido

Os DTOs são escritos à mão e **não há detecção de divergência** com o backend.
Se um campo mudar lá, nada aqui percebe até a tela quebrar em produção. É o maior
risco estrutural do pacote e está na Onda 5 do plano de refatoração.
