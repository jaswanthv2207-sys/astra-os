import type { Metadata } from "next";

import { AuroraBackground, Navbar } from "@/components";
import { SiteFooter } from "@/sections/landing";
import { ShortcutsContent } from "@/sections/shortcuts";

export const metadata: Metadata = {
  title: "Keyboard shortcuts",
  description:
    "Every keyboard shortcut in Astra OS — command palette, galaxy map, timeline scrubbing, dossier tabs and the Universe Manager, in one reference.",
};

export default function ShortcutsPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="relative isolate overflow-hidden">
        <AuroraBackground intensity="subtle" />
        <ShortcutsContent />
      </main>
      <SiteFooter />
    </>
  );
}
