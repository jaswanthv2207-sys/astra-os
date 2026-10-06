import { GlassCard, Icon, SectionContainer } from "@/components";
import type { IconName } from "@/lib/icons";

/* ── small card content ─────────────────────────────────────────────────── */

const CARDS: {
  icon: IconName;
  title: string;
  body: string;
}[] = [
  {
    icon: "zap",
    title: "Recall in milliseconds",
    body: "Hybrid vector and keyword search across everything you've ever saved — 40ms, every time.",
  },
  {
    icon: "network",
    title: "One graph, zero silos",
    body: "People, projects and decisions link themselves as you capture. No folders, no filing day.",
  },
  {
    icon: "shield",
    title: "Private by design",
    body: "End-to-end encryption, local-first storage. Your graph is yours — we can't read it.",
  },
];

function CardIcon({ name }: { name: IconName }) {
  return (
    <span className="border-line text-aura-violet-soft grid size-10 shrink-0 place-items-center rounded-lg border bg-white/[0.05]">
      <Icon name={name} size="lg" />
    </span>
  );
}

/* ── section ────────────────────────────────────────────────────────────── */

export function Features() {
  return (
    <SectionContainer
      id="features"
      className="scroll-mt-24"
      width="wide"
      eyebrow="Capabilities"
      title="An operating system, not another notebook"
      description="Every layer of Astra OS turns scattered information into answers — fast, cited and private."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* hero card — ask in plain language */}
        <GlassCard interactive spotlight className="gap-6 lg:col-span-2">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <CardIcon name="sparkles" />
              <div className="flex flex-col gap-2">
                <h3 className="text-ink text-xl font-semibold">
                  Ask in plain language
                </h3>
                <p className="text-ink-muted text-sm leading-relaxed">
                  Questions in, cited answers out. Astra reads your workspace
                  the way a teammate would — then shows its work, line by line,
                  with every source one click away.
                </p>
              </div>
            </div>

            {/* mini answer visual */}
            <div className="border-hairline mt-1 flex flex-col gap-2.5 rounded-lg border bg-black/30 p-4">
              <div className="flex items-center gap-2">
                <Icon
                  name="sparkles"
                  size="xs"
                  className="text-aura-violet-soft"
                />
                <span className="text-aura-violet-soft text-micro font-semibold uppercase">
                  Astra
                </span>
                <span className="text-ink-ghost text-micro ml-auto font-mono">
                  0.4s
                </span>
              </div>
              <p className="text-ink text-sm">
                “Tiered pricing won — Start, Pro, Scale. Churn data supported it
                3:1.”
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="border-line text-ink-muted text-micro rounded-full border bg-white/[0.05] px-2 py-0.5 font-mono">
                  pricing.md
                </span>
                <span className="border-line text-ink-muted text-micro rounded-full border bg-white/[0.05] px-2 py-0.5 font-mono">
                  #growth
                </span>
                <span className="border-line text-ink-muted text-micro rounded-full border bg-white/[0.05] px-2 py-0.5 font-mono">
                  Oct 4
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* three-up cards */}
        {CARDS.map((card) => (
          <GlassCard key={card.title} interactive spotlight className="gap-4">
            <CardIcon name={card.icon} />
            <div className="flex flex-col gap-2">
              <h3 className="text-ink text-lg font-semibold">{card.title}</h3>
              <p className="text-ink-muted text-sm leading-relaxed">
                {card.body}
              </p>
            </div>
          </GlassCard>
        ))}

        {/* command card */}
        <GlassCard interactive spotlight className="lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <CardIcon name="command" />
              <div className="flex flex-col gap-2">
                <h3 className="text-ink text-lg font-semibold">
                  Command everything
                </h3>
                <p className="text-ink-muted max-w-md text-sm leading-relaxed">
                  The whole OS is one keystroke away — jump to anything, create
                  anywhere, ask mid-sentence.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {["⌘K", "⌘P", "⌘⇧F"].map((keys) => (
                <kbd
                  key={keys}
                  className="border-line text-ink-muted text-micro rounded-md border bg-white/[0.05] px-2 py-1 font-mono"
                >
                  {keys}
                </kbd>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </SectionContainer>
  );
}
