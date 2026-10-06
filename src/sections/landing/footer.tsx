import Link from "next/link";

import { Icon } from "@/components";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "Capabilities", href: "#features" },
      { label: "How it works", href: "#how" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "Design system", href: "/design-system" },
      { label: "Components", href: "/components" },
      { label: "Early access", href: "#waitlist" },
    ],
  },
];

/** SiteFooter — brand block + link columns + a hairline meta row. */
export function SiteFooter() {
  return (
    <footer className="border-hairline relative border-t">
      <div className="container-page flex flex-col gap-10 py-14 md:flex-row md:justify-between">
        <div className="flex max-w-sm flex-col gap-4">
          <Link
            href="/"
            aria-label="AstraOS — home"
            className="group focus-visible:outline-aura-violet flex w-fit items-center gap-2.5 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span
              aria-hidden="true"
              className="bg-aura shadow-glow-violet duration-base ease-out-expo size-7 rounded-lg transition-transform group-hover:scale-110 group-hover:rotate-12"
            />
            <span className="tracking-title text-ink text-sm font-semibold">
              Astra<span className="text-aura-violet-soft">OS</span>
            </span>
          </Link>

          <p className="text-ink-faint text-sm leading-relaxed">
            The AI operating system for everything you know. Built dark-first on
            a token-driven design system.
          </p>

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink-muted hover:text-ink focus-visible:outline-aura-violet flex w-fit items-center gap-2 rounded-md text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Icon name="github" size="sm" />
            Source on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-8">
          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <p className="eyebrow">{column.title}</p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => {
                  const className =
                    "text-ink-muted hover:text-ink focus-visible:outline-aura-violet rounded-md text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2";
                  const isAnchor = link.href.startsWith("#");

                  return (
                    <li key={link.href}>
                      {isAnchor ? (
                        <a href={link.href} className={className}>
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className={className}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-hairline border-t">
        <div className="container-page text-ink-faint text-micro flex flex-col items-center justify-between gap-2 py-6 sm:flex-row">
          <p>© 2026 Astra OS · Built with the Astra design language</p>
          <p className="font-mono">v1.0.0 · dark-first</p>
        </div>
      </div>
    </footer>
  );
}
