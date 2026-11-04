import type { ComponentType } from "react";
import { BadgePercent, PackageCheck, Sparkles, type LucideIcon } from "lucide-react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui";
import { spotlightBannerOptions } from "../lib/spotlightBannerOptions";
import type { ProductTableRow, SpotlightBannerKind } from "../types";

const ICON: Record<SpotlightBannerKind, LucideIcon> = {
  new: Sparkles,
  offer: BadgePercent,
  restock: PackageCheck,
};

interface SpotlightMenuItemsProps {
  product: ProductTableRow;
  onSpotlight: (product: ProductTableRow, kind: SpotlightBannerKind) => void;
}

interface MenuParts {
  Item: ComponentType<{ onClick: () => void; className: string; children: React.ReactNode }>;
  Separator: ComponentType;
}

/**
 * Os mesmos itens nos dois menus da linha — o dos três pontos e o do botão
 * direito —, num bloco separado por linhas: o "Excluir" logo abaixo de um
 * banner seria um toque errado caro.
 */
function SpotlightItems({ product, onSpotlight, Item, Separator }: SpotlightMenuItemsProps & MenuParts) {
  return (
    <>
      <Separator />
      {spotlightBannerOptions(product).map((option) => {
        const Icon = ICON[option.kind];
        return (
          <Item
            key={option.kind}
            onClick={() => onSpotlight(product, option.kind)}
            className="cursor-pointer gap-2"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            {option.label}
          </Item>
        );
      })}
      <Separator />
    </>
  );
}

/** Os banners de destaque no menu dos três pontos da linha (04/11/2026). */
export function SpotlightDropdownItems(props: SpotlightMenuItemsProps) {
  return <SpotlightItems {...props} Item={DropdownMenuItem} Separator={DropdownMenuSeparator} />;
}

/** Os banners de destaque no menu do botão direito da linha (04/11/2026). */
export function SpotlightContextItems(props: SpotlightMenuItemsProps) {
  return <SpotlightItems {...props} Item={ContextMenuItem} Separator={ContextMenuSeparator} />;
}
