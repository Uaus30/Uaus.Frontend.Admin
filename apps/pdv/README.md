# Uaus! PDV

Ponto de venda do balcão: busca de produtos, carrinho, checkout com N formas de
pagamento, sessão de caixa, cupom em bobina de 80mm — e **operação offline**.

React 19 + Vite + Tailwind 4 + Zustand + TanStack Query, com IndexedDB e service
worker para o modo offline.

## Rodando

```bash
npm run dev:pdv
```

Sobe em `http://localhost:5174`. As chamadas para `/api` são encaminhadas para
`https://localhost:44398` — sobrescreva com `VITE_API_PROXY_TARGET` quando a API
estiver em outra porta.

O service worker é **desligado em desenvolvimento** de propósito: ele serviria
bundle antigo e atrapalharia o HMR. Para exercitar o modo offline é preciso o
build:

```bash
npm run build:pdv
npm run preview --workspace=@workspace/pdv
```

O roteiro de teste do offline está em [`docs/offline.md`](docs/offline.md).

## Verificações

```bash
npm run typecheck:pdv
npm run test:pdv
```

## Estrutura

```
src/
├── pages/          login e a tela do PDV
├── components/     UI do balcão (calculadora, consumidor, fila offline...)
├── stores/         estado do PDV, da calculadora e do modo offline (Zustand)
├── hooks/          sessão de caixa, conexão, orquestração do offline
├── services/       registro de venda (online e offline)
├── offline/        base local em IndexedDB e fila de vendas — sem React
└── lib/            formatação e utilidades
```

Pacotes do workspace usados aqui:

- `@workspace/api-client-react` — cliente HTTP, tipos dos DTOs e hooks de consulta.
- `@workspace/receipt` — montagem e impressão de cupom e relatório de caixa.

## Operação offline

O PDV continua vendendo durante queda de internet ou de energia: o app abre do
cache do service worker, consulta a base local no IndexedDB e guarda as vendas
numa fila que sobe sozinha quando a conexão volta.

- Como funciona, o que é limitação consciente e como testar:
  [`docs/offline.md`](docs/offline.md)
- Contrato dos endpoints:
  [`../../../Uaus.Backend.Api/docs/pdv-offline.md`](../../../Uaus.Backend.Api/docs/pdv-offline.md)

**Abrir e fechar o caixa exigem internet**, e o fechamento é bloqueado enquanto
houver venda pendente de sincronização. Os motivos estão na documentação.
