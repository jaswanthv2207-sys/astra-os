/**
 * Page-level sections: large composed blocks that assemble components
 * into a view (hero, features grid, pricing, CTA, ...).
 *
 * One folder per section, each exposing a single default entry point:
 *   sections/hero/index.tsx
 *
 * Sections are page-scoped presentation only — no data fetching or
 * business logic; they receive data via props from the route.
 */
export * from "./design-system";
export * from "./components-showcase";
/* The landing hero is a different component from the design-system hero —
   re-export it under a distinct name to keep the barrel unambiguous. */
export {
  Features,
  HowItWorks,
  SiteFooter,
  SiteHeader,
  StatsBand,
  WaitlistCta,
  Hero as LandingHero,
} from "./landing";
