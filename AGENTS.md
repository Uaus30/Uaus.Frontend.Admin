# Regras para agentes de IA

Leia também o `CLAUDE.md` da raiz antes de alterar este monorepo; ele contém os
padrões completos de arquitetura, testes, documentação e deploy.

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
