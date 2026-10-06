/**
 * Design-system primitives (the "shadcn/ui slot" of Astra OS).
 *
 * Built on the same conventions as shadcn/ui — `cn()` + CVA variants + Radix
 * primitives for behaviour — but styled entirely from our token layer so they
 * inherit any re-theme.
 *
 *   import { Button, GlassCard } from "@/components/ui";
 *
 * Keep these presentational: styling + a11y only, no data fetching.
 */
export { Button, buttonVariants, type ButtonProps } from "./button";
export { Badge, badgeVariants, type BadgeProps } from "./badge";
export { Icon, type IconProps, type IconSize } from "./icon";
export { GlassCard, type GlassCardProps } from "./glass-card";
export { Input, type InputProps } from "./input";
export { SearchBar, type SearchBarProps } from "./search-bar";
export {
  FloatingDock,
  type DockItem,
  type FloatingDockProps,
} from "./floating-dock";
export {
  Modal,
  ModalRoot,
  ModalTrigger,
  ModalClose,
  ModalTitle,
  ModalDescription,
  ModalSrDescription,
  type ModalProps,
} from "./modal";
export {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  type TooltipProps,
} from "./tooltip";
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  type SkeletonProps,
} from "./skeleton";
export {
  SectionContainer,
  Section,
  type SectionContainerProps,
} from "./section";
