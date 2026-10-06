import { SectionHeading } from "./color-section";

const radii = [
  "rounded-xs",
  "rounded-sm",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-2xl",
  "rounded-3xl",
  "rounded-4xl",
  "rounded-glass",
  "rounded-pill",
];

export function RadiusSection() {
  return (
    <section aria-labelledby="radius">
      <SectionHeading id="radius" title="Radius" />
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-10">
        {radii.map((r) => (
          <div key={r} className="flex flex-col items-center gap-2">
            <div
              className={`border-line from-aura-violet/30 to-aura-cyan/20 h-16 w-full border bg-gradient-to-br ${r}`}
            />
            <code className="text-ink-faint text-micro font-mono">
              {r.replace("rounded-", "")}
            </code>
          </div>
        ))}
      </div>
    </section>
  );
}
