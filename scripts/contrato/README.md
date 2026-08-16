# scripts/contrato

Conferência entre os DTOs escritos à mão em `packages/api-client/src/models.ts`
e as classes DTO do backend .NET (`Uaus.Backend.Api`).

**O porquê, o defeito que motivou tudo isso e como escrever DTO novo estão em
[`docs/contrato-backend.md`](../../docs/contrato-backend.md).** Aqui fica só o
manual dos comandos.

## Comandos

```bash
# conferir (não precisa do backend; usa o retrato commitado)
node scripts/contrato/conferir-contrato.mjs
node scripts/contrato/conferir-contrato.mjs --todos          # lista tudo
node scripts/contrato/conferir-contrato.mjs --sem-portao     # só relata, sai 0
node scripts/contrato/conferir-contrato.mjs --json           # saída para outro script

# regerar o retrato do backend (precisa do clone do backend)
node scripts/contrato/extrair-contrato.mjs --backend ../Uaus.Backend.Api

# depois de consertar campos no models.ts, travar o ganho
node scripts/contrato/conferir-contrato.mjs --atualizar-baseline

# testes do próprio comparador
npx vitest run --root scripts/contrato
```

Saída do `conferir`: `0` tudo certo · `1` divergência nova · `2` erro de uso ou
parser que não achou nada.

## Arquivos

| Arquivo                        | O que é                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `extrair-contrato.mjs`         | Lê o C# e grava o retrato. Roda na máquina de quem tem os 2 clones |
| `conferir-contrato.mjs`        | Compara retrato × `models.ts`. Roda no CI, sem dependência         |
| `contrato-backend.json`        | O retrato. **Gerado** — não edite à mão                            |
| `divergencias-conhecidas.json` | Baseline. Só encolhe                                               |
| `lib/parse-csharp.mjs`         | Classes, propriedades, anulabilidade e camelCase do .NET           |
| `lib/parse-typescript.mjs`     | Interfaces exportadas, `?` e `\| null`                             |
| `lib/comparar.mjs`             | As regras e a severidade de cada uma                               |
| `lib/type-match.mjs`           | Equivalência de tipos depois do `System.Text.Json`                 |
| `lib/relatorio.mjs`            | Saída de terminal e resumo do GitHub Actions                       |
| `lib/comparar.test.mjs`        | Reproduz os defeitos reais que a ferramenta tem que pegar          |

Zero dependência externa, só a biblioteca padrão do Node — é o que permite o job
do CI dar veredito em segundos, sem `npm ci`. Vitest só é necessário para os
testes.

## Regras e severidade

Reprovam o CI quando são novas (`alto` e `medio`):

| Regra                          | O que significa                                                    |
| ------------------------------ | ------------------------------------------------------------------ |
| `nulo-nao-declarado`           | C# anulável; o tipo do front não aceita nem ausência nem nulo      |
| `nulo-sem-opcional`            | C# anulável; o tipo tem `\| null` mas exige presença (falta o `?`) |
| `enum-como-numero`             | enum serializado pelo nome, campo tipado `number`                  |
| `campo-inexistente-no-backend` | o front declara campo que a resposta não traz                      |
| `colecao-divergente`           | lista de um lado, valor único do outro                             |
| `tipo-incompativel`            | primitivo trocado (`decimal` × `string`, por exemplo)              |

Só informam (`baixo`):

| Regra                         | O que significa                                               |
| ----------------------------- | ------------------------------------------------------------- |
| `opcional-a-mais`             | `?` num campo que o C# garante — defensivo à toa              |
| `campo-ausente-no-typescript` | a API manda e o front não declara                             |
| `nulo-perdoado`               | o C# usa `= null!`: promete não-nulo com a checagem desligada |
