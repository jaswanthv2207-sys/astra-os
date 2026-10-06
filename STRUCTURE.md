# Astra OS — Project Structure

Scalable, clean-architecture-inspired layout for a Next.js 15 App Router app.
All imports use the `@/*` alias → `src/*`.

```
src/
├── app/              # App Router: routes, layouts, loading/error boundaries, API routes
├── assets/           # Imported static files (images/, fonts/)
├── components/       # Shared presentational components
│   ├── ui/           #   primitives: button, badge, card, icon, input, search,
│   │                 #   modal, tooltip, dock, section, skeleton (cva + Radix)
│   ├── layout/       #   app shell: navbar, sidebar, footer
│   └── shared/       #   feature-agnostic widgets: Reveal, animated backgrounds
├── sections/         # Page-level composed blocks (landing, design-system, components showcase…)
├── hooks/            # Shared React hooks
├── stores/           # Global Zustand stores (client state)
├── services/         # Data layer — the only code that performs network I/O
│   └── api/          #   fetch client, endpoints, error types
├── lib/              # Infrastructure: query client, logger, SDK setup,
│   │                 #   cn(), icons.ts (semantic icon registry → <Icon>)
├── utils/            # Pure, framework-agnostic helpers
├── types/            # Shared TypeScript types, DTOs, enums
├── constants/        # Routes, query keys, feature flags, timings
└── data/             # Static/mock content (never secrets)
public/               # Statically served files (favicon, robots, og-images)
```

## Routes

| Route            | Purpose                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `/`              | Landing page: cinematic hero, stats, capabilities, how-it-works, waitlist CTA                               |
| `/design-system` | Live style guide: colour, type, spacing, icons, radius, shadow, motion                                      |
| `/components`    | Component gallery: every primitive with states and usage snippets                                           |
| `/universe`      | Immersive 3D experience: orbiting planets, energy beams, galaxies + HUD, Astra assistant, dossier, timeline |

The landing hero's **Launch Universe** button enters `/universe` through a
cinematic warp overlay (`components/shared/launch-transition.tsx`, phase machine
in `stores/launch-store.ts`, read via `hooks/use-launch.ts`). The WebGL scene
lives in `sections/universe/scene/` and is loaded with `ssr: false` from
`universe-experience.tsx`, so three.js never joins the landing chunk. Each scene
system (starfield, nebula, planets, connection beams, asteroid belts, dust,
galaxies, aurora, meteors, light particles, lens flares, camera) is an
isolated component that takes a single `reduced` prop and freezes itself
under `prefers-reduced-motion`.

Every project in `data/projects.ts` renders as a unique orbiting planet in
`/universe` (procedural surface shader, fresnel atmosphere, glass label), and
each `PROJECT_LINKS` pair renders as an animated neural energy beam — pulse
wavefronts, volumetric glow and particles flowing along the curve, anchored
live to both planets' world positions via `scene/planet-registry.ts`. The
drei-`<Html>` labels all mount into one stable overlay
(`scene/label-overlay.ts`) passed as their `portal`, so each label keeps a
single React root regardless of which container the events system connects —
this is what makes leaving the route exception-free.

The worlds form a **living ecosystem**, all of it driven from one per-planet
clock in `scene/planets.tsx` whose rates are derived from the planet seed
(no extra data files): every planet breathes (a ~1.5% scale swell), its
atmosphere halo and surface rim glow rise and settle (`uPulse`), one or two
tiny moons lap inclined tracks in 15–26s — a large world's second moon is
retrograde — and a satellite (hull, wing, blinking nav beacon) orbits on a
faster, steeper track. Moons and the satellite hang inside the breathing
group, so timeline growth carries them and a dissolved world (unborn at the
viewed date, or faded out of the search result set) takes its ecosystem out
of the scene with it. Beyond every system's reach,
`scene/asteroid-belt.tsx` rings ~260 tinted low-poly rocks onto the
outermost world's orbital plane — one `InstancedMesh` per centre — and the
ring rotates as a single rigid body, so continuous orbital motion costs one
`rotation.y` increment per frame instead of hundreds of matrix writes. The
glass name pills wear a `holo-label` treatment (`styles/components.css`):
scanline substrate, a light sweep that gestures once every 6.5s, a rare
hard-stepped glyph flicker and a breathing status dot — every animation
parked under `prefers-reduced-motion`.

Hovering a planet boosts its glow, spin and scale via a locally damped ref in
`scene/planets.tsx` (hover is ephemeral — it never touches the store) and
crossfades its name pill into a floating dossier (`scene/planet-card.tsx`):
AI summary, stack chips, completion bar and last-updated date, all from
`data/projects.ts`. Two contracts keep it polished: **stacking** — drei
derives each `<Html>` node's z-index from camera distance inside its
`zIndexRange`, so pills sit in band 0–6 and the card in fixed band 9, always
painting above every pill; **clamping** — the card measures its own rect
against the viewport (16px gutters, below the HUD's top rail) and eases a
corrective translate, so a drifting world near an edge never pushes the card
off-screen. Under `prefers-reduced-motion` the card appears instantly with
no transitions, and the shared `glass` utilities in
`styles/components.css` must declare `backdrop-filter` unprefixed only —
an explicit `-webkit-backdrop-filter` beside it makes the CSS pipeline drop
the unprefixed form, which Chrome ignores, silently killing every blur.

Camera control is cinematic: `scene/cinematic-camera.tsx` owns the frame until
the first gesture, then `scene/camera-rig.tsx` hands over to damped orbit
controls (rotate / pan / zoom). Clicking a planet — or its screen-reader twin
in the HUD — sets `stores/universe-store.ts` (read via
`hooks/use-universe.ts`) and the rig launches a **warp jump**: a signed
envelope over the eased arc (pre-launch charge → hyperspace cruise →
fold-back, `warpTarget()` in the rig) written to `scene/camera-state.ts` and
read per frame by the star field (every point stretches into a radial,
blue-white streak along its axis away from screen centre —
`scene/star-field.tsx`), the post chain (radial smear + chromatic fringe, the
cyan-white energy tunnel that crushes the frame's edges, and the ignition /
touchdown flashes — `scene/speed-blur.ts`), a bloom surge (`BloomDriver` in
`scene/universe-scene.tsx`) and the lens itself: the charge dips the FOV
2.7°, the cruise punches it +15°, the fold-back restores it exactly. Jumps
are distance-scaled and fast (1.0–1.6s), and a jump planned while a warp is
already warm starts mid-envelope, so rapid prev/next hops between worlds
never collapse the streaks between them; Escape warps back to the captured
view before it exits the route. Under `prefers-reduced-motion` flights cut
instead of flying, so no warp ever engages.

Selecting a world opens the **immersive project dossier**
(`project-detail-panel.tsx`) — a smoked-glass panel _beside_ the planet,
replacing a traditional modal: overview + completion, AI summary, data
statistics, technology chips, a procedural screenshot gallery (SVG art tinted
from the planet's own palette), architecture layers, ship timeline, related
worlds (each one warps the camera straight there) and quick actions. The
selected planet stays visible because focus also eases the camera's
projection **view offset** (framing constants in `camera-rig.tsx`): at
≥1024px the planet slides left to sit beside the docked panel, below that it
rises above the bottom sheet — the look-at target never moves, so orbit,
zoom, pointer picking and the drei labels all stay glued to the world.
Related worlds re-key the panel (`AnimatePresence mode="wait"`) so the camera
glide and the panel slide read as one move; under `prefers-reduced-motion`
both cut instantly. The hover card is suppressed while its world is focused.

Floating above the scene, Astra alone is the ask surface: her replies
parse natural language through the pure local layer `search-query.ts` —
tag phrases (`ai`, `hackathon`, …), per-project stack regexes that join
characters with `[\s._/-]*` so `FastAPI` matches `fast api`, recency words
(`latest`, `newest`, …), then weighted title/tag/summary text scoring with a
stopword list; structured layers combine as AND, structured results sort by
`updatedAt` desc, text hits by score then recency. An `open` verb — or
exactly one hit — resolves to _open_, everything else to _frame_.

**Reveal state** lives in `stores/search-store.ts`, read only through the
granular selectors in `hooks/use-search.ts` (Astra's panel → `useSearch()`,
shell → `useSearchClear()`, planets/beams → `useSearchMatches()`, camera →
`useSearchFrame()`). `matchedIds` drives the scene: matched planets glow to
1.15× while every other world eases to a 0.22 `uFade` (labels ghost to the
same opacity, hover cards suppress), and each beam's per-link weight eases to
0.5 per matched endpoint — so connections touching results blaze while
unrelated links recede. A frame commit plans one _reveal_ warp in
`camera-rig.tsx` — centroid of the matched set,
`distance = clamp(reach × 2.4 + 14, 26, 150)`, run over
`clamp(0.95 + travel / 160, 1.05, 1.55)`s — snapshotting the overview for the
warp back. Intent priority stays **focus → frame → overview**, each planned once
per `intentKey`. Escape ordering in `universe-experience.tsx`: the Astra
conversation closes first, then a committed results frame clears, then a
focused dossier releases, then the route exits (a timeline parked in the past
snaps to the present just before), and remounting clears any stale reveal
state.

The lower-right corner belongs to **Astra**, the OS assistant
(`universe-assistant.tsx`, imported as its own lazy `dynamic()` chunk so the
initial /universe parse stays lean — it fetches while the boot lines type
out): a gently pulsing gradient orb (halo
`animate-pulse-glow`, drifting `animate-float`, spinning dashed ring, hover
label, unread dot, waveform core while thinking) that expands into a
smoked-glass conversation panel growing from the orb's corner
(`AnimatePresence mode="wait"`; the orb's delayed first entrance lands after
the HUD settles). **Replies** come from a pure local engine
(`assistant-reply.ts`): conversational layers first — greeting, help,
identity, then world-scoped questions (`What powers X`, `Show worlds linked
to X`, `Summarise X`, with pronouns falling back to the focused world) —
before delegating universe queries to the shared `parseQuery` layer, so
every ask resolves the same way. Thinking
renders a staggered gradient **waveform** (pending bubble + header, static
under reduced motion) and swaps the status line to `reasoning…`. A reply
with a `run` executes the camera move — `focus` mirrors an open commit
(`clearFrame` + focus), `frame` mirrors a frame commit (`release`,
`setMatches`, `frame`) — then folds the panel after a readable beat so the
reveal owns the stage; action chips re-run moves later from the persisted
history. **State** lives in `stores/assistant-store.ts`, read through
`hooks/use-assistant.ts`: the shell takes `useAssistantOpen()` (so message
pushes never re-render the 3D scene) and the panel takes `useAssistant()`;
the transcript survives route visits while only `open` resets on remount.
**Contextual suggestions** under the composer swap to the focused world
(`Summarise {name}`, `What powers {name}?`, `Show worlds linked to {name}`)
and re-fade when the context changes. **Placement:** the anchor column
slides 464px left of the dossier at ≥1024px (`useMediaQuery`), the panel
folds and the orb occludes under the mobile bottom sheet, and the HUD footer
reserves the corner (`pr-20`). Escape unwinds: conversation first when focus
is inside it (or nothing else is pending), then the search query, then the
conversation, then Astra's queryless frame (`clearSearch()` resets matches +
frame ids), then focus, then the timeline's present if it is parked in the
past, then the exit — `data-astra-assistant` marks the panel for focus
detection.

The bottom-centre bar belongs to the **knowledge timeline**
(`universe-timeline.tsx`, its own lazy `dynamic()` chunk like Astra): a glass
pill whose controls time-travel the scene — play/pause, a mono date readout
plus a `n / 8 WORLDS` census, and a scrub track. Every project carries a
`createdAt`
in `data/projects.ts`; the range runs from the earliest creation — an empty
universe — to the present, clamped in `stores/timeline-store.ts` and read
through `hooks/use-timeline.ts`: the UI subscribes with `useTimeline()`,
while planets and beams pull `readTimelineDate()` inside `useFrame`, so a
60fps drag re-renders only the bar and the pills, never the canvas tree. The
track is a real ARIA slider (quarter ticks with years labelled, a glowing
creation marker per world at its birth date — decorative, since the closest
two births sit ~19px apart and 24px WCAG targets would overlap; the slider
itself owns navigation), a `NOW` reset — all of it scrubbing the entire
scene through time. The pure factors live in `timeline.ts` — a world
**arrives** over 90 days (scale
pops 0 → ~45%, orbit tightens 1.4× → 1×), then **grows** across its own
lifetime to reach full size exactly at the present, while the whole system
slowly rotates (phase offset exactly 0 at now); beams burn out until both
endpoints exist (per-vertex `aBirth` in `scene/connections.tsx`), and the
dossier's completion row reports `progressAt(date)` with the date beside it.
Every factor derives from one **damped date** per system (λ 6, snapped under
reduced motion), so dragging, keyboard steps and auto-play (a 9s full-range
sweep) read as continuous travel — reversible frame for frame. While moving,
a warp veil (radial vignette + drifting `time-drift` streaks) washes over
the scene, and each date write calls `invalidate()` so the scene answers
instantly under `frameloop="demand"`. The bar yields to the dossier and
Astra's panel (slide-out, auto-play pauses), a focused world always presents
as it does today, and Escape unwinds _into_ the present: a past timeline
snaps to now before the route exits — the remount guard resets it too.

## Dependency rules

| Layer            | May import                            | Must not import            |
| ---------------- | ------------------------------------- | -------------------------- |
| `app/`           | sections, components, services, lib   | —                          |
| `sections/`      | components, hooks, utils, types, data | stores, services directly  |
| `components/`    | hooks, utils, types, lib              | sections, stores, services |
| `stores/`        | services, types, utils                | components                 |
| `services/`      | lib, types, constants                 | components, stores, hooks  |
| `lib/`, `utils/` | types, constants                      | anything in React land     |
| `data/`          | types, constants                      | React, stores, services    |

**State rules:** server state → React Query (`services/`), global client state →
Zustand (`stores/`), local UI state → `useState`/`useReducer`.

## Scripts

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run start      # serve production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier write
```
