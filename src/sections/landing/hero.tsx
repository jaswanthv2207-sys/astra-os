"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from "framer-motion";

import { cn } from "@/lib/utils";
import { useLaunch } from "@/hooks";
import {
  AnimatedBackground,
  Badge,
  Button,
  GlassCard,
  Icon,
  SearchBar,
} from "@/components";
import type { IconName } from "@/lib/icons";

/* ── motion choreography ────────────────────────────────────────────────── */

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

const visualIn: Variants = {
  hidden: { opacity: 0, y: 48, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 },
  },
};

/* ── the knowledge palette (hero product visual) ────────────────────────── */

type Result = {
  icon: IconName;
  title: string;
  meta: string;
  type: string;
  tone: "default" | "outline" | "success" | "info";
};

const RESULTS: Result[] = [
  {
    icon: "box",
    title: "Atlas launch brief",
    meta: "Document · 12 pages · updated 2h ago",
    type: "Doc",
    tone: "default",
  },
  {
    icon: "layers",
    title: "Q3 roadmap — what we cut",
    meta: "Note · edited yesterday",
    type: "Note",
    tone: "outline",
  },
  {
    icon: "check",
    title: "Decision: pricing tiers",
    meta: "Decision · with 4 people",
    type: "Decision",
    tone: "success",
  },
  {
    icon: "command",
    title: "Keyboard map",
    meta: "Guide · ⌘K, ⌘P, ⌘⇧F",
    type: "Guide",
    tone: "info",
  },
];

function KnowledgePalette({
  chipX,
  chipY,
}: {
  chipX: MotionValue<number>;
  chipY: MotionValue<number>;
}) {
  const [question, setQuestion] = React.useState("Why did we postpone Atlas?");

  return (
    <div className="relative" style={{ perspective: 1400 }}>
      <GlassCard
        tone="strong"
        padding="none"
        className="shadow-glass overflow-hidden"
      >
        {/* input — real and typeable; the navbar still owns the global ⌘K */}
        <div className="border-hairline border-b bg-white/[0.02] p-3">
          <SearchBar
            value={question}
            onValueChange={setQuestion}
            onSubmit={() => undefined}
            srLabel="Ask Astra"
            placeholder="Ask anything in your workspace…"
            enableGlobalShortcut={false}
          />
        </div>

        {/* cited answer */}
        <div className="border-aura-violet/20 bg-aura-violet/10 m-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Icon name="sparkles" size="xs" className="text-aura-violet-soft" />
            <span className="text-aura-violet-soft text-micro font-semibold uppercase">
              Astra
            </span>
            <Badge variant="aura" size="sm">
              Answer
            </Badge>
            <span className="text-ink-ghost text-micro ml-auto font-mono">
              0.4s
            </span>
          </div>

          <p className="text-ink mt-2 text-sm leading-relaxed">
            Atlas slipped to{" "}
            <span className="text-aura-violet-soft font-semibold">
              October 12
            </span>{" "}
            to land the auth rewrite first — confirmed in the Q3 review and the
            #launch channel.
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge size="sm">Q3-review.md</Badge>
            <Badge size="sm">Slack · #launch</Badge>
            <Badge size="sm" variant="outline">
              Sep 28
            </Badge>
          </div>
        </div>

        {/* ranked results */}
        <ul className="px-2 pb-2">
          {RESULTS.map((result) => (
            <li
              key={result.title}
              className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.05]"
            >
              <span className="border-line text-ink-faint group-hover:border-aura-violet/40 group-hover:text-aura-violet-soft grid size-8 shrink-0 place-items-center rounded-md border bg-white/[0.04] transition-colors">
                <Icon name={result.icon} size="sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-ink block truncate text-sm font-medium">
                  {result.title}
                </span>
                <span className="text-ink-faint text-micro block truncate">
                  {result.meta}
                </span>
              </span>
              <Badge size="sm" variant={result.tone} className="shrink-0">
                {result.type}
              </Badge>
            </li>
          ))}
        </ul>

        {/* status bar */}
        <div className="border-hairline text-ink-faint text-micro flex items-center justify-between border-t px-4 py-2.5 font-mono">
          <span className="flex items-center gap-1.5">
            <Icon name="zap" size="xs" className="text-aura-violet-soft" />
            ranked by relevance
          </span>
          <span>4 results</span>
        </div>
      </GlassCard>

      {/* floating proof chips — counter-drift against the palette on pointer */}
      <motion.span
        aria-hidden="true"
        style={{ x: chipX, y: chipY }}
        className="absolute -top-6 -left-6 hidden md:block"
      >
        <span className="animate-float text-ink glass rounded-pill shadow-glass flex items-center gap-2 px-3 py-1.5 text-xs whitespace-nowrap">
          <Icon name="zap" size="xs" className="text-aura-violet-soft" />
          40ms median recall
        </span>
      </motion.span>

      <motion.span
        aria-hidden="true"
        style={{ x: chipX, y: chipY }}
        className="absolute top-1/3 -right-8 hidden md:block"
      >
        <span
          className="animate-float text-ink glass rounded-pill shadow-glass flex items-center gap-2 px-3 py-1.5 text-xs whitespace-nowrap"
          style={{ animationDelay: "-2.4s" }}
        >
          <Icon name="check" size="xs" className="text-success" />3 sources
          cited
        </span>
      </motion.span>

      <motion.span
        aria-hidden="true"
        style={{ x: chipX, y: chipY }}
        className="absolute -bottom-5 left-8 hidden md:block"
      >
        <span
          className="animate-float text-ink glass rounded-pill shadow-glass flex items-center gap-2 px-3 py-1.5 text-xs whitespace-nowrap"
          style={{ animationDelay: "-4.6s" }}
        >
          <kbd className="border-line rounded border bg-white/[0.06] px-1.5 py-0.5 font-mono">
            ⌘K
          </kbd>
          ask from anywhere
        </span>
      </motion.span>
    </div>
  );
}

/* ── hero ───────────────────────────────────────────────────────────────── */

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { launch, launching } = useLaunch();
  const [scrolled, setScrolled] = React.useState(false);

  /* Fade the scroll cue once the page moves (passive, no reflow). */
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* pointer parallax — springs keep the drift soft and expensive-feeling */
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const sx = useSpring(pointerX, { stiffness: 50, damping: 18, mass: 0.6 });
  const sy = useSpring(pointerY, { stiffness: 50, damping: 18, mass: 0.6 });

  const visualX = useTransform(sx, [-1, 1], [-10, 10]);
  const visualY = useTransform(sy, [-1, 1], [-8, 8]);
  const visualRotateY = useTransform(sx, [-1, 1], [-2.2, 2.2]);
  const visualRotateX = useTransform(sy, [-1, 1], [2, -2]);
  const chipX = useTransform(sx, [-1, 1], [24, -24]);
  const chipY = useTransform(sy, [-1, 1], [16, -16]);
  const orbX = useTransform(sx, [-1, 1], [-8, 8]);
  const orbY = useTransform(sy, [-1, 1], [-6, 6]);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    pointerY.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  return (
    <section
      aria-labelledby="hero-title"
      onPointerMove={handlePointerMove}
      className="relative isolate flex min-h-dvh flex-col justify-center overflow-hidden pt-32 pb-24"
    >
      <AnimatedBackground aurora="vivid" grid={{ size: 88 }} />

      {/* floating background elements — parallax wrapper over CSS float */}
      <motion.div
        aria-hidden="true"
        style={{ x: orbX, y: orbY }}
        className="pointer-events-none absolute inset-0"
      >
        <span className="animate-float bg-aura-violet shadow-glow-violet absolute top-28 left-6 size-2 rounded-full md:left-16" />
        <span
          className="animate-float bg-aura-cyan absolute top-1/2 left-3 size-1.5 rounded-full opacity-80 md:left-10"
          style={{ animationDelay: "-2.2s" }}
        />
        <span
          className="animate-float bg-aura-fuchsia absolute top-36 right-8 size-2 rounded-full md:right-20"
          style={{ animationDelay: "-4.4s" }}
        />
        <span
          className="animate-float from-aura-violet/80 absolute right-24 bottom-40 h-16 w-px bg-gradient-to-b to-transparent"
          style={{ animationDelay: "-1.2s" }}
        />
      </motion.div>

      {/* copy */}
      <motion.div
        variants={stagger}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="container-page relative z-10 flex flex-col items-center gap-6 text-center"
      >
        <motion.div variants={rise}>
          <Badge variant="aura" size="lg" dot pulse>
            Astra OS 1.0 — early access is open
          </Badge>
        </motion.div>

        <motion.h1
          variants={rise}
          id="hero-title"
          className="text-display text-ink max-w-4xl font-semibold text-balance"
        >
          The AI operating system{" "}
          <span className="text-aurora block">for everything you know.</span>
        </motion.h1>

        <motion.p
          variants={rise}
          className="text-lead text-ink-muted max-w-2xl text-balance"
        >
          Astra OS turns your notes, docs and decisions into one living
          knowledge graph — then answers any question in seconds, with sources
          you can trust.
        </motion.p>

        <motion.div
          variants={rise}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <Button
            size="lg"
            variant="cosmic"
            onClick={launch}
            disabled={launching}
            aria-label="Launch Universe — enter the 3D Astra OS experience"
          >
            <Icon name="rocket" />
            {launching ? "Engaging warp…" : "Launch Universe"}
          </Button>
          <Button size="lg" variant="primary" asChild>
            <a href="#waitlist">
              Start free
              <Icon name="arrow-right" />
            </a>
          </Button>
          <Button size="lg" variant="glass" asChild>
            <a href="#how">
              See how it works
              <Icon name="arrow-down" />
            </a>
          </Button>
        </motion.div>

        <motion.ul
          variants={rise}
          className="text-ink-faint flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"
        >
          <li className="flex items-center gap-1.5">
            <Icon name="check" size="xs" className="text-aura-violet-soft" />
            Free for individuals
          </li>
          <li className="flex items-center gap-1.5">
            <Icon name="check" size="xs" className="text-aura-violet-soft" />
            No credit card
          </li>
          <li className="flex items-center gap-1.5">
            <Icon name="shield" size="xs" className="text-aura-violet-soft" />
            Private by design
          </li>
        </motion.ul>
      </motion.div>

      {/* product visual */}
      <motion.div
        variants={visualIn}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="container-page px-gutter relative z-10 mx-auto mt-16 max-w-3xl"
      >
        <motion.div
          style={{
            x: visualX,
            y: visualY,
            rotateX: visualRotateX,
            rotateY: visualRotateY,
          }}
        >
          <div className="animate-float" style={{ animationDelay: "-1.6s" }}>
            <KnowledgePalette chipX={chipX} chipY={chipY} />
          </div>
        </motion.div>
      </motion.div>

      {/* scroll cue — fades away the moment the page starts moving */}
      <div
        aria-hidden="true"
        className={cn(
          "duration-slow absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 transition-opacity md:flex",
          scrolled ? "opacity-0" : "opacity-100",
        )}
      >
        <span className="eyebrow">Scroll</span>
        <span className="from-aura-violet/70 relative h-10 w-px bg-gradient-to-b to-transparent">
          <span className="animate-float bg-aura-violet shadow-glow-dot absolute -top-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full" />
        </span>
      </div>

      {/* cinematic fade into the next section */}
      <div
        aria-hidden="true"
        className="to-canvas pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent"
      />
    </section>
  );
}
