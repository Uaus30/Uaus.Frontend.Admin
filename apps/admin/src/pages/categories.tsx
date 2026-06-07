import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Edit2, Folder, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/formatters";
import { createCategory, deleteCategory, getAllDepartments, getCategoriesPage, updateCategory } from "@/services/categories.service";
import { buildMockCategoryReport } from "@/lib/mock-data";
import { getGetCategoriesQueryKey } from "@workspace/api-client-react";

export default function Categories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    departmentId: "",
    name: "",
    description: "",
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-all-for-categories"],
    queryFn: () => getAllDepartments(),
  });

  const { data: categoriesPage, isLoading, isError, error } = useQuery({
    queryKey: [...getGetCategoriesQueryKey(), { search, departmentFilter, page }],
    queryFn: () =>
      getCategoriesPage({
        search,
        departmentId: departmentFilter === "all" ? undefined : Number(departmentFilter),
        page,
        limit: 20,
      }),
  });

  useEffect(() => {
    if (isError && error) {
      const apiError = error as any;
      if (apiError.status >= 500) {
        toast({
          title: "Servidor indisponível",
          description: "O servidor está indisponível no momento. Por favor, tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    }
  }, [isError, error, toast]);

  const categoriesWithDepartment = useMemo(() => {
    const departmentsById = new Map(departments.map((department) => [department.id, department]));

    return (categoriesPage?.data ?? []).map((category) => ({
      ...category,
      department: departmentsById.get(category.departmentId) ?? null,
      productCountLabel: "Mockado",
    }));
  }, [categoriesPage?.data, departments]);

  const selectedReport = useMemo(() => {
    if (!selectedCatId) return null;
    const category = categoriesWithDepartment.find((item) => item.id === selectedCatId);
    if (!category) return null;
    return buildMockCategoryReport(category.name);
  }, [categoriesWithDepartment, selectedCatId]);

  function openModal(category?: any) {
    if (category) {
      setEditingId(category.id);
      setFormData({
        departmentId: String(category.departmentId),
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        departmentId: departmentFilter !== "all" ? departmentFilter : (departments[0]?.id.toString() ?? ""),
        name: "",
        description: "",
      });
    }
    setModalOpen(true);
  }

  function openReport(categoryId: number) {
    setSelectedCatId(categoryId);
    setReportOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.departmentId || !formData.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        departmentId: Number(formData.departmentId),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      };

      if (editingId) {
        await updateCategory({ id: editingId, ...payload });
        toast({ title: "Categoria atualizada." });
      } else {
        await createCategory(payload);
        toast({ title: "Categoria criada." });
      }

      queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar categoria",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId: number) {
    try {
      await deleteCategory(categoryId);
      queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      toast({ title: "Categoria removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover categoria",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Categorias</h1>
            <p className="mt-1 text-muted-foreground">Organize seus produtos por departamento e categoria.</p>
          </div>
          <Button onClick={() => openModal()} className="hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Nova Categoria
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
          <div className="flex flex-col gap-3 border-b border-border/50 p-4 sm:flex-row">
            <Input
              placeholder="Buscar categoria..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="bg-background sm:max-w-sm"
            />
            <Select
              value={departmentFilter}
              onValueChange={(value) => {
                setDepartmentFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full bg-background sm:w-64">
                <SelectValue placeholder="Todos os departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id.toString()}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Departamento</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Qtd Produtos</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading || (isError && (error as any)?.status >= 500) ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Spinner />
                    </td>
                  </tr>
                ) : categoriesWithDepartment.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                ) : (
                  categoriesWithDepartment.map((category) => (
                    <tr key={category.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                      <td className="px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Folder className="h-4 w-4" />
                          </div>
                          {category.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{category.department?.name || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{category.description || "-"}</td>
                      <td className="px-6 py-4 font-medium">
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {category.productCountLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-border/50 hover-elevate"
                            onClick={() => openReport(category.id)}
                          >
                            <BarChart3 className="mr-2 h-4 w-4 text-primary" /> Relatório
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                            onClick={() => openModal(category)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                            onClick={() => {
                              if (confirm("Remover esta categoria?")) {
                                void handleDelete(category.id);
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
            <span>
              Mostrando página {categoriesPage?.page || 1} de{" "}
              {Math.ceil((categoriesPage?.total || 0) / (categoriesPage?.limit || 20)) || 1}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={categoriesPage ? categoriesPage.data.length < categoriesPage.limit : true}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">
              {editingId ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Departamento</label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData((current) => ({ ...current, departmentId: value }))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id.toString()}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Input
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                className="bg-background"
              />
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

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="border-border/50 bg-card sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display">
              <BarChart3 className="h-5 w-5 text-primary" />
              Relatório: {selectedReport?.category.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {!selectedReport ? (
              <div className="flex justify-center py-12">
                <Spinner />
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
                    { label: "Estoque Total", value: `${selectedReport.totalStock} un`, className: "" },
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
                        <th className="px-4 py-3">Preço</th>
                        <th className="px-4 py-3">Estoque</th>
                        <th className="px-4 py-3">Vendas</th>
                        <th className="px-4 py-3 text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport.products.map((product) => (
                        <tr key={product.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-3 font-medium">{product.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatCurrency(product.price)}</td>
                          <td className="px-4 py-3">{product.stock} un</td>
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
            <Button onClick={() => setReportOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
