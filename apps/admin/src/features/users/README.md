# Módulo de Usuários (`features/users`)

Este módulo gerencia a listagem, criação (com definição de senha inicial), edição e remoção (lógica) dos usuários administrativos do sistema. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

- `components/UsersTable.tsx`: Tabela de apresentação de usuários administrativos com badges de papéis e status, e opções de ação (editar e deletar).
- `components/UserEditorModal.tsx`: Modal contendo o formulário de criação/edição de usuário, com controle sobre campos obrigatórios e condicionais (ex: senha inicial visível apenas ao cadastrar novo usuário).
- `hooks/useUsers.ts`: Centraliza consultas de usuários, opções de enums da API (`user-role` e `user-status`), mutations de persistência e acoplamento com mappers utilitários.
- `types.ts`: Tipagens e contratos locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Separação de Nome

- O formulário utiliza um único campo amigável para o nome completo do usuário ("Nome completo"), mas a API espera os campos apartados `firstName` e `lastName`. O mapeamento é realizado no envio via helper `splitFullName`.

### 2. Papéis e Status (Enums)

- Os papéis (`role`) e status (`status`) são dinâmicos e carregados dos enums do backend, garantindo sincronia direta.
- A exibição do ícone do papel se adapta com base no ID do enum (`1` representa o Administrador com ícone de escudo de verificação).

### 3. Gestão de Senhas

- A senha é um campo obrigatório apenas no momento do cadastro inicial do usuário. Na modal de edição de um usuário existente, o campo de senha não é exibido, pois a redefinição de senhas segue um fluxo apartado por motivos de segurança.
