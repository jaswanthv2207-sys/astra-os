import type { ComponentType, SVGProps } from "react";
import {
  Activity,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  Box,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Command,
  Copy,
  CornerDownLeft,
  Download,
  ExternalLink,
  Folder,
  Grid2x2,
  Home,
  Layers,
  Link2,
  Loader2,
  Menu,
  Network,
  Orbit,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
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
  archive: Archive,
  "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  bell: Bell,
  box: Box,
  boxes: Boxes,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  clock: Clock,
  command: Command,
  close: X,
  copy: Copy,
  download: Download,
  enter: CornerDownLeft,
  external: ExternalLink,
  folder: Folder,
  grid: Grid2x2,
  link: Link2,
  orbit: Orbit,
  github: SiGithub,
  home: Home,
  layers: Layers,
  loader: Loader2,
  menu: Menu,
  network: Network,
  palette: Palette,
  pause: Pause,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  share: Share2,
  shield: ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  trash: Trash2,
  upload: Upload,
  wand: Wand2,
  zap: Zap,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof iconRegistry;

/** Every registered name — handy for galleries and coverage tests. */
export const ICON_NAMES = Object.keys(iconRegistry) as IconName[];
