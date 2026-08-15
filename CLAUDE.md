# Regras do repositório (AI-First)

Monorepo dos frontends da Uaus. Este arquivo é carregado automaticamente por
agentes de IA — as regras estão aqui **em texto**, não por link, porque um
ponteiro que ninguém segue não é regra.

---

## 1. Ações proibidas

- **Não commite por conta própria.** Nunca rode `git commit` sem o desenvolvedor
  ter pedido explicitamente naquela conversa.
- **Não faça push nem abra PR** de forma autônoma, pela mesma razão.
- Alterações ficam na workspace local. Versionamento e deploy são decisão humana.

---

## 2. Mapa dos workspaces

| Workspace | O que é | O que NÃO entra |
| --- | --- | --- |
| `apps/admin` | Retaguarda. 25 features. | — |
| `apps/pdv` | Ponto de venda, offline-first. | — |
| `packages/api-client` | Cliente HTTP, DTOs e hooks React Query. Escrito à mão. | Regra de negócio |
| `packages/core` | Regra de domínio pura: dinheiro, datas, texto, máscara, erro. | React, rede, DOM |
| `packages/ui` | Componentes visuais (shadcn). | Regra de domínio |
| `packages/receipt` | Montagem e impressão do cupom. | Chamada de API |

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
