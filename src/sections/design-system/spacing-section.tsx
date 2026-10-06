import { SectionHeading } from "./color-section";

/**
 * The linear scale: the steps a component may reach for without inventing a
 * value. Every step is `calc(var(--spacing-unit) * N)` — a 4px major grid
 * with Tailwind's `.5` steps as the 2px micro-step.
 */
const steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const;

/** Fluid rhythm — proportional to the viewport, never a fixed pixel value. */
const fluid = [
  {
    token: "--space-section",
    value: "clamp(5rem, 3rem + 7vw, 9rem)",
    range: "80 → 144px",
    utilities: "section-y · py-section · gap-section",
  },
  {
    token: "--space-gutter",
    value: "clamp(1.25rem, 1rem + 2vw, 2.5rem)",
    range: "20 → 40px",
    utilities: "container-page · px-gutter",
  },
];

const rules = [
  {
    title: "4px major grid",
    body: "Inside a component, every padding/gap/margin is a step of --spacing-unit. `.5` steps (2px) exist for optical nudges — nothing else.",
  },
  {
    title: "Fluid where it's structural",
    body: "Section rhythm and page gutters come from the clamp() tokens so they breathe with the viewport — never a hardcoded px value.",
  },
  {
    title: "Promote, don't invent",
    body: "A reusable component with an arbitrary value is a missing token. Add it to tokens.css, bridge it in theme.css, then use it everywhere.",
  },
];

export function SpacingSection() {
  return (
    <section aria-labelledby="spacing">
      <SectionHeading id="spacing" title="Spacing" />

      {/* base unit */}
      <div className="border-line mb-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border bg-white/[0.03] px-5 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-ink font-mono text-sm">4px</span>
          <code className="text-ink-faint text-micro font-mono">
            --spacing-unit: 0.25rem
          </code>
        </div>
        <div className="text-ink-muted flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span>
            <code className="text-aura-violet-soft font-mono">p-4</code> → 16px
          </span>
          <span>
            <code className="text-aura-violet-soft font-mono">gap-2.5</code> →
            10px
          </span>
          <span>
            <code className="text-aura-violet-soft font-mono">px-6</code> → 24px
          </span>
        </div>
      </div>

      {/* linear steps */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
        {steps.map((step) => (
          <div key={step} className="flex flex-col gap-2">
            <div
              className="from-aura-violet/70 to-aura-cyan/40 h-3 min-w-1 rounded-full bg-gradient-to-r"
              style={{ width: `calc(var(--spacing-unit) * ${step})` }}
            />
            <code className="text-ink-faint text-micro font-mono">
              {step} · {step * 4}px
            </code>
          </div>
        ))}
      </div>

      {/* fluid rhythm */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {fluid.map((entry) => (
          <div
            key={entry.token}
            className="border-line flex flex-col gap-2 rounded-lg border bg-white/[0.03] px-5 py-4"
          >
            <code className="text-aura-violet-soft font-mono text-xs">
              {entry.token}
            </code>
            <code className="text-ink-muted text-micro font-mono">
              {entry.value}
            </code>
            <div className="text-ink-faint flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>{entry.range}</span>
              <code className="text-micro font-mono">{entry.utilities}</code>
            </div>
          </div>
        ))}
      </div>

      {/* rules */}
      <ul className="mt-10 grid gap-6 sm:grid-cols-3">
        {rules.map((rule, index) => (
          <li key={rule.title} className="flex flex-col gap-2">
            <span className="eyebrow">
              {String(index + 1).padStart(2, "0")} · {rule.title}
            </span>
            <p className="text-ink-muted text-sm leading-relaxed">
              {rule.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
