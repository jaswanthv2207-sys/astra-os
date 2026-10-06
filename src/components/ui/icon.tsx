import * as React from "react";

import { cn } from "@/lib/utils";
import { iconRegistry, type IconComponent, type IconName } from "@/lib/icons";

/** Steps of the icon ramp (`--icon-xs` … `--icon-2xl` tokens). */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Literal class map — also the Tailwind scan target. (Building these with
 * `icon-${size}` would hide them from the JIT, because utilities constructed
 * at runtime are never seen in source.)
 */
const sizeClasses: Record<IconSize, string> = {
  xs: "icon-xs",
  sm: "icon-sm",
  md: "icon-md",
  lg: "icon-lg",
  xl: "icon-xl",
  "2xl": "icon-2xl",
};

type IconPropsBase = Omit<React.SVGProps<SVGSVGElement>, "children"> & {
  /** Size step from the icon ramp. Default `sm` (16px). */
  size?: IconSize;
  /**
   * Accessible name. Omit it for decorative icons — they are then
   * `aria-hidden`, because the surrounding control already carries the name.
   */
  label?: string;
};

export type IconProps = IconPropsBase &
  ({ name: IconName; as?: never } | { as: IconComponent; name?: never });

/**
 * Icon — the only way icons enter the UI.
 *
 * Renders a registry icon (`name`) or an explicit component (`as`), normalised
 * by the token layer:
 * • size comes from the `--icon-*` ramp via the `icon-*` utilities
 * • stroke weight is forced to `--icon-stroke` (CSS beats lucide's
 *   `stroke-width` attribute, so every icon shares one line weight)
 * • decorative by default (`aria-hidden`), or a `role="img"` landmark with
 *   `label` — never both, never neither
 *
 * Note: Button and other containers size the icons inside them with
 * `[&_svg]:icon-*`, which wins the cascade — pick the size on the *control*
 * there, not on the icon.
 *
 * @example
 * <Icon name="rocket" size="lg" />            // decorative (aria-hidden)
 * <Icon name="search" label="Search" />       // meaningful (role="img")
 * <Icon as={CustomGlyph} size="xl" />         // outside the registry
 */
export function Icon({
  size = "sm",
  label,
  className,
  name,
  as,
  ...props
}: IconProps) {
  const Comp: IconComponent = name ? iconRegistry[name] : (as as IconComponent);

  return (
    <Comp
      {...props}
      className={cn("icon", sizeClasses[size], className)}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    />
  );
}

Icon.displayName = "Icon";
