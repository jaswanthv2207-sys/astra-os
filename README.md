# Astra OS

A cinematic, workspace-driven "universe manager" built with Next.js 15 (App
Router), TypeScript, Tailwind, Framer Motion and three.js. Every project in
your workspace becomes a world in a seeded solar system — browse it, focus
it, time-travel through its history, and ask Astra about it.

- `/` — cinematic landing (Launch Universe warp into `/universe`)
- `/universes` — Universe Manager: folders, search, cards, import/export,
  stats, notifications
- `/universe` — immersive 3D experience: scene, HUD, Astra assistant,
  dossier, timeline, minimap, insights
- `/shortcuts` — keyboard reference + guided tour
- `/design-system`, `/components` — live style guide and component gallery

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Production: `npm run build && npm start`.

## Optional integrations

Everything network-facing is opt-in and layered on top of the deterministic
engines. **No key, no token, no network ⇒ the app behaves exactly as
shipped** (simulated data, local-only state, silence). Secrets are stored
in localStorage only — never exported, never synced.

Configure them in **Settings** (gear icon, `⌘K → Open settings`, or the
manager toolbar):

- **Assistant** — bring your own OpenAI/Anthropic API key; free-form asks
  then stream from the real model while recognized intents stay local.
- **GitHub** — a PAT switches the repo feed to live REST data (cached
  10 minutes).
- **Sync** — mirror `exportJson()` to a secret GitHub gist, pull it back
  with preview-and-confirm.
- **Sound** — master toggle, ambient pad and UI cues (off by default).
- **App** — install as a PWA, offline status, reset.

See [STRUCTURE.md](./STRUCTURE.md) for architecture, dependency rules and
the full script list (`npm run lint`, `typecheck`, `format:check`, `build`,
`icons`).
