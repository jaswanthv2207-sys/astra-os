"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  Download,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

import {
  AnimatedBackground,
  Badge,
  Button,
  FloatingDock,
  GlassCard,
  GridBackground,
  Icon,
  Input,
  Modal,
  Navbar,
  NoiseOverlay,
  SearchBar,
  SectionContainer,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  Tooltip,
} from "@/components";

/* ── local demo helpers ─────────────────────────────────────────────────── */

function Code({ children }: { children: string }) {
  return (
    <pre className="border-hairline text-ink-muted mt-6 overflow-x-auto rounded-lg border bg-black/40 px-4 py-3.5 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function IconChip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} side={side}>
      <button
        type="button"
        aria-label={label}
        className="border-line text-ink-muted duration-base ease-out-expo hover:border-aura-violet/50 hover:text-ink hover:shadow-glow-violet focus-visible:outline-aura-violet flex size-11 items-center justify-center rounded-full border bg-white/[0.04] transition-all outline-none hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95"
      >
        {children}
      </button>
    </Tooltip>
  );
}

const SEARCH_INDEX = [
  "Button",
  "Badge",
  "Glass card",
  "Navigation bar",
  "Search bar",
  "Floating dock",
  "Modal",
  "Input",
  "Tooltip",
  "Section container",
  "Loading skeleton",
  "Animated background",
];

/* ── page ───────────────────────────────────────────────────────────────── */

export function ComponentsShowcase() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const matches = SEARCH_INDEX.filter((entry) =>
    entry.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const dockItems = [
    {
      id: "home",
      label: "Home",
      icon: <Icon name="home" size="lg" />,
      href: "/",
    },
    {
      id: "system",
      label: "Design system",
      icon: <Icon name="palette" size="lg" />,
      href: "/design-system",
    },
    {
      id: "components",
      label: "Components",
      icon: <Icon name="layers" size="lg" />,
      href: "/components",
      active: true,
    },
    {
      id: "search",
      label: "Search  (⌘K)",
      icon: <Icon name="search" size="lg" />,
      onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    },
    {
      id: "github",
      label: "Source",
      icon: <Icon name="github" size="lg" />,
      href: "https://github.com",
      external: true,
    },
  ];

  return (
    <div className="relative min-h-dvh">
      <Navbar
        actions={
          <div className="w-60">
            <SearchBar
              size="sm"
              value={query}
              onValueChange={setQuery}
              srLabel="Search components"
              placeholder="Search components…"
            />
          </div>
        }
      />

      <main id="main" className="relative isolate overflow-hidden pt-16">
        <AnimatedBackground aurora="subtle" grid={{ size: 72 }} />
        <NoiseOverlay opacity={0.035} />

        <div className="flex flex-col gap-24 pt-16 pb-44">
          {/* ── intro ─────────────────────────────────────────────────── */}
          <SectionContainer
            headingLevel="h1"
            padded={false}
            width="wide"
            eyebrow="Component library"
            title="Premium primitives, zero compromise"
            description="Twelve production components built on Radix behaviour, Framer Motion micro-interactions and the Astra OS token layer — with focus states, keyboard support and reduced-motion handling baked in."
            actions={
              <>
                <Button variant="primary" iconRight={<ArrowRight />}>
                  Get started
                </Button>
                <Button variant="outline" iconLeft={<Download />}>
                  Install
                </Button>
              </>
            }
          />

          {/* ── buttons ───────────────────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="01 · Actions"
            title="Button"
            description="Six variants, six sizes, an optional sheen sweep, and a loading state that keeps layout stable."
          >
            <GlassCard padding="lg" spotlight>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="glass">Glass</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="link">Link</Button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button size="xs" iconLeft={<Plus />}>
                  Extra small
                </Button>
                <Button size="sm" iconLeft={<Plus />}>
                  Small
                </Button>
                <Button size="md" iconLeft={<Plus />}>
                  Medium
                </Button>
                <Button size="lg" iconLeft={<Sparkles />}>
                  Large
                </Button>
                <Button size="icon" aria-label="Add item" iconLeft={<Plus />} />
                <Button variant="outline" size="icon-sm" aria-label="Settings">
                  <Icon name="settings" />
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button loading>Loading</Button>
                <Button variant="glass" loading>
                  Saving…
                </Button>
                <Button variant="outline" disabled>
                  Disabled
                </Button>
                <Button variant="ghost" iconRight={<Zap />}>
                  With icon
                </Button>
                <Button asChild variant="glass">
                  <a href="#main">Renders an anchor</a>
                </Button>
              </div>

              <Code>{`<Button variant="primary" size="lg" iconRight={<ArrowRight />}>
  Launch workspace
</Button>`}</Code>
            </GlassCard>
          </SectionContainer>

          {/* ── badges ────────────────────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="02 · Status"
            title="Badge"
            description="Colour is never the only signal — every state ships with a label, and optional dots can pulse."
          >
            <GlassCard padding="lg" spotlight>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>Default</Badge>
                <Badge variant="aura">Aura</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="solid">Solid</Badge>
                <Badge variant="count">
                  12<span className="sr-only"> unread items</span>
                </Badge>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Badge variant="success" dot pulse>
                  Operational
                </Badge>
                <Badge variant="warning" dot>
                  Degraded
                </Badge>
                <Badge variant="danger" dot pulse>
                  Incident
                </Badge>
                <Badge variant="info" dot>
                  v2.0.0
                </Badge>
                <Badge size="sm">Small</Badge>
                <Badge size="lg" variant="aura" shape="rounded">
                  Rounded L
                </Badge>
              </div>

              <Code>{`<Badge variant="success" dot pulse>Operational</Badge>`}</Code>
            </GlassCard>
          </SectionContainer>

          {/* ── inputs + search ───────────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="03 · Forms"
            title="Input & Search bar"
            description="Labels, hints and errors are wired with aria-describedby / aria-invalid. Focus reacts on the wrapper so the glow surrounds the whole field."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <GlassCard padding="lg" spotlight>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    label="Work email"
                    type="email"
                    placeholder="you@astra.dev"
                    hint="We only use this for receipts."
                    icon={<Icon name="search" />}
                  />
                  <Input
                    label="Passphrase"
                    type="password"
                    defaultValue="short"
                    error="Too short — 12 characters minimum."
                    required
                  />
                  <Input
                    label="Workspace"
                    defaultValue="astra-os"
                    trailing={
                      <span className="border-line text-ink-faint text-micro rounded-md border bg-white/[0.05] px-1.5 py-0.5 font-mono">
                        .app
                      </span>
                    }
                  />
                  <Input label="Disabled" placeholder="Read only" disabled />
                </div>

                <Code>{`<Input label="Work email" type="email" hint="We only use this for receipts." />`}</Code>
              </GlassCard>

              <GlassCard padding="lg" spotlight>
                <SearchBar
                  value={query}
                  onValueChange={setQuery}
                  onSubmit={() => undefined}
                  placeholder="Filter the component list…"
                  srLabel="Filter components"
                  /* the navbar bar owns ⌘K — two bars would fight for it */
                  enableGlobalShortcut={false}
                  showShortcut={false}
                />

                <div className="mt-5 flex items-center justify-between">
                  <p role="status" className="text-ink-muted text-sm">
                    {matches.length} of {SEARCH_INDEX.length} components match
                  </p>
                  <Badge variant={matches.length ? "success" : "danger"} dot>
                    {matches.length ? "Results" : "No match"}
                  </Badge>
                </div>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {matches.map((entry) => (
                    <li key={entry}>
                      <Badge variant="outline" size="sm">
                        {entry}
                      </Badge>
                    </li>
                  ))}
                </ul>

                <Code>{`<SearchBar value={q} onValueChange={setQ} onSubmit={run} />`}</Code>
              </GlassCard>
            </div>
          </SectionContainer>

          {/* ── glass card ────────────────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="04 · Surfaces"
            title="Glass card"
            description="Four materials, cursor-tracked spotlight, and a lift + aura bloom on hover and focus-within."
          >
            <div className="grid gap-6 md:grid-cols-3">
              <GlassCard padding="lg" tone="subtle">
                <span className="eyebrow">Subtle</span>
                <h3 className="text-ink mt-3 text-lg font-semibold">
                  Dense layouts
                </h3>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  A nearly invisible material for tables and sidebars where
                  contrast must stay low.
                </p>
              </GlassCard>

              <GlassCard
                padding="lg"
                interactive
                spotlight
                className="min-h-full"
              >
                <span className="eyebrow">Interactive</span>
                <h3 className="text-ink mt-3 text-lg font-semibold">
                  Hover me — spotlight follows the cursor
                </h3>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  Pointer position is written straight to a ref, so nothing
                  re-renders while you move.
                </p>
              </GlassCard>

              <GlassCard asChild tone="glass" padding="lg" interactive>
                <a href="/design-system">
                  <span className="eyebrow">As child</span>
                  <h3 className="text-ink mt-3 text-lg font-semibold">
                    Whole card is a link
                    <ArrowRight
                      aria-hidden="true"
                      className="duration-base ml-1.5 inline size-4 transition-transform group-hover:translate-x-1"
                    />
                  </h3>
                  <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                    Slot semantics keep a single focusable element — no nested
                    interactive traps.
                  </p>
                </a>
              </GlassCard>
            </div>
          </SectionContainer>

          {/* ── modal ─────────────────────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="05 · Overlays"
            title="Modal"
            description="Radix Dialog: focus trap, Esc, scroll lock, focus restore. Try the keyboard — Tab never escapes the panel."
          >
            <GlassCard padding="lg">
              <div className="flex flex-wrap items-center gap-3">
                <Modal
                  title="Delete workspace"
                  description="This permanently removes astra-os and all of its deployments."
                  size="md"
                  trigger={
                    <Button variant="danger" iconLeft={<Trash2 />}>
                      Delete workspace
                    </Button>
                  }
                  footer={
                    <>
                      <Button variant="ghost">Learn more</Button>
                      <Button variant="danger">Delete permanently</Button>
                    </>
                  }
                >
                  <ul className="space-y-3">
                    {[
                      ["Environments", "3 production, 1 preview"],
                      ["Deployments", "128 total · 12 this week"],
                      ["Members", "7 with active sessions"],
                    ].map(([label, value]) => (
                      <li
                        key={label}
                        className="border-hairline flex items-center justify-between rounded-lg border bg-white/[0.03] px-4 py-3"
                      >
                        <span className="text-ink">{label}</span>
                        <span className="text-ink-faint">{value}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-ink-faint mt-4 text-xs">
                    Type the workspace name to confirm — nothing is deleted
                    until you do.
                  </p>
                </Modal>

                <Modal
                  size="sm"
                  title="Invite teammate"
                  description="Share a magic link — no password needed."
                  trigger={
                    <Button variant="glass" iconLeft={<Plus />}>
                      Invite
                    </Button>
                  }
                  footer={
                    <>
                      <Button variant="ghost">Cancel</Button>
                      <Button variant="primary">Send invite</Button>
                    </>
                  }
                >
                  <Input
                    label="Email address"
                    placeholder="teammate@astra.dev"
                  />
                </Modal>
              </div>

              <Code>{`<Modal
  title="Delete workspace"
  description="This cannot be undone."
  trigger={<Button variant="danger">Delete</Button>}
  footer={<Button variant="danger">Confirm</Button>}
>
  …body…
</Modal>`}</Code>
            </GlassCard>
          </SectionContainer>

          {/* ── tooltips ──────────────────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="06 · Hints"
            title="Tooltip"
            description="Opens on hover and on keyboard focus, flips when it would clip, and never carries information the trigger doesn't already expose."
          >
            <GlassCard padding="lg">
              <div className="flex flex-wrap items-center gap-4">
                <IconChip label="Notifications" side="bottom">
                  <Icon name="bell" size="md" />
                </IconChip>
                <IconChip label="Command palette — ⌘K" side="bottom">
                  <Icon name="command" size="md" />
                </IconChip>
                <IconChip label="Favourite this project" side="top">
                  <Icon name="star" size="md" />
                </IconChip>
                <IconChip label="Runs on the edge runtime" side="right">
                  <Icon name="rocket" size="md" />
                </IconChip>
                <IconChip label="Open documentation" side="left">
                  <Icon name="wand" size="md" />
                </IconChip>
              </div>

              <Code>{`<Tooltip label="Command palette — ⌘K" side="bottom">
  <IconButton aria-label="Command palette" />
</Tooltip>`}</Code>
            </GlassCard>
          </SectionContainer>

          {/* ── floating dock ─────────────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="07 · Navigation"
            title="Floating dock"
            description="A macOS-style magnifying dock: hovered items bloom, neighbours taper with a gaussian falloff, and the same thing happens on keyboard focus. The page-level dock below is pinned with floating."
          >
            <GlassCard padding="lg">
              <div className="border-hairline rounded-2xl border bg-gradient-to-b from-white/[0.04] to-transparent px-6 py-10">
                <FloatingDock items={dockItems} />
              </div>

              <Code>{`<FloatingDock floating items={dockItems} />`}</Code>
            </GlassCard>
          </SectionContainer>

          {/* ── skeletons ─────────────────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="08 · Loading"
            title="Loading skeleton"
            description="One highlight band sweeps the placeholder. Decorative bars are aria-hidden — pass a label once per block to announce the wait politely."
            actions={
              <Button
                variant="outline"
                onClick={() => setLoading((value) => !value)}
                iconLeft={<Check />}
              >
                {loading ? "Show content" : "Show skeleton"}
              </Button>
            }
          >
            <div className="grid gap-6 md:grid-cols-2">
              {loading ? (
                <SkeletonCard label="Loading project overview" />
              ) : (
                <GlassCard padding="lg" interactive>
                  <div
                    className="bg-aura animate-aurora h-36 rounded-lg"
                    aria-hidden="true"
                  />
                  <h3 className="text-ink mt-4 text-lg font-semibold">
                    astra-os / production
                  </h3>
                  <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                    Deployed 4 minutes ago from <code>main</code> · 128ms p95.
                  </p>
                </GlassCard>
              )}

              <div className="space-y-5">
                <SkeletonText lines={4} label="Loading description" />
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0" radius="pill" />
                  <div className="flex-1 space-y-2.5">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                </div>
                <Skeleton className="h-24 w-full" radius="lg" />
              </div>
            </div>
          </SectionContainer>

          {/* ── animated backgrounds ──────────────────────────────────── */}
          <SectionContainer
            padded={false}
            width="wide"
            divided
            eyebrow="09 · Atmosphere"
            title="Animated background wrappers"
            description="Aurora blooms, blueprint grid and film grain — GPU-composited, pointer-transparent and aria-hidden. This page's own backdrop is AnimatedBackground."
          >
            <GlassCard padding="none">
              <div className="rounded-glass relative isolate h-72 overflow-hidden">
                <AnimatedBackground grid={{ size: 56 }} aurora="vivid" />
                <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Badge variant="aura" dot pulse>
                    Live preview
                  </Badge>
                  <p className="text-ink-muted max-w-sm px-6 text-sm leading-relaxed">
                    Swap intensity with{" "}
                    <code className="text-aura-violet-soft">intensity</code>,
                    toggle the grid with{" "}
                    <code className="text-aura-violet-soft">grid</code>.
                  </p>
                </div>
              </div>
            </GlassCard>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <GlassCard
                padding="md"
                className="relative isolate h-40 overflow-hidden"
              >
                <AuroraMini />
              </GlassCard>
              <GlassCard
                padding="md"
                className="relative isolate h-40 overflow-hidden"
              >
                <GridBackdropMini />
              </GlassCard>
              <GlassCard
                padding="md"
                className="relative isolate h-40 overflow-hidden"
              >
                <GrainMini />
              </GlassCard>
            </div>

            <Code>{`<div className="relative isolate">
  <AnimatedBackground aurora grid={{ size: 72 }} noise />
  …
</div>`}</Code>
          </SectionContainer>
        </div>
      </main>

      <footer className="border-hairline border-t bg-black/30">
        <div className="container-page text-ink-faint flex flex-col items-center justify-between gap-4 py-8 text-sm sm:flex-row">
          <p>Astra OS · 12 components, token-driven and accessible</p>
          <p className="text-ink-ghost font-mono text-xs">
            src/components/ui · src/components/layout · src/components/shared
          </p>
        </div>
      </footer>

      <FloatingDock floating items={dockItems} />
    </div>
  );
}

/* ── small isolated backdrop previews ───────────────────────────────────── */

function AuroraMini() {
  return (
    <div className="relative isolate h-full w-full">
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-lg">
        <AnimatedBackground aurora="subtle" grid={false} noise={false} />
      </div>
      <span className="eyebrow">Aurora</span>
      <p className="text-ink-muted mt-2 text-sm">Three drifting aura blooms</p>
    </div>
  );
}

function GridBackdropMini() {
  return (
    <div className="relative isolate h-full w-full">
      <GridBackground size={40} className="rounded-lg" />
      <span className="eyebrow">Grid</span>
      <p className="text-ink-muted mt-2 text-sm">Masked blueprint lines</p>
    </div>
  );
}

function GrainMini() {
  return (
    <div className="relative isolate h-full w-full">
      {/* absolute preview of the grain — NoiseOverlay itself is viewport-fixed */}
      <div
        className="bg-raised absolute inset-0 -z-10 rounded-lg"
        aria-hidden="true"
        style={{
          backgroundImage: "var(--noise-texture)",
          backgroundRepeat: "repeat",
          backgroundBlendMode: "overlay",
          opacity: 0.4,
        }}
      />
      <span className="eyebrow">Grain</span>
      <p className="text-ink-muted mt-2 text-sm">
        SVG turbulence at{" "}
        <code className="text-aura-violet-soft">--noise-texture</code>
      </p>
    </div>
  );
}
