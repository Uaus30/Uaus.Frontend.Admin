# Uaus Frontend Office (Monorepo)

Este é o repositório central dos aplicativos Frontend da Uaus. Ele é estruturado como um monorepo e utiliza Vite, React e TypeScript.

## Estrutura do Monorepo

- `apps/admin`: Painel de administração central (Retaguarda).
- `apps/pdv`: Ponto de Venda.
- `packages/api-client`: SDK gerado (Orval) e utilitários para integração com a API.
- `packages/receipt`: Lógica e templates para impressão de recibos.
- `packages/ui`: Biblioteca de componentes de UI compartilhados (Shadcn/Lucide).

## Scripts Principais

- `npm install`: Instala as dependências e faz o link dos workspaces.
- `npm run dev:admin`: Inicia o Admin em ambiente de desenvolvimento.
- `npm run dev:pdv`: Inicia o PDV em ambiente de desenvolvimento.
- `npm run build`: Faz o build de produção do Admin (default Vercel).
- `npm run typecheck:admin` / `npm run typecheck:pdv`: Executa validação de tipos estáticos.
- `npm test`: Roda os testes unitários via Vitest.

## Diretrizes de Agentes e IA

Consulte as regras locais em [.agents/AGENTS.md](./.agents/AGENTS.md) antes de realizar manutenções autônomas neste repositório.
