# Module: Compass rebrand, app shell, chat UI & landing page (v3, tickets P1-P6)

Frontend-only initiative — see `v3/SCOPE.md` and `v3/BUILD_PLAN.md` for the full decision record. **No backend files changed.** Everything here is presentation/UI layered on top of the already-verified v1 ask bar and v2 dashboard-plus-mascot pipeline (`docs/modules/mascot-analyst.md`, `docs/modules/guardrails.md`).

Key files:
- `frontend/src/app/globals.css` — palette tokens, chart tokens, status-color tokens, Compass motion keyframes
- `frontend/src/components/shell/{AppShell,TopNav}.tsx` — the nav/shell every route renders inside (except `/landing`)
- `frontend/src/components/mascot/CompassAvatar.tsx` — the mascot's single hero image, animated per state
- `frontend/src/app/{page.tsx, ask/page.tsx, compass/page.tsx, dashboard/page.tsx, landing/route.ts}`
- `frontend/public/{mascot/compass-idle.png, landing.html}`
- `frontend/src/components/charts/statusColors.ts`

## What changed, and why none of it reopens v2's guardrail invariant

v2's mascot ("Milo") was a single-turn, tile-anchored panel. v3 adds a full-page chat and a rename, but **every surface still calls the same `/ask` endpoint once per question** — a multi-turn *display* is not multi-step *reasoning*. See `v3/SCOPE.md` §3 for the explicit call that this doesn't reopen v2 SCOPE.md §6's "no chained AI reasoning" cut.

### Dashboard is now the home route

`/` renders what used to live at `/dashboard` (now a redirect to `/`), wrapped in `AppShell`/`TopNav`. v1's original ask-bar UI moved to `/ask`, unchanged in behavior. Reason: Abishek wanted the dashboard to be the product's front door, with real navigation instead of being one of several bare pages.

### Compass rebrand — naming + avatar

Every "Milo" string became "Compass" (`MASCOT_NAME` in `MascotPanel.tsx`, aria-labels, docs). The plain letter-circle toggle button was replaced by `CompassAvatar`, which renders **one static hero image** (`public/mascot/compass-idle.png`) and fakes three states — `idle` / `thinking` / `talking` — with pure CSS transforms (`--animate-compass-float/tilt/bounce` in `globals.css`), driven off state that already existed (`loading` and whether a `result` is present) rather than a new state machine. No separate artwork per state; a small spinner badge overlays the avatar for `thinking`.

**The mascot artwork went through several iterations before landing here** — hand-drawn SVG attempts (3 rounds, visible in the review artifact from that session) were superseded by an actual generated image once the visual bar (soft 3D-toy shading) turned out to need a real image model, not flat vector shapes.

**A real bug was caught and fixed in that asset**: the generated PNG's alpha channel was 100% opaque everywhere (confirmed by reading raw pixel values, not assumed) — the image model had drawn a checkerboard pattern to *look* transparent instead of producing real alpha. Fixed with a border-flood-fill chroma-key (walks in from the image edges, only clearing background-colored pixels reachable from the border, so it can't accidentally erase the character's own light-colored eyes/face the way a flat color threshold would) and re-cropped tight. The corrected file is what ships; the raw source is kept at `docs/assets/mascot/compass-source-nanobanana.png` for reference.

### `/compass` — full-page chat

A new route: chronological multi-turn conversation, user bubbles right-aligned, Compass-fronted assistant cards left-aligned, reusing `ChartRenderer` and the SQL-toggle/refusal styling unmodified from the floating panel. Turn state (`{id, question, status, response?}`) lives in `useState` — no persistence, matching v1/v2's no-accounts posture. Empty state reuses the example-prompt pattern from `/ask`.

### Dashboard visual overhaul

Ran through the `dataviz` skill's actual procedure rather than eyeballing colors:
- One tokenized chart accent (`--chart-series-1`) for magnitude/ranking charts (bar rankings, revenue/signup trends — now gradient-filled area charts, not plain lines).
- The **fixed, never-themed status palette** from the skill's own reference (good/warning/critical) applied only where a category genuinely *is* a status — Customers by Status, Support Ticket Volume — via `statusColors.ts`. The validator script flags this pairing on the CVD adjacent-pair check (expected for a red/green pair); the skill's own mitigation — a visible text label, never color alone — is satisfied because each bar's x-axis category name is always shown.
- Point-in-time stat tiles (MRR, overdue rate) got the "hero number" treatment.
- Every hardcoded hex left over from v1/v2 in `components/charts/` and `components/dashboard/` was replaced with the v3 tokens.
- An inconsistently-rendering Recharts `LabelList` (worked on some bar charts, not others) was found during screenshot verification and removed rather than shipped — the x-axis labels already satisfy the accessibility relief rule, so it wasn't needed.

### `/landing` — marketing page

Built with the `landing` skill (single self-contained HTML file, GSAP + ScrollTrigger, ships as `public/landing.html`), served at exactly `/landing` by a route handler (`app/landing/route.ts`) that reads the static file — kept visually independent from the app shell on purpose, matching how real marketing pages usually differ from the product chrome.

**A second real bug was caught here**: the feature cards, trust strip, and closing CTA were scroll-gated at `opacity: 0` via `ScrollTrigger`, and stayed invisible in a full-page capture with no real scroll — a live version of the "content parked at opacity:0 waiting on an observer" failure mode, and a genuine risk for any real visitor if late-loading fonts/images shifted layout after ScrollTrigger's first calculation. Fixed with `ScrollTrigger.refresh()` on `window.load` plus a hard timeout fallback that forces anything still hidden to become visible. Verified both the real-scroll reveal and the no-scroll fallback path separately, not just one or the other.

### Palette

Defined once as CSS custom properties in `globals.css` (`--color-periwinkle-soft`, `--color-periwinkle`, `--color-ghost-white`, `--color-antique-white`, `--color-peach-fuzz`, plus a derived ink `#2E2A5C` not in the original five hex values — needed for text/silhouette contrast). Every component reads role-based aliases (`--accent`, `--accent-strong`, `--foreground`, etc.), not raw hex, which is what made a full palette swap mid-build (round 1 → round 2, logged in `v3/BUILD_PLAN.md`) a values-only edit with zero component changes.

## Verification note (be aware of this gap)

Every screenshot-verified pass in this initiative ran **without a live backend** (no LLM/DB configured in the build environment). The `thinking` state, loading spinners, and refusal/error styling are code-correct — they're the same rendering paths already proven live in v2 — but the `talking` state and a real answer flowing through `/compass` were not screenshot-confirmed in this session. **v2's D5-style guardrail re-check (one adversarial question through `/compass` specifically) is still owed** — see "Flagged for Abishek" in `v3/BUILD_PLAN.md`.

## If you need to change something here

- **Change Compass's name or copy**: `MASCOT_NAME` in `MascotPanel.tsx`; the chat page's copy lives directly in `compass/page.tsx`.
- **Replace the mascot artwork**: swap `public/mascot/compass-idle.png` — `CompassAvatar.tsx` doesn't care what's in it, only that it's transparent. Check alpha before shipping a new one (see the bug above) — don't assume a "transparent background" request produced real alpha.
- **Add a new nav route**: `frontend/src/components/shell/TopNav.tsx`'s `NAV_ITEMS`.
- **Change the palette**: edit only the five `--color-*` values at the top of `globals.css` — everything else derives from them.
- **Add a chart that needs status coloring**: extend `statusColors.ts` rather than inventing a new color scheme; keep the category's text label visible (it's the accessibility mitigation).
