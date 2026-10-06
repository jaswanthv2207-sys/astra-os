"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";

import { cn } from "@/lib/utils";
import { useLaunch } from "@/hooks";
import { AnimatedBackground, Badge, Button, Icon } from "@/components";

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
