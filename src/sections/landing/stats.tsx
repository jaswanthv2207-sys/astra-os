import { Reveal } from "@/components";

const STATS = [
  { value: "40ms", label: "median recall" },
  { value: "2.4M", label: "objects indexed" },
  { value: "99.99%", label: "uptime in beta" },
  { value: "180+", label: "integrations" },
];

/**
 * StatsBand — the proof strip under the hero. Hairline-ruled, staggered
 * in with Reveal so the numbers land one after another.
 */
export function StatsBand() {
  return (
    <section
      aria-label="Astra OS in numbers"
      className="border-hairline relative border-y bg-white/[0.02]"
    >
      <ul className="container-page grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4">
        {STATS.map((stat, index) => (
          <li key={stat.label} className="text-center">
            <Reveal delay={index * 0.06}>
              <p className="text-title text-ink font-semibold tabular-nums">
                {stat.value}
              </p>
              <p className="eyebrow mt-1">{stat.label}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
