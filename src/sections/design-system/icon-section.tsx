import { Icon, type IconSize } from "@/components";
import { ICON_NAMES } from "@/lib/icons";

import { SectionHeading } from "./color-section";

/** The ramp — mirrored from the `--icon-*` tokens (xs 14 → 2xl 32). */
const ramp: { size: IconSize; px: number }[] = [
  { size: "xs", px: 14 },
  { size: "sm", px: 16 },
  { size: "md", px: 18 },
  { size: "lg", px: 20 },
  { size: "xl", px: 24 },
  { size: "2xl", px: 32 },
];

const rules = [
  {
    title: "One ramp, one stroke",
    body: "Sizes come from --icon-xs…--icon-2xl and every icon renders at --icon-stroke (1.75) — CSS beats lucide's own stroke-width attribute, so line weight can never drift.",
  },
  {
    title: "Decorative by default",
    body: 'An icon next to a label is aria-hidden: the control already carries the name. Pass `label` only when the icon IS the meaning (role="img").',
  },
  {
    title: "Icon-only controls name themselves",
    body: "A bare icon in a button, dock or chip gets aria-label on the control — never on both.",
  },
];

export function IconSection() {
  return (
    <section aria-labelledby="icons">
      <SectionHeading id="icons" title="Icons" />

      {/* size ramp */}
      <div className="border-line mb-8 rounded-lg border bg-white/[0.03]">
        <div className="border-hairline flex flex-wrap items-end gap-8 border-b px-5 py-5">
          {ramp.map(({ size, px }) => (
            <div key={size} className="flex flex-col items-center gap-3">
              <div className="flex h-8 items-center">
                <Icon
                  name="rocket"
                  size={size}
                  className="text-aura-violet-soft"
                />
              </div>
              <code className="text-ink-faint text-micro font-mono">
                icon-{size} · {px}px
              </code>
            </div>
          ))}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-8 items-center">
              <Icon name="search" label="Search" className="text-aura-cyan" />
            </div>
            <code className="text-ink-faint text-micro font-mono">
              label · role=img
            </code>
          </div>
        </div>

        <pre className="text-ink-muted overflow-x-auto px-5 py-4 font-mono text-xs leading-relaxed">
          <code>{`<Icon name="rocket" size="lg" />     // decorative — aria-hidden
<Icon name="search" label="Search" />  // meaningful — role="img"
<Icon as={CustomGlyph} size="xl" />    // outside the registry`}</code>
        </pre>
      </div>

      {/* registry */}
      <p className="eyebrow mb-4">Registry · {ICON_NAMES.length} names</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {ICON_NAMES.map((name) => (
          <div
            key={name}
            className="border-line text-ink-muted hover:border-aura-violet/50 hover:text-ink flex flex-col items-center gap-2 rounded-lg border bg-white/[0.03] px-2 py-4 transition-colors"
          >
            <Icon name={name} size="lg" />
            <code className="text-ink-faint text-micro font-mono">{name}</code>
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
