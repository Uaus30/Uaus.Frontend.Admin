# Regras para agentes de IA

Leia também o `CLAUDE.md` da raiz antes de alterar este monorepo; ele contém os
padrões completos de arquitetura, testes, documentação, base de conhecimento e
deploy.

## Base de conhecimento: ler antes, escrever depois

`C:\Projects\Uaus\Uaus.Docs` (repositório `Uaus30/Uaus.Docs`, privado, pasta
vizinha a esta) guarda o que atravessa os repositórios: regra de domínio,
ambientes, operação, o porquê de cada mudança e as pendências. O código diz o
que o sistema faz; a base diz por que faz assim e o que quebrou quando alguém
fez diferente. Para o front importam especialmente
`dominio/convencoes-de-interface.md` e `dominio/vitrine.md` — decisões de tela
já tomadas, que refazer do zero custa retrabalho e divergência.

**Antes de atender qualquer demanda**, leia o `README.md` dela (é o índice, e
existe para você não ler 29 arquivos), a página de `dominio/` que a demanda
toca, `operacao/fluxo-de-trabalho.md` e `pendencias.md` — a demanda pode já
estar ali, com contexto. Isso não substitui o README da feature nem o do
pacote: a base dá o porquê que atravessa repositórios, o README local dá a
regra daquela tela. Use o que encontrar em vez de redescobrir, e diga na
resposta de onde veio. Base contradizendo o código: o **código é o fato**;
corrija a base no mesmo trabalho.

**Ao terminar**, atualize a página de `dominio/` afetada, crie
`historico/<aaaa-mm-dd>-<tema>.md` quando a mudança alterou regra ou
comportamento, acrescente o link no índice do `README.md` (entrada fora do
índice ninguém acha) e mova para o histórico a pendência resolvida. Então
**commite e dê push sem pedir confirmação**:

```bash
cd C:/Projects/Uaus/Uaus.Docs && git add <arquivos tocados> && git commit -m "docs: ..." && git push
```

O push ali é automático porque **nada é publicado a partir do `Uaus.Docs`**: sem
build, sem Vercel, sem loja com a tela quebrada. Os freios abaixo valem para o
código, não para a base. Nunca escreva segredo, senha, chave ou string de
conexão lá — o repositório é privado, mas o que entra no histórico do git não
sai.

Trabalho que não mudou conceito nenhum (typo, formatação, renomeação) não gera
entrada: histórico para isso é ruído que afoga o resto.

## Como escrever código (detalhe nas seções 6 a 9 do `CLAUDE.md`)

- **Teste junto.** Implementação nova sai com teste (Vitest + RTL) no mesmo
  commit, não em tarefa seguinte. Cubra o caso de borda quando ele fizer sentido
  no domínio: divisor zero e lista vazia, campo vazio vs. inválido
  (`parseAmountOrNull`, não `parseAmount`), virada de fuso (`toDateKey`, nunca
  `toISOString()`), primeiro e último da paginação, arredondamento no meio.
  Teste comportamento, não o mock.
- **Acoplamento.** Componente recebe por props e `components/` é puro; a página
  não contém query nem mutation. `features/a` não importa de `features/b` — o
  que os dois precisam desce para `packages/core`, `ui` ou `api-client`. Todo
  path HTTP, DTO, chave de cache e hook nasce em `packages/api-client`.
- **Código em inglês; comentário, JSDoc, README, texto de tela e mensagem de
  erro em português do Brasil.** Não saia renomeando o que existe (50 dos 2433
  identificadores ainda estão em português): a regra vale para código novo.
- **Performance e regressão.** Mexer em `packages/*` atinge admin, PDV e loja ao
  mesmo tempo, e o `typecheck` não pega quebra de comportamento — procure os
  chamadores e rode os testes dos três. Cuide de payload maior que a tela
  desenha, requisição dentro de `map`, literal no corpo do componente que derruba
  o `memo`, e import de biblioteca inteira por uma função. Meça antes de
  otimizar e diga o número no handoff.

## Git automático na main

Há autorização permanente para agentes de IA executarem o fluxo Git completo
sem pedir confirmação: atualizar a `main` antes de iniciar e, ao concluir o
trabalho, criar commit e fazer push diretamente para `origin/main`.

O commit e o push só estão autorizados depois que os testes e builds aplicáveis
forem executados com sucesso. No frontend, confira também os `typecheck`, o lint
e o smoke test do fluxo alterado conforme definido no `CLAUDE.md`.

Pare antes do commit/push e informe o responsável quando houver:

- teste, typecheck, lint, build ou smoke test falhando;
- migração de banco/esquema ou mudança de versão do IndexedDB do PDV;
- alteração de configuração de deploy, segredo ou variável de ambiente;
- conflito, divergência inesperada ou necessidade de reescrever histórico.

Adicione ao commit somente os arquivos da tarefa, nominalmente; nunca use
`git add .` nem `git add -A`. Use Conventional Commits, assunto em português
sem acento e um tema por commit.
