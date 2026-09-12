import { CheckCircle2, ImageOff, PartyPopper, Search, Undo2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
} from "@workspace/ui";
import { buildPublicImageUrl, type InventoryCountItemDto } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@workspace/core";

import type { InventoryCountState } from "../types";
import { photoCoverage } from "../lib/photo-coverage";

/**
 * A lista de conferência.
 *
 * Abre nos PENDENTES e encolhe conforme o trabalho anda — marcar um item o tira
 * da tela. Os conferidos ficam a um clique, no seletor de situação, porque
 * desmarcar um clique errado precisa de caminho de volta.
 *
 * A correção em si acontece na tela do produto: "Abrir produto" leva para lá,
 * onde já existem foto, nome, preço, variações e a contagem de estoque. Marcar
 * como conferido também pode ser feito de lá, sem voltar a esta lista.
 */
export function InventoryCountTable({ state }: { state: InventoryCountState }) {
  const semNada = !state.isLoadingItems && state.items.length === 0;
  const tudoConferido = semNada && state.statusFilter === "pending" && !temFiltro(state);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="text-lg font-semibold">Cadastros a conferir</CardTitle>
          <CardDescription>
            Abra o produto, acerte o que precisar e marque como conferido — ele sai da lista.
          </CardDescription>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou código..."
              className="h-9 pl-8"
              value={state.search}
              onChange={(event) => state.setSearch(event.target.value)}
            />
          </div>

          <Select value={state.categoryId} onValueChange={state.setCategoryId}>
            <SelectTrigger className="h-9" aria-label="Categoria">
              <SelectValue placeholder="Categoria: Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Categorias: Todas</SelectItem>
              {state.categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={state.statusFilter}
            onValueChange={(value) => state.setStatusFilter(value as InventoryCountState["statusFilter"])}
          >
            <SelectTrigger className="h-9" aria-label="Situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">A conferir</SelectItem>
              <SelectItem value="reviewed">Já conferidos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3">
            <Checkbox
              id="conferencia-sem-foto"
              checked={state.onlyWithoutImage}
              onCheckedChange={(checked) => state.setOnlyWithoutImage(checked === true)}
            />
            <Label htmlFor="conferencia-sem-foto" className="cursor-pointer text-sm font-normal">
              Só quem tem variação sem foto
            </Label>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {state.isLoadingItems ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : tudoConferido ? (
          <div className="py-14 text-center text-muted-foreground">
            <PartyPopper className="mx-auto mb-3 h-12 w-12 text-emerald-500 opacity-60" />
            <p className="font-semibold text-foreground">Nada pendente por aqui.</p>
            <p className="text-sm">Ao conferir o último cadastro, a conferência se encerra sozinha.</p>
          </div>
        ) : semNada ? (
          <div className="py-14 text-center text-muted-foreground">
            <Search className="mx-auto mb-3 h-12 w-12 opacity-20" />
            <p>Nenhum cadastro corresponde aos filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-16 px-4 py-3">Foto</TableHead>
                  <TableHead className="px-4 py-3">Produto</TableHead>
                  <TableHead className="px-4 py-3">Variações</TableHead>
                  <TableHead className="w-28 px-4 py-3 text-center">Estoque</TableHead>
                  <TableHead className="w-28 px-4 py-3 text-right">Preço</TableHead>
                  <TableHead className="w-56 px-4 py-3">Situação</TableHead>
                  <TableHead className="w-64 px-4 py-3 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.items.map((item) => (
                  <Linha
                    key={item.id}
                    item={item}
                    marcando={state.reviewingGroupId === item.productGroupId}
                    onOpen={() => state.openProduct(item.productGroupId)}
                    onReview={() => state.review(item.productGroupId, !item.reviewed)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <TablePagination
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          onPageChange={state.setPage}
          onPageSizeChange={state.setPageSize}
          pageSizeOptions={[20, 50, 100]}
          itemLabel={{ singular: "cadastro", plural: "cadastros" }}
          className="mt-4"
        />
      </CardContent>
    </Card>
  );
}

function temFiltro(state: InventoryCountState) {
  return state.search.trim() !== "" || state.categoryId !== "all" || state.onlyWithoutImage;
}

function Linha({
  item,
  marcando,
  onOpen,
  onReview,
}: {
  item: InventoryCountItemDto;
  marcando: boolean;
  onOpen: () => void;
  onReview: () => void;
}) {
  const foto = photoCoverage(item);

  return (
    <TableRow className="transition-colors hover:bg-muted/10">
      <TableCell className="px-4 py-3">
        {item.imageUrl ? (
          <img
            src={buildPublicImageUrl(item.imageUrl)}
            alt={item.productGroupName}
            className="h-10 w-10 rounded-md border border-border/40 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-destructive/40 bg-destructive/5">
            <ImageOff className="h-4 w-4 text-destructive" />
          </span>
        )}
      </TableCell>

      <TableCell className="max-w-[280px] px-4 py-3">
        <button
          type="button"
          onClick={onOpen}
          className="truncate text-left text-sm font-semibold text-foreground hover:underline"
          title={item.productGroupName}
        >
          {item.productGroupName}
        </button>
        <p className="truncate text-xs text-muted-foreground">{item.categoryName || "Sem categoria"}</p>
      </TableCell>

      <TableCell className="px-4 py-3">
        <span className="text-sm">{item.variationsCount}</span>
        {foto === "missing" && (
          <Badge variant="destructive" className="ml-2 gap-1 text-2xs">
            <ImageOff className="h-3 w-3" /> Sem foto
          </Badge>
        )}
      </TableCell>

      <TableCell className="px-4 py-3 text-center">
        <span className="text-sm font-bold">{item.stock}</span>
        {item.stock !== item.stockAtSnapshot && (
          <p className="text-2xs text-muted-foreground" title="Estoque no início da conferência">
            era {item.stockAtSnapshot}
          </p>
        )}
      </TableCell>

      <TableCell className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(item.price)}</TableCell>

      <TableCell className="px-4 py-3">
        {item.reviewed ? (
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" /> Conferido
            </span>
            <span className="text-2xs text-muted-foreground">
              {item.reviewedAt ? formatDate(item.reviewedAt) : ""}
              {item.reviewedByUserName ? ` · ${item.reviewedByUserName}` : ""}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">A conferir</span>
        )}
      </TableCell>

      <TableCell className="px-4 py-3 text-right">
        <span className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpen} className="hover-elevate">
            Abrir produto
          </Button>
          <Button
            type="button"
            size="sm"
            variant={item.reviewed ? "ghost" : "default"}
            onClick={onReview}
            disabled={marcando}
            className="hover-elevate gap-1.5"
          >
            {marcando ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : item.reviewed ? (
              <Undo2 className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {item.reviewed ? "Desfazer" : "Conferido"}
          </Button>
        </span>
      </TableCell>
    </TableRow>
  );
}
