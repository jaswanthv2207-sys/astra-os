"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavbarProps {
  /** Brand block — rendered before the nav list. */
  logo?: React.ReactNode;
  links?: NavLink[];
  /** Right-hand actions (search, buttons, avatar). */
  actions?: React.ReactNode;
  className?: string;
}

const DEFAULT_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Design system", href: "/design-system" },
  { label: "Components", href: "/components" },
  { label: "Shortcuts", href: "/shortcuts" },
];

/**
 * Navbar — sticky, scroll-aware navigation bar.
 *
 * Micro-interactions:
 * • transparent over the hero, then gains glass + shadow the moment you scroll
 * • the active link's underline slides between items (Framer `layoutId`)
 * • mobile menu springs open with a staggered list; the toggle icon morphs
 *   between ☰ / ✕ and the button blooms on hover
 *
 * A11y:
 * • skip-to-content link as the first focusable element on the page
 * • `<header>` + `<nav aria-label="Primary">` landmarks
 * • `aria-current="page"` on the active link, `aria-expanded` /
 *   `aria-controls` / `aria-haspopup` on the menu toggle
 * • Escape closes the menu and focus returns to the toggle
 * • focus is never trapped or removed — outlines stay on-brand
 *
 * @example
 * <Navbar actions={<SearchBar … />} />
 */
export function Navbar({
  logo,
  links = DEFAULT_LINKS,
  actions,
  className,
}: NavbarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  /* Scroll state — passive listener, no reflow thrash. */
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Close the mobile panel on navigation. */
  React.useEffect(() => setOpen(false), [pathname]);

  /* Escape closes and returns focus to the toggle. */
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <a
        href="#main"
        className={cn(
          "focus:z-toast sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4",
          "focus:bg-aura-violet focus:text-on-aura focus:shadow-glow-violet focus:rounded-lg focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium",
          "focus:outline-aura-cyan focus:outline-2 focus:outline-offset-2",
        )}
      >
        Skip to content
      </a>

      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "z-sticky duration-base ease-out-expo fixed inset-x-0 top-0 transition-all",
          scrolled
            ? "border-hairline backdrop-blur-glass shadow-glass border-b bg-black/45"
            : "border-b border-transparent bg-transparent",
          className,
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4">
          {/* brand */}
          {logo ? (
            <Link
              href="/"
              aria-label="Astra OS — home"
              className="focus-visible:outline-aura-violet rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {logo}
            </Link>
          ) : (
            <Link
              href="/"
              aria-label="AstraOS — home"
              className="group focus-visible:outline-aura-violet flex items-center gap-2.5 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span
                aria-hidden="true"
                className="bg-aura shadow-glow-violet duration-base ease-out-expo size-7 rounded-lg transition-transform group-hover:scale-110 group-hover:rotate-12"
              />
              <span className="tracking-title text-ink text-sm font-semibold">
                Astra<span className="text-aura-violet-soft">OS</span>
              </span>
            </Link>
          )}

          {/* desktop nav */}
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {links.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);

                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "duration-base relative rounded-lg px-3.5 py-2 text-sm transition-colors outline-none",
                        "focus-visible:outline-aura-violet focus-visible:outline-2 focus-visible:outline-offset-2",
                        isActive
                          ? "text-ink"
                          : "text-ink-muted hover:text-ink hover:bg-white/[0.05]",
                      )}
                    >
                      {link.label}
                      {isActive && (
                        <motion.span
                          layoutId="navbar-underline"
                          aria-hidden="true"
                          className="from-aura-violet to-aura-cyan shadow-glow-dot absolute inset-x-3 -bottom-0.5 h-px bg-gradient-to-r"
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 420, damping: 34 }
                          }
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* actions + mobile toggle */}
          <div className="flex items-center gap-2.5">
            {actions && <div className="hidden sm:block">{actions}</div>}

            <button
              ref={toggleRef}
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-haspopup="true"
              aria-label={
                open ? "Close navigation menu" : "Open navigation menu"
              }
              onClick={() => setOpen((value) => !value)}
              className={cn(
                "text-ink flex size-10 items-center justify-center rounded-lg outline-none",
                "duration-base ease-out-expo transition-all",
                "hover:text-aura-violet-soft focus-visible:outline-aura-violet hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2",
                "active:scale-95 motion-reduce:transform-none",
                "md:hidden",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={open ? "close" : "menu"}
                  initial={{ opacity: 0, rotate: -45 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 45 }}
                  transition={{ duration: 0.16 }}
                  className="flex"
                >
                  {open ? (
                    <Icon name="close" size="lg" />
                  ) : (
                    <Icon name="menu" size="lg" />
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* mobile menu */}
        <AnimatePresence>
          {open && (
            <motion.nav
              id="mobile-nav"
              aria-label="Primary (mobile)"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="container-page md:hidden"
            >
              <ul className="glass rounded-glass shadow-glass mt-2 space-y-1 p-3">
                {links.map((link, index) => {
                  const isActive =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(link.href);

                  return (
                    <motion.li
                      key={link.href}
                      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * index, duration: 0.28 }}
                    >
                      <Link
                        href={link.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "duration-base flex items-center justify-between rounded-lg px-3.5 py-3 text-sm transition-colors outline-none",
                          "focus-visible:outline-aura-violet focus-visible:outline-2 focus-visible:outline-offset-2",
                          isActive
                            ? "bg-aura-violet/15 text-aura-violet-soft"
                            : "text-ink-muted hover:text-ink hover:bg-white/[0.06]",
                        )}
                      >
                        {link.label}
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="bg-aura-violet shadow-glow-dot size-1.5 rounded-full"
                          />
                        )}
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}
