# v3/SCOPE.md — Compass Rebrand, Product Shell & Marketing Site (v3 initiative)

## What this document is

A **separate initiative** layered on top of v1 (NL→SQL ask bar) and v2 (business dashboard + mascot AI analyst). v1 and v2 stay scoped exactly as they were — this doc does not modify their guardrail invariants and does not compete with them for the "most protected" slot. Read `v2/SCOPE.md` first; this assumes it.

## 1. One-line pitch

"A real product shell — dashboard as home, a named AI companion (Compass) reachable everywhere, and a marketing page that sells the story — all in one cohesive design system."

## 2. Why this exists

v2 proved the dashboard-plus-contextual-AI pattern works, but it still looks like a build, not a product: no nav, no home page, an unnamed mascot ("Milo" — never actually decided, just a placeholder), and no way to show this to someone who isn't already looking at localhost. v3 turns that into something that reads as a finished app plus a public-facing pitch for it.

## 3. Decision record

- **Mascot named Compass**, replacing the placeholder "Milo" used throughout v2's mascot components. Presented as a small animated character (idle/thinking/talking states) rather than a static letter avatar.
- **Compass avatar is stylized 2D/CSS "pseudo-3D" (or an image-generated SVG), not true WebGL 3D.** Decided explicitly with Abishek: a Framer-Motion-driven SVG/CSS character gets most of the charm of a rigged 3D mascot without a Three.js dependency, WebGL performance/mobile risk, or asset-pipeline overhead. Revisit only if a future ticket specifically calls for true 3D.
- **Palette (round 2, current)**: Soft Periwinkle `#9381FF` (primary/brand), Periwinkle `#B8B8FF` (accent/secondary), Ghost White `#F8F7FF` (light surface/bg), Antique White `#FFEEDD` (warm surface), Peach Fuzz `#FFD8BE` (warm accent pop) — supplied by Abishek, replacing the round-1 set (Deep Indigo `#2C2A72` / Soft Violet `#8C7AE6` / Liquid Silver `#D9DCE3`) mid-review. Applied as CSS custom properties (`frontend/src/app/globals.css`), not hardcoded hex scattered through components — this is why the swap was a values-only edit, not a component-by-component rewrite. One derived tone not in the given set: a deep periwinkle-ink `#2E2A5C`, needed for text/silhouette contrast since the given palette has no dark value of its own.
- **Dashboard becomes the app's home route (`/`).** v1's original ask-bar demo (currently living at `/`) is relocated to `/ask` rather than deleted — it's still part of the "demo in two parts" README narrative and still exercises the same guardrailed pipeline; it just isn't the front door anymore.
- **Compass chat has two entry points, one engine**: the existing floating bottom-right widget (v2's `MascotPanel`, single-turn) stays for in-context tile questions, and a new full-page `/compass` route gives a Claude-like running conversation. Both call the same `/ask` endpoint per turn — **this does not reopen v2 SCOPE.md §6's "no multi-step/chained AI reasoning" cut**: each message is still one independent question → one validated SELECT → one answer; the chat page only changes how multiple *separate* answers are displayed (a running list) versus v2's single-result panel. No new backend surface, no new guardrail path.
- **Landing/marketing page lives at `/landing`** (not `/`), since Abishek was explicit that the dashboard is the main page. It can later become the actual public root with an "Enter Dashboard" CTA if this ever needs a real logged-out vs. logged-in split — out of scope for now, flagged below.
- **Figma reference** (Abishek-provided "Sales Dashboard Design" community file) is a layout/hierarchy reference for the dashboard overhaul ticket — informs KPI-row-then-charts structure and card density, not a pixel-for-pixel port (no Figma API access from here).

## 4. What's IN scope for v3

- A shared design-token layer (palette + spacing/typography conventions) used by the app shell, dashboard, and Compass chat.
- A top nav / app shell: product name/logo, primary navigation (Dashboard, Ask Compass, Classic Ask), consistent across routes.
- Dashboard relocated to `/`, restyled per the Figma reference and the `dataviz` skill's guidance.
- Mascot renamed Milo → Compass everywhere (frontend components, copy, docs), with a new animated avatar (idle/thinking/talking states) replacing the plain letter-circle button.
- A full-page Claude-like Compass chat UI (`/compass`): message list, composer, per-message chart/SQL rendering (reusing `ChartRenderer`), still one-question-one-answer per turn.
- A marketing landing page (`/landing`) built with the `landing` skill: hero with the Compass avatar, feature sections, CTA into the dashboard.

## 5. What's explicitly OUT of scope for v3

- **No backend changes, no new guardrail surface.** Same invariant as v2 §6 — if anything here seems to need a backend change beyond what v1/v2 already expose, that's a stop-and-flag, not something to improvise around.
- **No true WebGL/Three.js 3D mascot** unless explicitly requested later.
- **No auth / logged-in vs. logged-out split.** `/landing` is just another public route for now, not a gate in front of the dashboard.
- **No persisted chat history** (server-side conversation storage) for `/compass` — conversation state lives in frontend state for this version, same "no accounts/no persistence" posture as v1/v2.
- **No redesign of v1/v2's guardrail behavior, copy, or refusal states** — only their visual styling may change to match the new palette.

## 6. Priority order

1. Design tokens + app shell (everything else visually depends on this).
2. Dashboard-as-home relocation (structural, low risk — mostly moving existing, already-verified components).
3. Compass rebrand (naming + avatar) — touches the same components repeatedly, so do it once, early, rather than renaming twice.
4. Compass full-page chat UI (new, higher-effort surface).
5. Dashboard visual overhaul against the Figma reference (cosmetic, benefits from the shell/palette/rebrand already being in place).
6. Marketing landing page (benefits from the product actually looking finished first, and reuses the Compass avatar built in step 3).

## 7. Definition of done

1. `/` shows the dashboard inside the new app shell (top nav, branding); v1's ask bar lives at `/ask`, still functional.
2. Mascot is named and presented as Compass everywhere (no lingering "Milo" strings), with an animated avatar with at least idle/thinking/talking states.
3. `/compass` is a working multi-turn (frontend-state) chat UI, visually distinct from the floating widget but sharing the same result-rendering primitives.
4. Dashboard restyled with the new palette and improved layout hierarchy.
5. `/landing` is a polished, animated marketing page reflecting the actual product.
6. `docs/modules/compass.md` (or an update to `mascot-analyst.md`) reflects the rename and new UI; README's demo narrative updated to mention the shell/landing page.
