import { Icon, SectionContainer } from "@/components";
import type { IconName } from "@/lib/icons";

const STEPS: { icon: IconName; step: string; title: string; body: string }[] = [
  {
    icon: "download",
    step: "Step 01",
    title: "Capture",
    body: "Clip pages, PDFs, threads and screenshots. Astra parses, tags and files them the moment they land.",
  },
  {
    icon: "network",
    step: "Step 02",
    title: "Connect",
    body: "Entities link themselves — every mention stitches another edge into your graph while you work.",
  },
  {
    icon: "sparkles",
    step: "Step 03",
    title: "Ask",
    body: "Ask in your own words. Get a cited answer in under a second, then verify every claim in one click.",
  },
];

/**
 * HowItWorks — the three-move narrative, threaded on a single gradient
 * hairline so the steps read as one continuous motion.
 */
export function HowItWorks() {
  return (
    <SectionContainer
      id="how"
      className="scroll-mt-24"
      width="wide"
      divided
      eyebrow="How it works"
      title="Three moves to a living workspace"
      description="No setup weekend, no taxonomy to invent. Capture, connect, ask."
    >
      <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
        {STEPS.map((item) => (
          <li
            key={item.title}
            className="md:before:from-aura-violet/40 md:before:to-aura-violet/40 relative flex flex-col gap-3 md:before:absolute md:before:top-5 md:before:-left-6 md:before:block md:before:h-px md:before:w-6 md:before:bg-gradient-to-r md:before:content-[''] md:first:before:hidden"
          >
            <div className="relative z-10 flex items-center gap-3">
              <span className="border-line text-aura-violet-soft grid size-10 place-items-center rounded-lg border bg-white/[0.05]">
                <Icon name={item.icon} size="lg" />
              </span>
              <span className="eyebrow">{item.step}</span>
            </div>
            <h3 className="text-ink text-lg font-semibold">{item.title}</h3>
            <p className="text-ink-muted text-sm leading-relaxed">
              {item.body}
            </p>
          </li>
        ))}
      </ol>
    </SectionContainer>
  );
}
