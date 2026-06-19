# Módulo de Login (`features/login`)

Este módulo gerencia a autenticação e o formulário de login para o painel administrativo. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

*   `components/LoginForm.tsx`: Formulário visual de login com campos de identificador (e-mail ou usuário) e senha, botão de submissão animado e layout responsivo.
*   `hooks/useLoginFeature.ts`: Centraliza a mutation de login do Query Client, tratamentos de sucesso e erro e redirecionamento de rotas.
*   `types.ts`: Tipagens locais da feature.

---

## ⚙️ Regras de Negócio Importantes

### 1. Fluxo de Autenticação
*   Após o preenchimento dos campos obrigatórios, os dados são transmitidos à API usando a mutation de login do React Query.
*   Em caso de sucesso:
    *   O estado local da sessão ativa (`getGetMeQueryKey`) é atualizado com o usuário retornado.
    *   O painel redireciona o usuário para o `/dashboard`.
*   Em caso de erro, uma notificação de toast com variante "destructive" detalha o erro retornado ou exibe mensagem padrão ("Credenciais inválidas. Tente novamente.").
