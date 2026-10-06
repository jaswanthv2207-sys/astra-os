import type { Metadata } from "next";
import {
  Aurora,
  ColorSection,
  Footer,
  Hero,
  IconSection,
  MotionSection,
  RadiusSection,
  ShadowSection,
  SpacingSection,
  TypographySection,
} from "@/sections/design-system";
import { Navbar } from "@/components";

export const metadata: Metadata = {
  title: "Design System",
  description:
    "Astra OS design system — colours, typography, spacing, icons, radius, shadows, motion and glass materials.",
};

export default function DesignSystemPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="relative isolate overflow-hidden">
        <Aurora />
        <Hero />
        <div className="container-page gap-section pb-section relative z-10 flex flex-col">
          <ColorSection />
          <TypographySection />
          <SpacingSection />
          <IconSection />
          <RadiusSection />
          <ShadowSection />
          <MotionSection />
        </div>
        <Footer />
      </main>
    </>
  );
}
