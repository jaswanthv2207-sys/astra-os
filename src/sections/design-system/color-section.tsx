const groups: { title: string; swatches: { name: string; cls: string }[] }[] = [
  {
    title: "Aura hues",
    swatches: [
      { name: "violet", cls: "bg-aura-violet" },
      { name: "indigo", cls: "bg-aura-indigo" },
      { name: "blue", cls: "bg-aura-blue" },
      { name: "cyan", cls: "bg-aura-cyan" },
      { name: "teal", cls: "bg-aura-teal" },
      { name: "fuchsia", cls: "bg-aura-fuchsia" },
      { name: "rose", cls: "bg-aura-rose" },
    ],
  },
  {
    title: "Surfaces",
    swatches: [
      { name: "void", cls: "bg-void" },
      { name: "canvas", cls: "bg-canvas" },
      { name: "raised", cls: "bg-raised" },
      { name: "overlay", cls: "bg-overlay" },
      { name: "highest", cls: "bg-highest" },
      { name: "glass", cls: "bg-glass" },
    ],
  },
  {
    title: "Ink",
    swatches: [
      { name: "ink", cls: "bg-ink" },
      { name: "ink-muted", cls: "bg-ink-muted" },
      { name: "ink-faint", cls: "bg-ink-faint" },
      { name: "ink-ghost", cls: "bg-ink-ghost" },
    ],
  },
  {
    title: "Semantic",
    swatches: [
      { name: "success", cls: "bg-success" },
      { name: "warning", cls: "bg-warning" },
      { name: "danger", cls: "bg-danger" },
      { name: "info", cls: "bg-info" },
    ],
  },
];

export function ColorSection() {
  return (
    <section aria-labelledby="colors">
      <SectionHeading id="colors" title="Colour" />
      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="eyebrow mb-4">{group.title}</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {group.swatches.map((s) => (
                <div key={s.name} className="flex flex-col gap-2">
                  <div
                    className={`border-line h-16 w-full rounded-lg border ${s.cls}`}
                  />
                  <code className="text-ink-faint font-mono text-xs">
                    {s.name}
                  </code>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <p className="eyebrow mb-4">Gradients</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-aura animate-aurora rounded-glass border-line h-24 border" />
          <div
            className="rounded-glass border-line h-24 border"
            style={{ backgroundImage: "var(--gradient-aura-text)" }}
          />
          <div
            className="rounded-glass border-line h-24 border"
            style={{ backgroundImage: "var(--gradient-aura-soft)" }}
          />
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <h2 id={id} className="text-title font-semibold">
        {title}
      </h2>
      <div className="h-px flex-1 bg-[linear-gradient(90deg,var(--border-subtle),transparent)]" />
    </div>
  );
}
