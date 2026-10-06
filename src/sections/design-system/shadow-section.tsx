import { SectionHeading } from "./color-section";

const cards = [
  { label: "shadow-xs", cls: "shadow-xs" },
  { label: "shadow-md", cls: "shadow-md" },
  { label: "shadow-xl", cls: "shadow-xl" },
  { label: "shadow-glow-violet", cls: "shadow-glow-violet" },
  { label: "shadow-glow-cyan", cls: "shadow-glow-cyan" },
  { label: "shadow-glow-aura", cls: "shadow-glow-aura" },
];

const materials = [
  { label: "glass-subtle", cls: "glass-subtle" },
  { label: "glass", cls: "glass" },
  { label: "glass-strong", cls: "glass-strong" },
];

export function ShadowSection() {
  return (
    <section aria-labelledby="shadow">
      <SectionHeading id="shadow" title="Shadows & glass" />

      <p className="eyebrow mb-4">Elevation & neon glow</p>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="flex flex-col items-center gap-3">
            <div
              className={`rounded-glass border-line bg-raised h-20 w-full border ${c.cls}`}
            />
            <code className="text-ink-faint text-micro text-center font-mono">
              {c.label}
            </code>
          </div>
        ))}
      </div>

      <p className="eyebrow mt-10 mb-4">Glass morphism materials</p>
      <div className="bg-aura animate-aurora border-line relative overflow-hidden rounded-2xl border p-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {materials.map((m) => (
            <div key={m.label} className={`rounded-glass p-6 ${m.cls}`}>
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-ink-faint mt-1 text-xs">
                backdrop-blur + hairline border
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
