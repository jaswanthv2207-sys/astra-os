import type { ComponentType, SVGProps } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  Box,
  Boxes,
  Check,
  Clock,
  Command,
  Copy,
  CornerDownLeft,
  Download,
  ExternalLink,
  Home,
  Layers,
  Loader2,
  Menu,
  Network,
  Orbit,
  Palette,
  Pause,
  Play,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { SiGithub } from "react-icons/si";

/**
 * Any icon component that renders a plain `<svg>` — lucide, react-icons or
 * a hand-drawn SVG component.
 */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Semantic icon registry — the single lookup table behind `<Icon name="…" />`.
 *
 * Why a registry instead of raw imports:
 * • one visual language — names are intent (`close`), not implementation
 *   (`X`), so components can't drift onto different icons for one meaning
 * • one swap point — replacing lucide (or re-theming stroke style) touches
 *   this file, not every call site
 * • data-friendly — dock items, search indexes and server payloads can ship
 *   a plain string instead of a component
 *
 * To add an icon: import it here, give it a kebab-case name, then render it
 * with `<Icon name="…" />`. Raw icon imports outside this file are a smell
 * (the exception: passing a component straight into a slot that sizes it,
 * e.g. `iconLeft` on Button).
 */
export const iconRegistry = {
  activity: Activity,
  "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  bell: Bell,
  box: Box,
  boxes: Boxes,
  check: Check,
  clock: Clock,
  command: Command,
  close: X,
  copy: Copy,
  download: Download,
  enter: CornerDownLeft,
  external: ExternalLink,
  orbit: Orbit,
  github: SiGithub,
  home: Home,
  layers: Layers,
  loader: Loader2,
  menu: Menu,
  network: Network,
  palette: Palette,
  pause: Pause,
  play: Play,
  plus: Plus,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  trash: Trash2,
  wand: Wand2,
  zap: Zap,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof iconRegistry;

/** Every registered name — handy for galleries and coverage tests. */
export const ICON_NAMES = Object.keys(iconRegistry) as IconName[];
