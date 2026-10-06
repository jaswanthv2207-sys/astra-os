import type { Metadata } from "next";

import { UniverseExperience } from "@/sections/universe";

export const metadata: Metadata = {
  title: {
    absolute: "Universe — Astra OS",
  },
  description:
    "Step inside Astra OS: a live 3D universe where orbiting planets stand in for the projects in your knowledge graph.",
};

/**
 * /universe — full-screen immersive 3D experience.
 *
 * The heavy WebGL bundle is loaded client-side only (see
 * `sections/universe`), so this Server Component stays tiny and the route
 * streams a boot screen immediately.
 */
export default function UniversePage() {
  return (
    <main id="main" className="bg-void fixed inset-0">
      <UniverseExperience />
    </main>
  );
}
