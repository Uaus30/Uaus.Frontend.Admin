# Contrato do backend

Os DTOs de `packages/api-client/src/models.ts` são escritos à mão e descrevem um
servidor que está em **outro repositório** (`Uaus.Backend.Api`). Nada no
TypeScript garante que essa descrição continue verdadeira: o compilador confere
o que o código faz com o tipo, nunca se o tipo corresponde ao JSON que chega na
rede.

Este documento é sobre a regra de serialização que torna esse descompasso
silencioso, sobre o que ela já custou, e sobre como escrever DTO novo sem cair
nela.

---

## 1. A regra: campo nulo não vem `null`, ele SOME

`Uaus.Api/Extensions/ControllersExtensions.cs` configura o serializador assim:

```csharp
options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
```

Com isso, propriedade que vale `null` **não é escrita no JSON**. Não vira
`"campo": null` — a chave inteira desaparece da resposta.

O mesmo DTO, com e sem valor:

```jsonc
// PerformanceRangeDto com base de comparação
{ "revenue": 1200.5, "salesCount": 30, "previousRevenue": 900, "changePercentage": 33.39 }

// PerformanceRangeDto sem base de comparação (ChangePercentage == null)
{ "revenue": 1200.5, "salesCount": 30, "previousRevenue": 0 }
```

Do lado do JavaScript, ler uma chave que não existe devolve `undefined` — e
`undefined` **não é** `null`.

Outras duas decisões do mesmo arquivo entram no contrato pela mesma porta:

| Configuração                 | Efeito no JSON                                                             |
| ---------------------------- | -------------------------------------------------------------------------- |
| `WhenWritingNull`            | propriedade nula é omitida                                                 |
| `JsonStringEnumConverter`    | enum viaja pelo **nome** do membro (`"Admin"`), não pelo número            |
| `JsonSerializerDefaults.Web` | nome da propriedade em camelCase (`ChangePercentage` → `changePercentage`) |

---

## 2. O que isso já custou

**A tela de Desempenho do PDV, preta.** O backend declarava
`public decimal? ChangePercentage { get; set; }`; o `models.ts` declarava
`changePercentage: number | null`. O tipo dizia "o campo vem sempre, às vezes
valendo nulo". O servidor omitia o campo, ele chegava `undefined`, e o
`=== null` da tela nunca dava `true`: a renderização seguia por um caminho que
não estava preparado para ausência.

Três detalhes de por que isso passou por tudo:

- **O compilador não tinha como saber.** Ele confere o uso contra o tipo
  declarado; o tipo declarado é que estava errado.
- **O teste unitário passava.** Os dublês eram montados a partir do próprio
  tipo, então traziam `changePercentage: null` — o valor que a produção nunca
  manda.
- **`T | null` sem `?` parece cuidado.** Quem escreve acha que está sendo
  defensivo. Está declarando presença garantida.

A conferência automatizada (seção 4) encontrou o mesmo defeito em outros
lugares, e vale conhecer os três formatos:

1. **`SupplierDto.phone`, `city`, `state`, `avatarColor`, `salesRepresentative`** —
   `string?` no C#, `string` puro no TypeScript. Pior que o caso original:
   como o tipo não admite nem nulo, qualquer `.trim()` ou `.toLowerCase()`
   estoura com _cannot read properties of undefined_ no primeiro fornecedor sem
   telefone.
2. **`ProductDto.canDelete` e `ProductGroupDto.canDelete`** — o campo **não
   existe** no backend. Chega `undefined` sempre, e o
   `variation.canDelete === false` de `ProductVariationsSection.tsx` nunca
   desabilita o botão que deveria proteger.
3. **`SupplierDto.status`, `UserDto.role` e outros sete** — enum tipado como
   `number` enquanto o servidor manda `"Active"`. Comparar com número nunca dá
   `true`; foi assim que o filtro de status de fornecedores errou uma vez.

O padrão é o mesmo nos três: **o tipo mentiu e nada quebrou na hora**. O defeito
aparece semanas depois, na tela, com um dado que ninguém consegue reproduzir
localmente.

---

## 3. Como escrever DTO novo sem cair nela

A pergunta não é "esse campo pode ser nulo?". É **"o C# declara esse campo como
anulável?"**. Se declara, o campo pode não chegar.

| No C#                               | No JSON                    | No `models.ts`                      |
| ----------------------------------- | -------------------------- | ----------------------------------- |
| `decimal Revenue`                   | sempre presente            | `revenue: number`                   |
| `decimal? ChangePercentage`         | **omitido** quando nulo    | `changePercentage?: number \| null` |
| `string Name { get; set; } = ""`    | sempre presente            | `name: string`                      |
| `string? Description`               | **omitido** quando nulo    | `description?: string \| null`      |
| `DateTime? UpdatedAt`               | **omitido** quando nulo    | `updatedAt?: string \| null`        |
| `List<ItemDto> Items { get; } = []` | `[]` presente              | `items: ItemDto[]`                  |
| `UserRole Role`                     | `"Admin"` (texto)          | `role: EnumValue` + `enumCode()`    |
| `PeriodDto Sales { get; } = null!`  | some se o serviço esquecer | trate como anulável                 |

Quatro regras práticas:

1. **`?` e `| null` andam juntos.** O `?` é o que importa (o campo pode não
   vir); o `| null` fica por segurança, porque um dia alguém pode trocar o
   `DefaultIgnoreCondition` e aí o `null` passa a viajar de verdade.
2. **Compare com `== null`, nunca com `=== null`.** `== null` é `true` para
   `null` **e** para `undefined` — é o único operador que cobre os dois estados
   que este backend produz. `??` e `?.` também cobrem.
3. **Enum é `EnumValue`, lido com `enumCode()`.** O servidor manda o nome do
   membro; a tela trabalha com o código numérico. Tipar como `number` é declarar
   um formato que a API não usa.
4. **`= null!` no C# não é garantia.** É o desenvolvedor prometendo ao
   compilador que vai preencher. Se o serviço esquecer, o campo some igualzinho
   a um anulável.

Data e hora merecem nota à parte: elas chegam como **texto** (`string`), nunca
como `Date`. Converter na borda e nunca com `toISOString()` para data de
calendário — a armadilha 2 do `CLAUDE.md`.

---

## 4. O retrato do contrato dentro deste repositório

O backend é outro repositório, então o CI daqui não tem o código C# à mão. Sem
uma cópia do contrato versionada aqui, a conferência só rodaria na máquina de
quem tem os dois clones — ou seja, não rodaria.

`scripts/contrato/contrato-backend.json` é essa cópia: as classes de
`Uaus.Application/DTOs`, cada propriedade com tipo, anulabilidade e nome já em
camelCase, mais os enums e a configuração de serialização que estava valendo.

```bash
# regerar o retrato (precisa do clone do backend)
node scripts/contrato/extrair-contrato.mjs --backend ../Uaus.Backend.Api

# conferir o models.ts contra o retrato (não precisa do backend)
node scripts/contrato/conferir-contrato.mjs

# ver tudo, não só as dez piores
node scripts/contrato/conferir-contrato.mjs --todos
```

**Quando o backend mudar um DTO, o retrato tem que ser regerado no mesmo PR do
front que acompanha a mudança.** É o que faz a mudança de contrato aparecer no
diff, para o revisor, em vez de aparecer na tela, para o cliente.

---

## 5. O portão do CI

`.github/workflows/contrato.yml` roda a conferência em todo PR e reprova
**divergência nova**. As que já existiam quando o portão nasceu estão em
`scripts/contrato/divergencias-conhecidas.json`.

O baseline não é indulgência, é sobrevivência do portão: com 63 divergências
herdadas, um portão que reprovasse todas nasceria vermelho, seria marcado como
"não obrigatório" na primeira semana e deixaria de existir. Assim ele nasce
verde e cobra só o que for escrito de agora em diante.

O arquivo **só encolhe**. Depois de consertar campos no `models.ts`, rode
`node scripts/contrato/conferir-contrato.mjs --atualizar-baseline` para travar o
ganho. Rodar isso para calar uma divergência nova, sem consertar nada, é
escolher a próxima tela preta — e aparece no diff do PR como o que é.

Idade do retrato só **avisa**, nunca reprova: o CI do front não tem como saber o
HEAD do backend, e um PR vermelho por um motivo que o autor não consegue
resolver dentro do PR dele é a maneira mais rápida de o portão ser desligado.

---

## 6. O que a conferência NÃO vê

Verde aqui **não é** prova de que o contrato está correto. A comparação é
léxica, não semântica, e estes buracos são conhecidos:

- **Genérico.** `BackendPagedResult<T>` só é conferido no que não depende do `T`.
- **Polimorfismo.** `object`, `dynamic` e `JsonElement` são pulados.
- **Tipo utilitário do TypeScript.** `Omit`, `Pick`, `Partial` e `export type`
  com união ficam de fora — resolver isso exigiria o compilador do TypeScript.
- **Payload de requisição.** Não entra: a direção do nulo se inverte (quem
  promete é o front) e a validação de verdade mora em atributo e em
  `FluentValidation`, não no tipo.
- **Objeto anônimo montado no controller.** Não existe classe para comparar.
- **`[JsonPropertyName]`, `[JsonIgnore]` e conversor por propriedade.** Não são
  lidos; hoje não há nenhum nos DTOs, mas o dia em que houver o comparador vai
  errar calado.
- **O que o serviço realmente preenche.** O comparador lê a declaração, não o
  código que monta o DTO.

O relatório imprime essa lista em toda execução, de propósito. Detector que se
anuncia completo é pior do que detector que declara o limite: o primeiro faz
confiar num verde que não cobre o caso que interessa.
