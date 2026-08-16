/**
 * Fornecedores — REEXPORT, não implementação.
 *
 * A implementação está em `packages/api-client/src/hooks/suppliers.ts`, junto
 * com o enum de status, que antes chegava aqui como string de caminho passada
 * ao `getEnumOptions` genérico do `services/core.ts`.
 *
 * O único importador restante é `hooks/use-catalog.ts` (`getAllSuppliers`), e
 * os testes de `features/inventory` e `features/stock-entries` dublam este
 * módulo. A feature de fornecedores já usa os hooks (`useGetSuppliers`,
 * `useCreateSupplier`…). Não acrescente função aqui.
 */

export {
  createSupplier,
  deleteSupplier,
  getAllSuppliers,
  getSuppliersPage,
  updateSupplier,
} from "@workspace/api-client-react";
