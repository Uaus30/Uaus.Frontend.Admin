/**
 * Base local **de verdade** para os testes da camada `offline/`.
 *
 * Estes testes rodam contra `fake-indexeddb`, uma implementação em memória do
 * IndexedDB, em vez de dublarem `idb.ts`. A diferença não é preciosismo: o que
 * quebra em silêncio nesta camada é o comportamento do banco — a migração que
 * recria store, a chave primária que impede a mesma venda de entrar duas vezes,
 * a transação que serializa dois débitos de estoque concorrentes. Um dublê de
 * `idb.ts` devolve o que o próprio teste mandou devolver e não sabe nada disso;
 * ele provaria que o código chama as funções certas, nunca que o dado sobrevive.
 *
 * Documentação do que está sendo exercitado: `apps/pdv/docs/offline.md`.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { invalidateProductsCache } from "@/offline/catalog";
import { closeLocalDatabase } from "@/offline/database";

/**
 * Zera a base local antes de cada teste: descarta a conexão memoizada por
 * `database.ts`, o cache de produtos de `catalog.ts` e o banco inteiro.
 *
 * Os dois primeiros são estado de módulo — sem descartá-los, o segundo teste do
 * arquivo leria a conexão e o catálogo do primeiro, e a ordem dos testes
 * passaria a mudar o resultado.
 *
 * O banco é zerado trocando a **fábrica** do IndexedDB por uma nova, e não com
 * `deleteDatabase`: apagar espera as conexões abertas fecharem, e a conexão que
 * `database.ts` guarda fecha de forma assíncrona — a espera transformaria a
 * limpeza numa corrida. Fábrica nova é um navegador novo, sem corrida nenhuma.
 */
export function resetLocalDatabase(): void {
  closeLocalDatabase();
  invalidateProductsCache();
  globalThis.indexedDB = new IDBFactory();
}

/**
 * Formata um instante no formato que o PDV usa em toda data enviada à API e
 * gravada na fila: horário local, sem `Z` e sem deslocamento.
 *
 * Existe para os testes não usarem `toISOString()` — que devolve UTC e, no
 * Brasil, joga o instante três horas para frente na leitura seguinte (armadilha
 * 5 do CLAUDE.md). Aqui o efeito seria só um teste confuso; no código de
 * produção é a validade do cupom acabando às 20:59.
 */
export function toLocalTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
