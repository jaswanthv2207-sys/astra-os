import { SectionHeading } from "./color-section";

const scale = [
  { label: "display · text-display", cls: "text-display font-semibold" },
  { label: "hero · text-hero", cls: "text-hero font-semibold" },
  { label: "title · text-title", cls: "text-title font-semibold" },
  { label: "subtitle · text-subtitle", cls: "text-subtitle" },
  { label: "lead · text-lead", cls: "text-lead text-ink-muted" },
  { label: "body · text-base", cls: "text-base text-ink-muted" },
  { label: "caption · text-sm", cls: "text-sm text-ink-faint" },
];

export function TypographySection() {
  return (
    <section aria-labelledby="type">
      <SectionHeading id="type" title="Typography" />
      <div className="glass rounded-glass flex flex-col gap-6 p-8">
        {scale.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <span className="text-ink-ghost tracking-caps text-micro font-mono uppercase">
              {row.label}
            </span>
            <p className={row.cls}>
              Design is intelligence made visible — Astra&nbsp;OS
            </p>
          </div>
        ))}

        <div className="border-line mt-2 flex flex-col gap-2 border-t pt-6">
          <span className="text-ink-ghost tracking-caps text-micro font-mono uppercase">
            mono · font-mono
          </span>
          <p className="text-ink-muted font-mono text-sm">
            const astra = {"{"} aura: true, glass: true{"}"};
          </p>
        </div>
      </div>
    </section>
  );
}
