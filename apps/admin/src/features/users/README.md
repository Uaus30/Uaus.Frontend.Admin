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

A resposta da troca traz também um **token novo**, gravado junto
(`applyPasswordChange`, no `api-client`). Desde 03/10/2026 a troca de senha
derruba todo token emitido antes dela — o deste aparelho e o de qualquer outro
onde a conta esteja aberta —, e é o token novo que mantém dentro quem acabou de
trocar.

### 2.1. Não existe perfil de usuário (03/10/2026)

Decisão do dono: quem tem login faz tudo. O cadastro não tem papel — nem na
tela, nem no pedido, nem no banco (a coluna `users.role` foi removida). Em
01/10/2026 o perfil Vendedor já tinha sido desativado; em 03/10 saiu o conceito
inteiro. Se um controle por perfil voltar, ele é desenhado de novo — o porquê e
o que foi removido estão em
`Uaus.Docs/historico/2026-10-03-fim-dos-perfis-de-usuario.md`.

### 3. O Status chega como TEXTO

A API registra `JsonStringEnumConverter`: `GET /Users` devolve
`status: "Pending"` — o nome do membro do enum em C#, não o número.

Todo ponto que lê esse campo passa por `enumCode`. O `openEdit` fazia
`String(user.status)` e procurava a opção `"Pending"` num `<Select>` cujos
valores são `"1"`, `"2"`...: **o campo Status abria em branco**, sem erro no
console. A tabela caía no mesmo buraco pelo fallback, mostrando "Pending" em
inglês.

### 4. Quem pode entrar

`AuthenticateAsync` só aceita **Pendente** e **Ativo**. Pendente entra de
propósito: a troca da senha acontece _depois_ de autenticar, e barrá-lo deixaria
a conta impossível de estrear.

A verificação de status vem **depois** da verificação da senha — responder
"usuário bloqueado" a quem errou a senha confirmaria de graça que aquele login
existe.

**Quem já está dentro também é conferido**, a cada requisição
(`IsSessionValidAsync`). Bloquear, inativar ou excluir o cadastro, e resetar a
senha, derrubam a sessão **na hora**: a próxima requisição daquele aparelho
responde 401 e ele volta ao login. Antes de 03/10/2026 nada disso tirava quem já
estava logado — o token seguia valendo até vencer. Reativar a conta não devolve a
sessão a um aparelho que já foi levado ao login; para derrubar um token que
possa ter vazado, o caminho é o **reset de senha**.

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
| `POST` | `/Users/renew-session`       | Logado | Troca o token por um novo, de 7 dias      |

A troca de senha **não recebe id**: o servidor tira o alvo do token. Aceitar id
deixaria qualquer autenticado reescrever a senha de qualquer outro.
