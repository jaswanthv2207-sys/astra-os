"use client";

import * as React from "react";

import { Button, Navbar, SearchBar } from "@/components";

/**
 * SiteHeader — the landing page's transparent glass navigation.
 *
 * The Navbar itself is transparent over the hero and condenses into glass
 * the moment the page scrolls; this wrapper only supplies the actions:
 * a ⌘K search field and the primary conversion CTA (which anchors to the
 * waitlist form at the bottom of the page).
 */
export function SiteHeader() {
  const [query, setQuery] = React.useState("");

  return (
    <Navbar
      actions={
        <div className="flex items-center gap-2.5">
          <SearchBar
            size="sm"
            value={query}
            onValueChange={setQuery}
            onSubmit={() => undefined}
            srLabel="Search Astra OS"
            placeholder="Search Astra OS…"
            className="w-52 lg:w-64"
          />
          <Button size="sm" variant="primary" asChild>
            <a href="#waitlist">Get started</a>
          </Button>
        </div>
      }
    />
  );
}
