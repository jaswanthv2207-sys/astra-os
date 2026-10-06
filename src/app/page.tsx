import type { Metadata } from "next";

import {
  Features,
  Hero,
  HowItWorks,
  SiteFooter,
  SiteHeader,
  StatsBand,
  WaitlistCta,
} from "@/sections/landing";

export const metadata: Metadata = {
  title: {
    absolute: "Astra OS — The AI operating system for your knowledge",
  },
  description:
    "Astra OS is an AI-powered knowledge operating system: it unifies your notes, docs and decisions into one living graph and answers any question in seconds — with sources you can trust.",
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="relative isolate overflow-hidden">
        <Hero />
        <StatsBand />
        <Features />
        <HowItWorks />
        <WaitlistCta />
      </main>
      <SiteFooter />
    </>
  );
}
