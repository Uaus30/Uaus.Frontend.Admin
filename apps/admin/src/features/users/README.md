# Módulo de Usuários (`features/users`)

Cadastro, edição, remoção lógica e reset de senha dos usuários do sistema — os
mesmos que operam o PDV.

---

## ⚙️ Regras de Negócio

### 1. O ciclo da senha

É a regra que organiza a feature inteira. São três estados e dois eventos:

```
cadastro ──> Pendente ──(usuário troca a senha)──> Ativo
                 ^                                   │
                 └──────(admin reseta a senha)───────┘
```

- **O cadastro não escolhe senha.** O servidor grava a `System:DefaultPassword`
  do `appsettings` e deixa o usuário **Pendente**. A modal não tem campo de
  senha, e o `CreateUserPayload` não tem a propriedade.
- **A senha do primeiro acesso é mostrada uma vez**, na `FirstAccessDialog`, logo
  após cadastrar ou resetar. Ela vem **da resposta do servidor**, nunca de uma
  constante na tela: uma cópia aqui passaria a mentir no dia em que aquele valor
  mudasse no `appsettings`, e o admin repassaria uma senha que não abre nada.
- **Só a troca de senha promove a Ativo.** O `UserService` recusa a promoção pela
  tela de edição (`BusinessException`), e o hook nem oferece "Ativo" no select de
  um usuário Pendente. Sem isso a obrigação de trocar seria enfeite: o admin
  ativaria a conta e o operador seguiria entrando com a senha que o sistema
  inteiro conhece.
- **Bloquear e inativar um Pendente continuam liberados** — são as ações de quem
  cadastrou errado ou desistiu da contratação.
- **Resetar devolve tudo ao início**: senha padrão e status Pendente. Não é
  "definir uma senha nova" de propósito — o administrador não precisa escolher, e
  não fica sabendo uma senha pessoal que o operador vá manter em uso.

> **O defeito que originou isto.** A modal pedia uma senha no cadastro e o
> `UserService` a descartava, gravando a padrão. O administrador entregava as
> credenciais ao operador e o PDV recusava com **"Senha inválida!"** — sem nada,
> em lugar nenhum, explicando o porquê.

### 2. Onde a troca obrigatória acontece

Nos **dois** apps, e a pergunta é respondida por um único lugar:
`precisaTrocarSenha`, do `api-client`. Admin e PDV discordarem significaria o PDV
liberando o caixa a quem a retaguarda ainda considera pendente.

- **Admin**: no `AuthGate` (`components/route-guards.tsx`), antes de qualquer
  tela. No gate e não numa rota — rota daria para pular pela URL.
- **PDV**: no `usePdvOperator`, antes de qualquer venda. Uma venda registrada por
  quem ainda usa a senha padrão ficaria atribuída a um operador que qualquer
  pessoa poderia ter sido.

O `useChangePassword` regrava a sessão do `localStorage` **dentro do
`mutationFn`**, não num `onSuccess`: o `useCrudMutation` espalha as opções de
quem chama por cima das nossas, e um `onSuccess` do app apagaria a gravação. O
sintoma seria a tela de troca reaparecendo para sempre.

### 3. Papel e Status chegam como TEXTO

A API registra `JsonStringEnumConverter`: `GET /Users` devolve `role: "Seller"`,
`status: "Pending"` — o nome do membro do enum em C#, não o número.

Todo ponto que lê esses campos passa por `enumCode`. O `openEdit` fazia
`String(user.role)` e procurava a opção `"Seller"` num `<Select>` cujos valores
são `"1"` e `"2"`: **os campos Papel e Status abriam em branco**, sem erro no
console, e salvar assim rebaixava o papel do usuário. A tabela caía no mesmo
buraco pelo fallback, mostrando "Seller" e "Pending" em inglês.

O mesmo defeito já havia escondido meia retaguarda pelo `routes.ts` — ver o JSDoc
de `codigoDoPapel` lá.

### 4. Quem pode entrar

`AuthenticateAsync` só aceita **Pendente** e **Ativo**. Pendente entra de
propósito: a troca da senha acontece _depois_ de autenticar, e barrá-lo deixaria
a conta impossível de estrear.

A verificação de status vem **depois** da verificação da senha — responder
"usuário bloqueado" a quem errou a senha confirmaria de graça que aquele login
existe.

### 5. Separação de nome

O formulário usa um campo único ("Nome completo") e a API espera `firstName` e
`lastName` apartados. O mapeamento é feito no envio, pelo `splitFullName`.

---

## 🔌 Endpoints

| Verbo  | Caminho                      | Quem   | O que faz                                 |
| ------ | ---------------------------- | ------ | ----------------------------------------- |
| `POST` | `/Users`                     | Admin  | Cadastra Pendente; devolve a senha padrão |
| `PUT`  | `/Users`                     | Admin  | Edita; recusa promover Pendente a Ativo   |
| `POST` | `/Users/change-password`     | Logado | Troca a própria senha; Pendente → Ativo   |
| `POST` | `/Users/{id}/reset-password` | Admin  | Volta à senha padrão e a Pendente         |

A troca de senha **não recebe id**: o servidor tira o alvo do token. Aceitar id
deixaria qualquer autenticado reescrever a senha de qualquer outro.
