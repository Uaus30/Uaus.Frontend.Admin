import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Edit2, Loader2, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { generateRandomTagColor } from "@/lib/tag-colors";
import { createTag, deleteTag, getTagsPage, updateTag } from "@/services/tags.service";
import { buildMockTagReport } from "@/lib/mock-data";

type SortDir = "asc" | "desc";
type SortBy = "name" | "productCount" | "createdAt";

function SortIcon({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return direction === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3 text-primary" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3 text-primary" />
  );
}

export default function Tags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", color: generateRandomTagColor(), isPublic: false });
  const [saving, setSaving] = useState(false);

  const { data: tagPage, isLoading } = useQuery({
    queryKey: ["tags-page", { search, page, limit }],
    queryFn: () => getTagsPage({ search, page, limit }),
  });

  const tagsWithCount = useMemo(() => {
    const current = (tagPage?.data ?? []).map((tag) => ({
      ...tag,
      productCount: 0,
    }));

    current.sort((left, right) => {
      const direction = sortDir === "asc" ? 1 : -1;

      if (sortBy === "name") {
        return left.name.localeCompare(right.name, "pt-BR") * direction;
      }

      if (sortBy === "productCount") {
        return (left.productCount - right.productCount) * direction;
      }

      return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
    });

    return current;
  }, [sortBy, sortDir, tagPage?.data]);

  const selectedReport = useMemo(() => {
    if (!selectedTagId) return null;
    const tag = tagsWithCount.find((item) => item.id === selectedTagId);
    if (!tag) return null;
    return buildMockTagReport(tag.name, tag.color);
  }, [selectedTagId, tagsWithCount]);

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(1);
  }

  function openModal(tag?: any) {
    if (tag) {
      setEditingId(tag.id);
      setFormData({ name: tag.name, color: tag.color, isPublic: tag.isPublic ?? false });
    } else {
      setEditingId(null);
      setFormData({ name: "", color: generateRandomTagColor(), isPublic: false });
    }
    setModalOpen(true);
  }

  function randomizeColor() {
    setFormData((current) => ({ ...current, color: generateRandomTagColor() }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        await updateTag({
          id: editingId,
          name: formData.name.trim(),
          color: formData.color,
          isPublic: formData.isPublic,
        });
        toast({ title: "Etiqueta atualizada." });
      } else {
        await createTag({
          name: formData.name.trim(),
          color: formData.color,
          isPublic: formData.isPublic,
        });
        toast({ title: "Etiqueta criada." });
      }

      queryClient.invalidateQueries({ queryKey: ["tags-page"] });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar etiqueta",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tagId: number) {
    try {
      await deleteTag(tagId);
      queryClient.invalidateQueries({ queryKey: ["tags-page"] });
      toast({ title: "Etiqueta removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover etiqueta",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Etiquetas</h1>
            <p className="mt-1 text-muted-foreground">Classifique produtos para análises personalizadas.</p>
          </div>
          <Button onClick={() => openModal()} className="hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Nova Etiqueta
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
          <div className="flex gap-3 border-b border-border/50 p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="bg-background pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="cursor-pointer px-6 py-4 hover:text-foreground" onClick={() => toggleSort("name")}>
                    Etiqueta <SortIcon active={sortBy === "name"} direction={sortDir} />
                  </th>
                  <th className="cursor-pointer px-6 py-4 hover:text-foreground" onClick={() => toggleSort("productCount")}>
                    Qtd Produtos <SortIcon active={sortBy === "productCount"} direction={sortDir} />
                  </th>
                  <th className="cursor-pointer px-6 py-4 hover:text-foreground" onClick={() => toggleSort("createdAt")}>
                    Data Cadastro <SortIcon active={sortBy === "createdAt"} direction={sortDir} />
                  </th>
                  <th className="px-6 py-4">Exibir no site</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </td>
                  </tr>
                ) : tagsWithCount.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Nenhuma etiqueta encontrada.
                    </td>
                  </tr>
                ) : (
                  tagsWithCount.map((tag) => (
                    <tr key={tag.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                      <td className="px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: tag.color }} />
                          <span style={{ color: tag.color }} className="font-semibold">
                            {tag.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          Mockado
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(tag.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            tag.isPublic
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {tag.isPublic ? "Ligado" : "Desligado"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-border/50 hover-elevate"
                            onClick={() => {
                              setSelectedTagId(tag.id);
                              setReportModalOpen(true);
                            }}
                          >
                            <BarChart3 className="mr-2 h-4 w-4 text-primary" /> Relatório
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                            onClick={() => openModal(tag)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                            onClick={() => {
                              if (confirm("Remover esta etiqueta?")) {
                                void handleDelete(tag.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Itens por página:</span>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-20 bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-2">Total: {tagPage?.total || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                Anterior
              </Button>
              <span className="px-2 text-xs">
                {page} / {Math.max(1, Math.ceil((tagPage?.total || 0) / limit))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.max(1, Math.ceil((tagPage?.total || 0) / limit))}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">
              {editingId ? "Editar Etiqueta" : "Nova Etiqueta"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                required
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cor</label>
              <div className="flex items-center gap-4">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(event) => setFormData((current) => ({ ...current, color: event.target.value }))}
                  className="h-12 w-16 cursor-pointer bg-background p-1"
                />
                <span className="font-mono text-sm text-muted-foreground">{formData.color}</span>
                <Button type="button" variant="outline" onClick={randomizeColor} className="ml-auto">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Gerar aleatoria
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Exibir no site</label>
                  <p className="text-sm text-muted-foreground">
                    Use esta opcao para tornar a etiqueta publica no catalogo.
                  </p>
                </div>
                <Switch
                  checked={formData.isPublic}
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({ ...current, isPublic: checked }))
                  }
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="hover-elevate">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="border-border/50 bg-card sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display">
              <BarChart3 className="h-5 w-5 text-primary" />
              Relatório: <span style={{ color: selectedReport?.tag.color }}>{selectedReport?.tag.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {!selectedReport ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  Dados mockados: esta visualização é uma prévia até o endpoint de relatório ficar disponível.
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Faturamento Total", value: formatCurrency(selectedReport.totalRevenue), className: "text-primary" },
                    { label: "Vendas (Qtd)", value: selectedReport.totalSales, className: "" },
                    { label: "Estoque Total", value: selectedReport.totalStock, className: "" },
                  ].map((card) => (
                    <div key={card.label} className="rounded-xl border border-border/50 bg-background/50 p-4">
                      <p className="mb-1 text-xs text-muted-foreground">{card.label}</p>
                      <p className={`text-xl font-bold ${card.className}`}>{card.value}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-hidden rounded-xl border border-border/50">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Produto</th>
                        <th className="px-4 py-3">Estoque</th>
                        <th className="px-4 py-3">Vendas</th>
                        <th className="px-4 py-3 text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport.products.map((product) => (
                        <tr key={product.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-3 font-medium">{product.name}</td>
                          <td className="px-4 py-3">{product.stock}</td>
                          <td className="px-4 py-3">{product.totalSales}</td>
                          <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(product.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setReportModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
