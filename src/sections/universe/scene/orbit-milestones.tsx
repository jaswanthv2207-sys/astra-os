"use client";

import * as React from "react";
import { Html } from "@react-three/drei";
import type { Group } from "three";

import { type Project } from "@/data";
import { useTimeline } from "@/hooks/use-timeline";
import { cn } from "@/lib/utils";

import { arrivalOf, formatTimelineDate, timelineEngaged } from "../timeline";
import { labelPortalRef } from "./label-overlay";

/* ────────────────────────────────────────────────────────────────────────── *
 * OrbitMilestones — a world's ship milestones strung along its orbital path.
 *
 * While the knowledge timeline is travelling (played or scrubbed off the
 * present — `timelineEngaged`), each milestone lights up as a small diamond
 * riding the very ellipse its planet travels: filled + glowing with the
 * world's atmosphere once the viewed date has passed it, a ghost outline
 * until then. They mount into the same rotating `pivot` frame as the planet,
 * so they orbit together at a fixed angular offset — beads on the path, not
 * decals glued to the screen.
 *
 *   - `OrbitingPlanet` writes the ring group's scale each frame so markers
 *     track `radiusFactorAt` exactly (a young world circles further out, and
 *     its milestones tighten inward with it);
 *   - hover/focus raises a glass tooltip (label · date · state); clicking a
 *     reachable milestone travels the timeline to its date (future
 *     milestones are disabled — you can't time-travel past the present);
 *   - the component is a leaf subscriber of the timeline store, so only this
 *     world's markers re-render while the bar is scrubbed — never the
 *     planet, its materials, or the scene;
 *   - at rest nothing renders (no DOM, no projection cost), keeping a
 *     timeline-less universe byte-for-byte untouched.
 * ────────────────────────────────────────────────────────────────────────── */

export function OrbitMilestones({
  project,
  radius,
  ringRef,
}: {
  project: Project;
  radius: number;
  /** Scale target written per-frame by `OrbitingPlanet`'s useFrame. */
  ringRef: React.RefObject<Group | null>;
}) {
  const { date, now, setDate } = useTimeline();
  const [hovered, setHovered] = React.useState<string | null>(null);

  const milestones = project.timeline;
  const engaged = timelineEngaged(date, now);
  const born = arrivalOf(date, project);

  /* Hooks stay above the early return; everything below is derived data. */
  if (!engaged || born <= 0.02 || milestones.length === 0) return null;

  const { atmosphere } = project.planet;
  const count = milestones.length;

  return (
    <group ref={ringRef}>
      {milestones.map((milestone, index) => {
        const at = Date.parse(milestone.date);
        if (Number.isNaN(at)) return null;
        const done = at <= date;
        const future = at > now;
        const key = `${milestone.label}-${index}`;
        const shown = hovered === key;
        /* Spread the beads evenly around the ellipse, offset from the
           planet's slot at angle 0 so no marker ever hides inside it. */
        const angle = ((index + 1) / (count + 1)) * Math.PI * 2;

        return (
          <Html
            key={key}
            position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
            center
            pointerEvents="auto"
            zIndexRange={[8, 8]}
            className="pointer-events-auto"
            portal={labelPortalRef}
          >
            <button
              type="button"
              data-orbit-milestone=""
              aria-label={`${project.name} milestone: ${milestone.label}, ${formatTimelineDate(at)}, ${done ? "shipped" : "upcoming"}${future ? " (beyond the present)" : ""}`}
              disabled={future}
              onClick={() => setDate(Math.min(at, now))}
              onPointerEnter={() => setHovered(key)}
              onPointerLeave={() =>
                setHovered((current) => (current === key ? null : current))
              }
              onFocus={() => setHovered(key)}
              onBlur={() =>
                setHovered((current) => (current === key ? null : current))
              }
              style={{
                animation: "var(--animate-milestone-pop)",
                animationDelay: `${index * 70}ms`,
              }}
              className={cn(
                /* -m-2/p-2 keeps a 24px hit target around the 8px bead
                   without stealing much of the orbit lane from the planet. */
                "group/ms relative -m-2 flex items-center justify-center rounded-full p-2",
                "focus-visible:ring-aura-violet/70 focus-visible:ring-2 focus-visible:outline-none",
                future ? "cursor-default" : "cursor-pointer",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block size-2 rotate-45 rounded-[2px] transition-all duration-200",
                  "group-hover/ms:scale-125 group-focus-visible/ms:scale-125",
                  done
                    ? ""
                    : "border border-white/40 bg-black/55 backdrop-blur-sm",
                )}
                style={
                  done
                    ? {
                        backgroundColor: atmosphere,
                        boxShadow: `0 0 9px ${atmosphere}`,
                      }
                    : undefined
                }
              />
              {shown && (
                <span
                  className="glass holo-label text-ink text-micro pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 rounded-full px-2 py-0.5 font-mono whitespace-nowrap"
                  style={{ transition: "opacity 0.2s var(--ease-out-expo)" }}
                >
                  {milestone.label}
                  <span className="text-ink-muted">
                    {" · "}
                    {formatTimelineDate(at)}
                  </span>
                  <span
                    className={done ? "text-ink-secondary" : "text-ink-muted"}
                  >
                    {" · "}
                    {done ? "shipped" : "upcoming"}
                  </span>
                </span>
              )}
            </button>
          </Html>
        );
      })}
    </group>
  );
}
