import { RESOURCE_KEYS } from "@/hooks/use-catalog";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TagDto } from "@workspace/api-client-react";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui";
import { useToast } from "@workspace/ui";
import { generateRandomTagColor } from "@/lib/tag-colors";
import { createTag, searchTags } from "@/services/tags.service";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

type TagMultiSelectProps = {
  allTags: TagDto[];
  selectedIds: number[];
  onChange: (tagIds: number[]) => void;
  onTagCreated?: (tag: TagDto) => void;
  placeholder?: string;
};

function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function TagMultiSelect({
  allTags,
  selectedIds,
  onChange,
  onTagCreated,
  placeholder = "Buscar etiquetas...",
}: TagMultiSelectProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: searchPage, isFetching } = useQuery({
    queryKey: [...RESOURCE_KEYS.tags, "search", search],
    enabled: open,
    queryFn: () => searchTags({ search, limit: 20 }),
  });

  const selectedTags = useMemo(
    () => allTags.filter((tag) => selectedIds.includes(tag.id)),
    [allTags, selectedIds],
  );

  const selectedPublicTagId = selectedTags.find((tag) => tag.isPublic)?.id ?? null;
  const normalizedSearch = normalizeTagName(search);

  const options = useMemo(() => {
    const base = search.trim()
      ? searchPage?.data ?? []
      : [...allTags]
          .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
          .slice(0, 20);

    const merged = new Map<number, TagDto>();
    [...selectedTags, ...base].forEach((tag) => {
      merged.set(tag.id, tag);
    });

    return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }, [allTags, search, searchPage?.data, selectedTags]);

  const canCreate = normalizedSearch.length > 0
    && !options.some((tag) => normalizeTagName(tag.name) === normalizedSearch);

  function toggleTag(tag: TagDto) {
    const selected = selectedIds.includes(tag.id);

    if (!selected && tag.isPublic && selectedPublicTagId && selectedPublicTagId !== tag.id) {
      toast({
        title: "Somente uma etiqueta publica por produto.",
        description: "Remova a etiqueta publica atual antes de selecionar outra.",
        variant: "destructive",
      });
      return;
    }

    onChange(
      selected
        ? selectedIds.filter((id) => id !== tag.id)
        : [...selectedIds, tag.id],
    );
  }

  async function handleCreateTag() {
    const trimmed = search.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    setCreating(true);
    try {
      const created = await createTag({
        name: trimmed,
        color: generateRandomTagColor(),
        isPublic: false,
      });

      onTagCreated?.(created);
      onChange([...selectedIds, created.id]);
      setSearch("");
      setOpen(false);
      toast({ title: `Etiqueta "${created.name}" criada e vinculada.` });
    } catch (error) {
      toast({
        title: "Erro ao criar etiqueta",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start bg-background min-h-[40px] h-auto p-2"
          >
            <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-6">
              {selectedTags.length > 0 ? (
                selectedTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="gap-1 rounded-sm px-1.5 py-0.5 text-xs font-normal border-transparent"
                    style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                  >
                    {tag.name}
                    <button
                      type="button"
                      className="inline-flex h-3 w-3 items-center justify-center rounded-full ml-1 hover:bg-black/10 dark:hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(selectedIds.filter((id) => id !== tag.id));
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground font-normal ml-1">{placeholder}</span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={placeholder}
            />
            <CommandList>
              <CommandEmpty>
                {isFetching ? "Buscando etiquetas..." : "Nenhuma etiqueta encontrada."}
              </CommandEmpty>
              <CommandGroup>
                {canCreate ? (
                  <CommandItem onSelect={() => void handleCreateTag()} disabled={creating}>
                    <Plus className="h-4 w-4 text-primary" />
                    <span>Criar "{search.trim()}"</span>
                  </CommandItem>
                ) : null}

                {options.map((tag) => {
                  const selected = selectedIds.includes(tag.id);
                  const publicTagBlocked = !selected && tag.isPublic && selectedPublicTagId && selectedPublicTagId !== tag.id;

                  return (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => toggleTag(tag)}
                      disabled={Boolean(publicTagBlocked)}
                    >
                      <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                      <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 truncate" style={{ color: tag.color }}>
                        {tag.name}
                      </span>
                      {tag.isPublic ? (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                          Site
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>


    </div>
  );
}


