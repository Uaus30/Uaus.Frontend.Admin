# Módulo de Campanhas (Admin)

Cadastro das campanhas de marketing: período, questionário do caixa e os cupons ligados a elas. Rota `/marketing/campanhas`, papel **Admin** (não existe papel de marketing no sistema, e o `CampaignsController` recusa Seller em todas as actions). Contrato em `PLANO-CUPONS-CAMPANHAS.md` (raiz do repositório) e nos DTOs de `Uaus.Application/DTOs/Campaigns`.

## A regra que mais confunde

> **A vigência do CUPOM decide o dinheiro. A vigência da CAMPANHA decide apenas se o questionário é apresentado no caixa.**

São dois períodos independentes, e eles não precisam coincidir:

| Situação | O desconto sai? | O caixa pergunta? |
| --- | --- | --- |
| Cupom vigente, campanha no ar | sim | sim |
| Cupom vigente, campanha **encerrada** ou inativa | **sim** | não |
| Cupom vencido, campanha no ar | **não** | não (nem chega a aplicar) |
| Cupom vigente, campanha excluída | **sim** | não |

O caso da segunda linha é o que motiva a regra existir. O cliente lê "válido até 30/09" no panfleto; se encerrar a campanha no dia 15 recusasse o cupom, o sistema estaria desmentindo o papel impresso que a própria loja distribuiu. Por isso desativar, encerrar ou excluir uma campanha **nunca** invalida cupom: o que acaba é a pergunta.

O outro lado da mesma regra: o resgate continua sendo atribuído à campanha mesmo com ela fechada — o servidor fotografa o vínculo na gravação da venda. O relatório da campanha, portanto, não zera quando a campanha acaba.

## Estrutura

- `hooks/useCampaigns.ts`: hook controlador — listagem paginada com busca debounced (300ms), formulário, questionário, cupons vinculados e as mutações.
- `hooks/campaignRules.ts`: regras puras (sem React) — composição e leitura dos instantes, rascunhos do questionário, validação e montagem do payload. Mora fora do controlador para ele caber no teto de 300 linhas; precedente: `features/products/hooks/editor/utils.ts`.
- `components/CampaignsTable.tsx`: listagem com o período em data **e hora**, situação (No ar / Programada / Encerrada / Inativa) e atalho para o relatório.
- `components/CampaignEditorModal.tsx`: cadastro/edição, com `guardCalendarDismiss` no `DialogContent` (o calendário abre num portal fora da modal; sem a guarda, escolher um dia fecharia o formulário e levaria o questionário digitado junto).
- `components/CampaignInstantField.tsx`: o par data + hora que compõe um instante.
- `components/CampaignQuestionsEditor.tsx`: editor do questionário.
- `components/CampaignCouponsCard.tsx`: cupons vinculados e o atalho para criar mais um já ligado à campanha.
- `types.ts`: formulário e rascunhos do questionário; re-export dos DTOs do api-client.

## Regras de negócio

### 1. Período é instante, não data

`startsAt` e `endsAt` são **timestamps**: a campanha pode durar uma tarde ("das 14h às 20h de sábado") ou atravessar meses. O relatório compara o faturamento dela com o da loja no **mesmo intervalo**, hora a hora — truncar no dia tornaria uma campanha de uma tarde indistinguível de uma que durou o dia inteiro.

O `DatePicker` de `packages/ui` trabalha só com `Date` de calendário, e **é assim que ele deve continuar** (a maioria das telas escolhe dia). O controle de hora é montado aqui dentro da feature e a string é composta à mão em `campaignRules.ts`:

- o dia sai de `toDateKey` do `@workspace/core`, **nunca** de `toISOString()` — que converte para UTC e, antes das 21h no Brasil, grava a campanha começando na véspera;
- segundos fixos por extremidade: `00` no início, `59` no fim. As duas pontas são inclusivas e a granularidade oferecida é o minuto, então um fim às 18:00 significa "até o fim de 18:00" e não deixa 59 segundos de campanha fora do relatório;
- a comparação início × fim é feita sobre as strings compostas, porque `"yyyy-MM-ddTHH:mm:ss"` ordena como data. Comparar por **dia** deixaria passar uma campanha das 14h às 8h do mesmo dia.

### 2. O questionário é sempre enviado inteiro

O servidor faz upsert por id dentro de uma transação: pergunta/opção **com id** é atualizada, **sem id** é criada, e a que **não vier na lista** é excluída logicamente. Duas consequências práticas:

- **O `id` viaja preservado.** Sem ele o servidor cria uma linha nova e apaga logicamente a antiga; as respostas já gravadas continuam apontando para a linha velha e o relatório histórico — que agrega por id de pergunta e de opção — se desliga das respostas antigas. É uma quebra silenciosa: nada falha, o gráfico só empobrece.
- **A lista nunca é um delta.** Por isso o editor só abre com o questionário carregado pela consulta de **detalhe**: a listagem devolve `questions: []` sempre, e salvar a partir da linha da tabela mandaria uma lista vazia — que significa "apague todas as perguntas".

O `sortOrder` é derivado da posição no array no momento do submit, e não guardado no rascunho: com os dois, a ordem exibida e a ordem gravada poderiam divergir sem nada acusar.

### 3. Remover pergunta é remoção lógica, e quem decide é o servidor

A pergunta some da lista na tela, mas no banco ela vira `is_deleted = true` — a linha continua existindo porque as respostas dos resgates apontam para ela com FK `RESTRICT`. A tela **não tenta adivinhar** se uma pergunta já foi respondida: manda o questionário desejado e, se o servidor recusar, mostra a frase que ele devolveu (`describeApiError`). Qualquer heurística local aqui seria um palpite sobre dado que a tela não tem.

### 4. Limites do questionário

No máximo **6 perguntas**, de **2 a 8 opções** por pergunta, rótulos distintos dentro da mesma pergunta. É fila de caixa, não formulário de pesquisa: cada pergunta a mais é tempo do cliente no balcão.

A pergunta com menos de duas opções é marcada na hora no editor e **barra o submit** com a mesma frase que o backend usaria — uma alternativa só não é pergunta, é aviso. Opção com o campo em branco **não conta**: campo vazio é "não preenchi", e contá-lo faria a tela liberar um payload que voltaria como 400.

### 5. Cupons vinculados

Os cupons de uma campanha saem de `useGetCoupons({ campaignId })` — a mesma tabela paginada da tela de Cupons —, e não de uma coleção dentro da campanha. A modal os lista porque **campanha sem cupom não chega ao caixa**: o PDV encontra o questionário pelo código do cupom e nunca pela campanha. Uma campanha com questionário caprichado e nenhum cupom apontando para ela simplesmente não acontece, e sem essa lista o administrador só descobre isso quando o relatório vem zerado.

O atalho "Cupom nesta campanha" leva a `/marketing/cupons?campanha=<id>&novo=1`. A tela de Cupons é quem lê esses parâmetros; se ela os ignorar, o atalho degrada para "abrir a tela de cupons" e nada quebra.

### 6. Cache

Toda mutação invalida três prefixos: `["Campaigns"]`, `["CampaignDetails"]` e `["Coupons"]`. O terceiro não é excesso — a linha do cupom carrega `campaignName` já resolvido pelo servidor, então renomear a campanha aqui deixaria a outra tela exibindo o nome antigo até o cache expirar.

## O que NÃO está aqui

- **Relatório e comparativo** (`useGetCampaignReport`, `useGetCampaignComparison`) — outra tela, outro hook.
- **Cadastro de cupom** — `features/coupons/`. Desconto, vigência do panfleto e limite de uso são de lá.
- **Consulta do balcão** — `lookupPdvCoupon`, no PDV. O caixa nunca sabe que a campanha existe.
