import * as React from "react";

import { cn } from "@/lib/utils";
import { Reveal } from "@/components/shared/reveal";

type HeadingLevel = "h1" | "h2" | "h3";
type Width = "narrow" | "default" | "wide" | "full";

const widthClasses: Record<Width, string> = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

export interface SectionContainerProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "title"
> {
  /** Capsule label above the title (e.g. "Components"). */
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot (buttons, tabs, filters) — stacks below on mobile. */
  actions?: React.ReactNode;
  /** Heading level — pick the one that fits the page outline (default h2). */
  headingLevel?: HeadingLevel;
  /** Apply the tokenised section rhythm (`--space-section`). */
  padded?: boolean;
  /** Content max-width. */
  width?: Width;
  /** Scroll-reveal the header and body. */
  animate?: boolean;
  /** Hairline rule above the section. */
  divided?: boolean;
}

/**
 * SectionContainer — the page's repeating unit: centred measure, heading
 * block, optional actions, and consistent vertical rhythm.
 *
 * Keeps the heading outline correct (`headingLevel`) and exposes the header
 * as a `<header>` landmark inside the `<section>` so screen readers can jump
 * between sections.
 *
 * @example
 * <SectionContainer
 *   eyebrow="Design system"
 *   title="Colour"
 *   description="Every hue in Astra OS comes from one palette."
 *   actions={<Button variant="outline">Export tokens</Button>}
 * >
 *   …
 * </SectionContainer>
 */
export function SectionContainer({
  eyebrow,
  title,
  description,
  actions,
  headingLevel: Heading = "h2",
  padded = true,
  width = "default",
  animate = true,
  divided = false,
  className,
  children,
  ...props
}: SectionContainerProps) {
  const hasHeader = Boolean(eyebrow || title || description || actions);

  return (
    <section
      className={cn(
        "relative",
        padded && "section-y",
        divided && "border-hairline border-t",
        className,
      )}
      {...props}
    >
      <div className={cn("container-page", widthClasses[width])}>
        {hasHeader && (
          <Reveal animate={animate} className="mb-10 md:mb-12">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
                {title && (
                  <Heading className="text-title text-ink font-semibold text-balance">
                    {title}
                  </Heading>
                )}
                {description && (
                  <p className="text-lead text-ink-muted mt-4">{description}</p>
                )}
              </div>

              {actions && (
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  {actions}
                </div>
              )}
            </header>
          </Reveal>
        )}

        <Reveal animate={animate} delay={hasHeader ? 0.08 : 0}>
          {children}
        </Reveal>
      </div>
    </section>
  );
}

/** Alias for terser call sites. */
export const Section = SectionContainer;
