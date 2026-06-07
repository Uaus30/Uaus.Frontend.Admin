import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit2, Loader2, Phone, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/formatters";
import { getEnumOptions } from "@/services/core";
import { cleanPhone, formatPhone } from "@/lib/utils";
import {
  createSupplier,
  deleteSupplier,
  getSuppliersPage,
  updateSupplier,
} from "@/services/suppliers.service";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#3b82f6", "#0ea5e9", "#84cc16",
  "#d946ef", "#e11d48", "#059669", "#0284c7", "#7c3aed",
];

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function normalizeStatusName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function SupplierAvatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-9 w-9 text-sm" : size === "lg" ? "h-16 w-16 text-2xl" : "h-10 w-10 text-sm";

  return (
    <div
      className={`${sizeClass} flex flex-shrink-0 select-none items-center justify-center rounded-full font-bold`}
      style={{ backgroundColor: `${color}25`, color, border: `2px solid ${color}40` }}
    >
      {getInitials(name || "?")}
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

type SupplierForm = {
  name: string;
  corporateName: string;
  document: string;
  salesRepresentative: string;
  phone: string;
  email: string;
  minimumPurchaseValue: string;
  status: string;
  city: string;
  state: string;
  avatarColor: string;
  description: string;
};

export default function Suppliers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchVal, setSearchVal] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchVal]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<SupplierForm>({
    name: "",
    corporateName: "",
    document: "",
    salesRepresentative: "",
    phone: "",
    email: "",
    minimumPurchaseValue: "",
    status: "",
    city: "",
    state: "PR",
    avatarColor: randomColor(),
    description: "",
  });

  const { data: statusOptions = [] } = useQuery({
    queryKey: ["supplier-status-options"],
    queryFn: () => getEnumOptions("/Suppliers/enums/supplier-status"),
  });

  const statusLabelById = useMemo(
    () => Object.fromEntries(statusOptions.map((item) => [item.id, item.name])),
    [statusOptions],
  );
  const selectableSupplierStatusOptions = useMemo(
    () =>
      statusOptions.filter(
        (item) =>
          item.allowSelect &&
          ["ativo", "inativo"].includes(normalizeStatusName(item.name)),
      ),
    [statusOptions],
  );
  const activeStatusValue =
    selectableSupplierStatusOptions.find((item) => normalizeStatusName(item.name) === "ativo")?.id.toString() ?? "";

  useEffect(() => {
    if (!modalOpen || !activeStatusValue || selectableSupplierStatusOptions.length === 0) return;

    setForm((current) => {
      const statusIsAllowed = selectableSupplierStatusOptions.some((item) => String(item.id) === current.status);
      if (statusIsAllowed) return current;
      return { ...current, status: activeStatusValue };
    });
  }, [activeStatusValue, modalOpen, selectableSupplierStatusOptions]);

  const { data: suppliersPage, isLoading, isError, error } = useQuery({
    queryKey: ["suppliers-page", { search, page, limit }],
    queryFn: () => getSuppliersPage({ search, page, limit }),
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

  const suppliers = useMemo(() => {
    if (statusFilter === "all") return suppliersPage?.data ?? [];
    return (suppliersPage?.data ?? []).filter((item) => String(item.status) === statusFilter);
  }, [statusFilter, suppliersPage?.data]);

  function whatsappUrl(phone: string) {
    const digits = phone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${number}`;
  }

  function openModal(supplier?: any) {
    if (supplier) {
      setEditingId(supplier.id);
      const supplierStatus = supplier.status == null ? "" : String(supplier.status);
      const statusIsAllowed = selectableSupplierStatusOptions.some((item) => String(item.id) === supplierStatus);

      setForm({
        name: supplier.name || "",
        corporateName: supplier.corporateName || "",
        document: supplier.document || "",
        salesRepresentative: supplier.salesRepresentative || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        minimumPurchaseValue: String(supplier.minimumPurchaseValue ?? ""),
        status: statusIsAllowed ? supplierStatus : activeStatusValue,
        city: supplier.city || "",
        state: supplier.state || "",
        avatarColor: supplier.avatarColor || randomColor(),
        description: supplier.description || "",
      });
    } else {
      setEditingId(null);
      setForm({
        name: "",
        corporateName: "",
        document: "",
        salesRepresentative: "",
        phone: "",
        email: "",
        minimumPurchaseValue: "",
        status: activeStatusValue,
        city: "",
        state: "PR",
        avatarColor: randomColor(),
        description: "",
      });
    }

    setModalOpen(true);
  }

  async function handleSubmit(formData: SupplierForm) {
    const minimumPurchaseValue = Number(formData.minimumPurchaseValue);
    if (!formData.name.trim() || formData.minimumPurchaseValue === "" || Number.isNaN(minimumPurchaseValue) || minimumPurchaseValue < 0) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Informe o nome do fornecedor e o valor mínimo de compra.",
        variant: "destructive",
      });
      return;
    }

    const statusValue = formData.status || activeStatusValue;
    if (!statusValue) {
      toast({
        title: "Status indisponível",
        description: "Aguarde as opções de status carregarem para salvar.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        corporateName: formData.corporateName.trim() || null,
        document: formData.document.trim() || null,
        salesRepresentative: formData.salesRepresentative.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        minimumPurchaseValue,
        status: Number(statusValue),
        city: formData.city.trim(),
        state: formData.state,
        avatarColor: formData.avatarColor,
        description: formData.description.trim() || null,
      };

      if (editingId) {
        await updateSupplier({
          id: editingId,
          ...payload,
        });
        toast({ title: "Fornecedor atualizado." });
      } else {
        await createSupplier(payload);
        toast({ title: "Fornecedor cadastrado." });
      }

      queryClient.invalidateQueries({ queryKey: ["suppliers-page"] });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar fornecedor",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSupplier(id);
      queryClient.invalidateQueries({ queryKey: ["suppliers-page"] });
      toast({ title: "Fornecedor removido." });
    } catch (error) {
      toast({
        title: "Erro ao remover fornecedor",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil((suppliersPage?.total || 0) / limit));

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Fornecedores</h1>
            <p className="mt-1 text-muted-foreground">Gerencie seus fornecedores e contatos comerciais.</p>
          </div>
          <Button onClick={() => openModal()} className="bg-primary text-primary-foreground hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
          <div className="flex flex-col gap-3 border-b border-border/50 p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchVal}
                onChange={(event) => {
                  setSearchVal(event.target.value);
                }}
                className="bg-background pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions
                  .filter((item) => item.allowSelect)
                  .map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Fornecedor</th>
                  <th className="px-6 py-4">Vendedor</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Localização</th>
                  <th className="px-6 py-4">Mín. Compra</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading || (isError && (error as any)?.status >= 500) ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <Spinner />
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      Nenhum fornecedor encontrado.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <SupplierAvatar name={supplier.name} color={supplier.avatarColor} size="sm" />
                          <div>
                            <p className="leading-tight font-medium text-foreground">{supplier.name}</p>
                            {supplier.corporateName && <p className="mt-0.5 text-xs text-muted-foreground">{supplier.corporateName}</p>}
                            {supplier.document && <p className="mt-0.5 font-mono text-xs text-muted-foreground/70">{supplier.document}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{supplier.salesRepresentative || "Não informado"}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {supplier.phone ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{formatPhone(supplier.phone)}</span>
                              <a
                                href={whatsappUrl(supplier.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#25d366] transition-colors hover:text-[#128c7e]"
                                title="Abrir conversa no WhatsApp"
                              >
                                <WhatsAppIcon className="h-4 w-4" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Não informado</span>
                          )}
                          {supplier.email && <span className="max-w-[180px] truncate text-xs text-muted-foreground">{supplier.email}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{supplier.city || supplier.state ? [supplier.city, supplier.state].filter(Boolean).join("/") : "Não informado"}</td>
                      <td className="px-6 py-4 font-medium text-primary">{formatCurrency(supplier.minimumPurchaseValue)}</td>
                      <td className="px-6 py-4">
                        <Badge className="border-0 bg-emerald-500/20 text-emerald-400">
                          {statusLabelById[supplier.status] ?? (supplier.status ? supplier.status : "Sem status")}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-[200px]" title={supplier.description || ""}>
                        <div className="line-clamp-2 leading-tight break-words">
                          {supplier.description || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                            onClick={() => openModal(supplier)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                            onClick={() => {
                              if (confirm(`Remover o fornecedor "${supplier.name}"?`)) {
                                void handleDelete(supplier.id);
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
              <span className="ml-2">Total: {suppliersPage?.total || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                Anterior
              </Button>
              <span className="px-2 text-xs">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SupplierFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingId={editingId}
        initialForm={form}
        saving={saving}
        selectableSupplierStatusOptions={selectableSupplierStatusOptions}
        activeStatusValue={activeStatusValue}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}

function SupplierFormDialog({
  open,
  onOpenChange,
  editingId,
  initialForm,
  saving,
  selectableSupplierStatusOptions,
  activeStatusValue,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: number | null;
  initialForm: SupplierForm;
  saving: boolean;
  selectableSupplierStatusOptions: any[];
  activeStatusValue: string;
  onSubmit: (form: SupplierForm) => Promise<void>;
}) {
  const [name, setName] = useState(initialForm.name);
  const [status, setStatus] = useState(initialForm.status || "");
  const [state, setState] = useState(initialForm.state || "");
  const [avatarColor, setAvatarColor] = useState(initialForm.avatarColor || "");

  useEffect(() => {
    if (open) {
      setName(initialForm.name);
      setStatus(initialForm.status || "");
      setState(initialForm.state || "");
      setAvatarColor(initialForm.avatarColor || "");
    }
  }, [open, initialForm]);

  const corporateNameRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const salesRepresentativeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const minimumPurchaseValueRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void onSubmit({
      name,
      corporateName: corporateNameRef.current?.value || "",
      document: documentRef.current?.value || "",
      salesRepresentative: salesRepresentativeRef.current?.value || "",
      phone: phoneRef.current?.value || "",
      email: emailRef.current?.value || "",
      minimumPurchaseValue: minimumPurchaseValueRef.current?.value || "",
      status,
      city: cityRef.current?.value || "",
      state,
      avatarColor,
      description: descriptionRef.current?.value || "",
    });
  };

  const handlePhoneBlur = () => {
    if (phoneRef.current) {
      phoneRef.current.value = formatPhone(cleanPhone(phoneRef.current.value));
    }
  };

  const statusSelect = useMemo(() => (
    <Select
      value={status}
      onValueChange={setStatus}
      disabled={selectableSupplierStatusOptions.length === 0}
    >
      <SelectTrigger className="bg-background">
        <SelectValue placeholder="Selecione..." />
      </SelectTrigger>
      <SelectContent>
        {selectableSupplierStatusOptions.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ), [status, selectableSupplierStatusOptions]);

  const ufSelect = useMemo(() => (
    <Select
      value={state || "__none"}
      onValueChange={(value) => setState(value === "__none" ? "" : value)}
    >
      <SelectTrigger className="bg-background">
        <SelectValue placeholder="Selecione..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Não informar</SelectItem>
        {UF_LIST.map((uf) => (
          <SelectItem key={uf} value={uf}>
            {uf}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ), [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <form key={open ? (editingId ?? "new") : "closed"} onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,220px)] sm:items-end">
              <div className="relative h-16 w-16 flex-shrink-0 sm:self-center">
                <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }}>
                  <defs>
                    <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff3b30" />
                      <stop offset="20%" stopColor="#ff9500" />
                      <stop offset="40%" stopColor="#ffcc00" />
                      <stop offset="60%" stopColor="#4cd964" />
                      <stop offset="80%" stopColor="#5ac8fa" />
                      <stop offset="100%" stopColor="#5856d6" />
                    </linearGradient>
                  </defs>
                </svg>
                <SupplierAvatar name={name || "?"} color={avatarColor} size="lg" />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-6 w-6 rounded-full border border-border bg-background shadow-md hover:bg-muted hover-elevate"
                  style={{ position: "absolute", bottom: "-4px", right: "-4px", zIndex: 10 }}
                  title="Gerar nova cor"
                  aria-label="Gerar nova cor"
                  onClick={() => setAvatarColor(randomColor())}
                >
                  <RefreshCw className="h-3.5 w-3.5" stroke="url(#rainbow-gradient)" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-name">Nome do fornecedor</Label>
                <Input
                  id="supplier-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="bg-background"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-minimum-purchase">Valor mínimo de compra (R$)</Label>
                <Input
                  id="supplier-minimum-purchase"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  ref={minimumPurchaseValueRef}
                  defaultValue={initialForm.minimumPurchaseValue}
                  className="bg-background"
                  required
                />
              </div>
            </div>
          </div>

          <fieldset className="space-y-4 rounded-xl border border-border/40 p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">Informações opcionais:</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Razão Social</Label>
                <Input
                  ref={corporateNameRef}
                  defaultValue={initialForm.corporateName || ""}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input
                  ref={documentRef}
                  defaultValue={initialForm.document || ""}
                  className="bg-background font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vendedor</Label>
                <Input
                  ref={salesRepresentativeRef}
                  defaultValue={initialForm.salesRepresentative || ""}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telefone
                </Label>
                <Input
                  ref={phoneRef}
                  defaultValue={formatPhone(initialForm.phone || "")}
                  onBlur={handlePhoneBlur}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  ref={emailRef}
                  defaultValue={initialForm.email || ""}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                {statusSelect}
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input
                  ref={cityRef}
                  defaultValue={initialForm.city || ""}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                {ufSelect}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição</Label>
                <textarea
                  ref={descriptionRef}
                  defaultValue={initialForm.description || ""}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Descrição do fornecedor (limite de 200 caracteres)..."
                  maxLength={200}
                />
              </div>
            </div>
          </fieldset>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover-elevate">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
