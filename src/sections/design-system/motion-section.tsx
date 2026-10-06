import { SectionHeading } from "./color-section";

const easings = [
  { label: "ease-out-expo", cls: "ease-out-expo" },
  { label: "ease-out-quart", cls: "ease-out-quart" },
  { label: "ease-spring", cls: "ease-spring" },
  { label: "ease-smooth", cls: "ease-smooth" },
];

const durations = [
  { label: "fast · 150ms", cls: "duration-fast" },
  { label: "base · 250ms", cls: "duration-base" },
  { label: "slow · 500ms", cls: "duration-slow" },
  { label: "slower · 800ms", cls: "duration-slower" },
];

export function MotionSection() {
  return (
    <section aria-labelledby="motion">
      <SectionHeading id="motion" title="Motion" />

      <p className="eyebrow mb-4">Ambient animations</p>
      <div className="mb-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <AnimCard label="animate-float">
          <div className="animate-float rounded-glass bg-aura-violet shadow-glow-violet h-12 w-12" />
        </AnimCard>
        <AnimCard label="animate-pulse-glow">
          <div className="animate-pulse-glow rounded-pill bg-aura-cyan shadow-glow-cyan h-12 w-12" />
        </AnimCard>
        <AnimCard label="animate-spin-slow">
          <div className="animate-spin-slow rounded-glass border-aura-fuchsia h-12 w-12 border-2 border-t-transparent" />
        </AnimCard>
        <AnimCard label="animate-shimmer">
          <div className="rounded-glass bg-raised relative h-12 w-full overflow-hidden">
            <div className="animate-shimmer via-ink/10 absolute -inset-x-full inset-y-0 bg-gradient-to-r from-transparent to-transparent" />
          </div>
        </AnimCard>
      </div>

      <p className="eyebrow mb-4">Transitions · hover the tiles</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {easings.map((e) => (
          <div
            key={e.label}
            className={`interactive interactive-lift hover:shadow-glow-violet glass rounded-glass p-5 ${e.cls}`}
          >
            <p className="text-sm font-medium">{e.label}</p>
            <p className="text-ink-faint mt-1 text-xs">cubic-bezier</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {durations.map((d) => (
          <div
            key={d.label}
            className={`interactive interactive-lift hover:bg-glass-strong rounded-glass border-line bg-raised border p-5 ${d.cls}`}
          >
            <p className="text-sm font-medium">{d.label}</p>
            <p className="text-ink-faint mt-1 text-xs">transition-duration</p>
          </div>
        ))}
      </div>

      <p className="eyebrow mt-10 mb-4">Spacing rhythm</p>
      <div className="flex flex-wrap items-end gap-4">
        {[1, 2, 4, 8, 16].map((n) => (
          <div key={n} className="flex flex-col items-center gap-2">
            <div
              className="bg-aura-violet/40 rounded-xs"
              style={{ width: `calc(var(--spacing-unit) * ${n})`, height: 40 }}
            />
            <code className="text-ink-faint text-micro font-mono">{n}</code>
          </div>
        ))}
        <div className="flex flex-col items-center gap-2">
          <div className="border-gradient h-10 w-24 rounded-md" />
          <code className="text-ink-faint text-micro font-mono">
            border-gradient
          </code>
        </div>
      </div>
    </section>
  );
}

function AnimCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-glass flex flex-col items-center gap-4 p-5">
      <div className="flex h-16 w-full items-center justify-center">
        {children}
      </div>
      <code className="text-ink-faint text-micro text-center font-mono">
        {label}
      </code>
    </div>
  );
}
