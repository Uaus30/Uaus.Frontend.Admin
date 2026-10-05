# Módulo de Login (`features/login`)

Este módulo gerencia a autenticação e o formulário de login para o painel administrativo. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

- `components/LoginForm.tsx`: Formulário visual de login com campos de identificador (e-mail ou usuário) e senha, botão de submissão animado e layout responsivo.
- `hooks/useLoginFeature.ts`: Centraliza a mutation de login do Query Client, tratamentos de sucesso e erro e redirecionamento de rotas.
- `types.ts`: Tipagens locais da feature.

---

## ⚙️ Regras de Negócio Importantes

### 1. Fluxo de Autenticação

- Após o preenchimento dos campos obrigatórios, os dados são transmitidos à API usando a mutation de login do React Query.
- Em caso de sucesso:
  - O estado local da sessão ativa (`getGetMeQueryKey`) é atualizado com o usuário retornado.
  - O painel devolve o usuário ao caminho que ele pediu, ou à tela inicial (`/inicio`, a grade de atalhos) quando não há um (ver regra 2).
- Em caso de erro, uma notificação de toast com variante "destructive" detalha o erro retornado ou exibe mensagem padrão ("Credenciais inválidas. Tente novamente.").

### 2. Destino pós-login (`?redirect=`)

Quem chega por link direto sem sessão — o botão "editar produto" do PDV abre `/produtos?busca=...&editar=...` numa aba nova — é mandado ao login pelo `AuthGate`, que carimba o caminho pedido em `?redirect=`. Depois de autenticar, é para lá que o painel vai; sem carimbo, `/inicio` (era `/dashboard` até 05/10/2026).

O caminho é validado no `src/lib/destino-login.ts` e **só caminho relativo deste app passa**. `?redirect=` é texto na URL: sem a validação, `admin.uaus.com.br/login?redirect=https://site-falso` mandado por e-mail transformaria a tela de login numa ponte de phishing — a pessoa confere o domínio verdadeiro, digita a senha, e só então o navegador sai para o site do atacante, já autenticada.

### 3. Quando a senha é pedida de novo

Pedido do dono em 03/10/2026: o admin instalado no celular pedia a senha em toda abertura, porque o token valia 1 dia e não se renovava. Agora a sessão vale **7 dias a contar do último acesso** — cada uso troca o token por um novo, em segundo plano, dentro do `api-client` (ver "A sessão se renova sozinha" em `packages/api-client/README.md`). Esta feature não participa: ela só grava a sessão do login.

A tela de login volta a aparecer em três casos, e só neles:

- mais de 7 dias sem abrir o sistema;
- o cadastro foi bloqueado, inativado ou excluído;
- a senha foi trocada (em outro aparelho) ou resetada pelo administrador.

Os dois últimos valem **na hora**, não no vencimento do token: o servidor confere o usuário a cada requisição e responde 401.
