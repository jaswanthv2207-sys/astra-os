/**
 * Shared presentational components (app-wide reuse).
 *
 * Structure:
 *   components/ui/      – primitives (button, input, modal, tooltip, …)
 *   components/layout/  – shell pieces (navbar, sidebar, footer)
 *   components/shared/  – composable feature-agnostic widgets (reveal, backgrounds)
 *
 * Feature-specific components belong in `src/<feature>` or `src/sections`.
 * Interactive modules are marked `"use client"` at their own file top; when a
 * Server Component imports this barrel React turns them into client
 * references automatically, so the barrel stays safe in either context.
 */
export * from "./ui";
export * from "./layout";
export * from "./shared";
