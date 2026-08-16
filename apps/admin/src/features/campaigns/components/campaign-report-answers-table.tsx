import { MessageSquareOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@workspace/ui";
import { formatCurrency, formatPercentage } from "@workspace/core";
import type { CampaignReportQuestionDto } from "@workspace/api-client-react";

type CampaignReportAnswersTableProps = {
  questions: CampaignReportQuestionDto[];
};

/**
 * CampaignReportAnswersTable
 *
 * Os números exatos por alternativa: contagem, participação, faturamento e
 * ticket médio.
 *
 * Existe ao lado do gráfico porque as duas leituras servem a perguntas
 * diferentes. O gráfico responde "qual alternativa domina" de relance; a tabela
 * responde "quanto exatamente", que é o número que vai para a reunião. Ler valor
 * exato de barra é adivinhação.
 *
 * O percentual é sobre quem respondeu AQUELA pergunta, não sobre o total de
 * resgates: pergunta opcional, ou que entrou no questionário na segunda semana,
 * teria a participação diluída contra um denominador que nunca lhe foi
 * apresentado.
 */
export function CampaignReportAnswersTable({ questions }: CampaignReportAnswersTableProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Respostas por alternativa</CardTitle>
        <CardDescription>
          Contagem, participação e ticket médio de cada alternativa escolhida no balcão. A
          participação é sobre quem respondeu aquela pergunta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {questions.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <MessageSquareOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">Nenhuma resposta registrada</p>
            <p className="text-sm">
              A campanha pode não ter questionário, ou os cupons dela ainda não foram usados.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Pergunta</TableHead>
                  <TableHead>Alternativa</TableHead>
                  <TableHead className="text-right">Respostas</TableHead>
                  <TableHead className="text-right">Participação</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.flatMap((question) =>
                  question.options.map((option, index) => (
                    <TableRow
                      key={`${question.questionId}-${option.optionId}`}
                      // A linha de topo de cada pergunta ganha um traço acima: a
                      // tabela é uma lista de grupos, e sem a marca as
                      // alternativas de duas perguntas viram uma lista só.
                      className={cn(
                        "transition-colors hover:bg-muted/30",
                        index === 0 && "border-t-2 border-t-border",
                      )}
                    >
                      <TableCell className="font-medium">
                        {/* O rótulo só aparece na primeira alternativa: repeti-lo
                            em cada linha faria a coluna competir com o dado. */}
                        {index === 0 ? (
                          <span>
                            {question.label}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {question.answered} resposta(s)
                            </span>
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{option.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{option.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPercentage(option.percentage)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(option.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(option.averageTicket)}
                      </TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
