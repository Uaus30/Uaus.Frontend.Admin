/**
 * Etiquetas — REEXPORT, não implementação.
 *
 * A implementação está em `packages/api-client/src/hooks/tags.ts`. Este arquivo
 * sobrevive por dois importadores que ainda não migraram:
 *
 * - `components/tag-multi-select.tsx` (`searchTags`, `createTag`);
 * - `hooks/use-catalog.ts` e `features/sales` (`getAllTags`).
 *
 * A feature de etiquetas já não passa por aqui: ela usa `useGetTags`,
 * `useCreateTag`, `useUpdateTag` e `useDeleteTag`. Não acrescente função neste
 * arquivo — ele só encolhe.
 */

export {
  createTag,
  deleteTag,
  getAllProductTags,
  getAllTags,
  getTagsPage,
  searchTags,
  updateTag,
} from "@workspace/api-client-react";
