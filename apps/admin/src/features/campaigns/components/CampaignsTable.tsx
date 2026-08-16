import { useLocation } from "wouter";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { BarChart3, Edit2, Megaphone, Trash2 } from "lucide-react";
import { formatDate } from "@workspace/core";
import type { CampaignDto } from "../types";
import { nowInstant } from "../hooks/campaignRules";

interface CampaignsTableProps {
  items: CampaignDto[];
  isLoading: boolean;
  /** True enquanto uma exclusão está em andamento — bloqueia o segundo clique. */
  isDeleting: boolean;
  onEdit: (item: CampaignDto) => void;
  onDelete: (item: CampaignDto) => void;
}

type StatusKey = "no-ar" | "programada" | "encerrada" | "inativa";

/**
 * Situação da campanha AGORA — e só sobre o questionário.
 *
 * "Encerrada" aqui nunca quer dizer que o cupom parou de valer: a vigência do
 * cupom é outra coluna, em outra tela, e é ela que decide dinheiro. A separação
 * dos quatro estados existe porque "programada" e "encerrada" pedem ações
 * opostas do administrador, e um único badge "inativa" esconderia isso.
 */
function describeStatus(campaign: CampaignDto): { key: StatusKey; label: string } {
  if (!campaign.isActive) return { key: "inativa", label: "Inativa" };

  const now = nowInstant();
  if (now < campaign.startsAt) return { key: "programada", label: "Programada" };
  if (campaign.endsAt != null && now > campaign.endsAt) return { key: "encerrada", label: "Encerrada" };

  return { key: "no-ar", label: "No ar" };
}

/** Período completo com hora: "15/08/2026 00:00 — 30/09/2026 23:59". */
function formatPeriod(campaign: CampaignDto): string {
  const start = formatDate(campaign.startsAt);
  return campaign.endsAt == null ? `${start} — em aberto` : `${start} — ${formatDate(campaign.endsAt)}`;
}

/**
 * CampaignsTable
 *
 * Listagem das campanhas com o período em data **e hora** — truncar no dia
 * apagaria a diferença entre uma campanha de uma tarde e uma que durou o dia
 * inteiro, que é justamente o intervalo com que o relatório compara o
 * faturamento da loja.
 */
export function CampaignsTable({ items, isLoading, isDeleting, onEdit, onDelete }: CampaignsTableProps) {
  // Navegação por `setLocation`, e não por `<Link>` envolvendo o botão: âncora
  // com botão dentro é marcação inválida, e é assim que a tabela de produtos e
  // a de logs já navegam.
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando campanhas...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
        <Megaphone className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
        <p className="text-base font-medium">Nenhuma campanha encontrada</p>
        <p className="text-sm">
          Crie uma campanha para reunir cupons e perguntar no caixa como o cliente chegou até a loja.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Campanha</TableHead>
            <TableHead>Período (data e hora)</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const status = describeStatus(item);

            return (
              <TableRow key={item.id} className="transition-colors hover:bg-muted/30">
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <span>{item.name}</span>
                      {item.description && (
                        <p className="truncate text-xs font-normal text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatPeriod(item)}
                </TableCell>

                <TableCell>
                  {status.key === "no-ar" ? (
                    <Badge className="bg-emerald-600 font-medium text-white hover:bg-emerald-700">
                      {status.label}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-medium">
                      {status.label}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLocation(`/marketing/campanhas/${item.id}/relatorio`)}
                      title="Relatório da campanha"
                      className="h-8 w-8"
                    >
                      <BarChart3 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(item)}
                      title="Editar campanha e questionário"
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(item)}
                      disabled={isDeleting}
                      title="Excluir campanha"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
