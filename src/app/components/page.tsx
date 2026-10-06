import type { Metadata } from "next";

import { ComponentsShowcase } from "@/sections/components-showcase";

export const metadata: Metadata = {
  title: "Components",
  description:
    "Astra OS component library — button, glass card, navbar, search bar, floating dock, badge, modal, input, tooltip, section container, skeletons and animated backgrounds.",
};

export default function ComponentsPage() {
  return <ComponentsShowcase />;
}
