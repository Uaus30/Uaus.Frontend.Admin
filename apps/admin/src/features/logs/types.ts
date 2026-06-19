import type { DateRange } from "@/components/ui/date-range-picker";
import type { SystemLogDto } from "@workspace/api-client-react";

export type { DateRange, SystemLogDto };

/**
 * Interface para opções de tipo de Log.
 */
export interface LogTypeOption {
  id: number;
  name: string;
  value: string;
  allowSelect: boolean;
}
