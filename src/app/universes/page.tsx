import type { Metadata } from "next";

import { UniverseManager } from "@/sections/manager";

export const metadata: Metadata = {
  title: {
    absolute: "Universe Manager — Astra OS",
  },
  description:
    "Every universe in your Astra workspace — create, organise, search and open them, each one its own procedural solar system.",
};

/**
 * /universes — the persistent Universe Manager.
 *
 * Fully client-side (everything it shows lives in localStorage), so this
 * Server Component just carries the metadata and hands over.
 */
export default function UniversesPage() {
  return (
    <main id="main">
      <UniverseManager />
    </main>
  );
}
