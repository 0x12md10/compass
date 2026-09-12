# Module: Compass rebrand, app shell, chat UI & landing page (v3, tickets P1-P6)

Frontend-only initiative — see `v3/SCOPE.md` and `v3/BUILD_PLAN.md` for the full decision record. **No backend files changed.** Everything here is presentation/UI layered on top of the already-verified v1 ask bar and v2 dashboard-plus-mascot pipeline (`docs/modules/mascot-analyst.md`, `docs/modules/guardrails.md`).

Key files:
- `frontend/src/app/globals.css` — palette tokens, chart tokens, status-color tokens, Compass motion keyframes
- `frontend/src/components/shell/{AppShell,TopNav}.tsx` — the nav/shell every route renders inside (except `/landing`)
- `frontend/src/components/mascot/CompassMascot3D.tsx` — the real-3D mascot (React Three Fiber), replacing the earlier flat-PNG `CompassAvatar.tsx` (deleted)
- `frontend/src/app/{page.tsx, ask/page.tsx, compass/page.tsx, dashboard/page.tsx, landing/route.ts}`
- `frontend/public/{mascot/compass-idle.png, landing.html}`
- `frontend/src/components/charts/statusColors.ts`

## What changed, and why none of it reopens v2's guardrail invariant

v2's mascot ("Milo") was a single-turn, tile-anchored panel. v3 adds a full-page chat and a rename, but **every surface still calls the same `/ask` endpoint once per question** — a multi-turn *display* is not multi-step *reasoning*. See `v3/SCOPE.md` §3 for the explicit call that this doesn't reopen v2 SCOPE.md §6's "no chained AI reasoning" cut.

### Routing history: dashboard-as-home, then landing-as-home

Two rounds here, worth recording so this doesn't get silently re-litigated:

1. **First**: `/` rendered the dashboard (wrapped in `AppShell`/`TopNav`), `/dashboard` redirected to it. v1's original ask-bar UI moved to `/ask`. Reason at the time: dashboard as the product's front door, with real navigation instead of a bare page.
2. **Reversed** once the landing page (P6) existed: Abishek wanted the marketing page to be the actual root. `/` is now a route handler (`app/route.ts`) serving `public/landing.html` directly (no React page can share a segment with a route handler, hence `route.ts` not `page.tsx` at the root); the dashboard moved to `/dashboard` as a real page; `/landing` is kept only as a redirect to `/` so an old bookmark doesn't 404. `TopNav`'s brand mark and "Dashboard" nav item both point at `/dashboard` now, and the landing page's CTAs point at `/dashboard` instead of `/`.

`/ask` (the classic single-input UI) is unaffected by either round — still reachable by direct URL, no longer linked from the nav (removed alongside this same round of feedback, since Compass covers that job now).

### Compass rebrand — naming + avatar

Every "Milo" string became "Compass" (`MASCOT_NAME` in `MascotPanel.tsx`, aria-labels, docs).

**The mascot went through three distinct implementations before landing here**, each abandoned for a concrete reason rather than taste:
1. Hand-drawn SVG (3 rounds, visible in the review artifact from that session) — abandoned once the visual bar (soft 3D-toy shading) turned out to need a real image model, not flat vector shapes.
2. A generated flat PNG (`CompassAvatar.tsx`, one hero image faked into 3 states via CSS transforms — `--animate-compass-float/tilt/bounce`, now removed from `globals.css`). Abandoned for two reasons: (a) the generated image's alpha channel was 100% opaque everywhere — the image model had drawn a checkerboard pattern to *look* transparent instead of producing real alpha (found by reading raw pixel values, fixed at the time with a border-flood-fill chroma-key); (b) more fundamentally, a single flat image scaled/cropped to different container sizes kept losing the character's hands at small sizes (toggle button, per-message chat avatars) — a crop problem that would recur with any new flat image, not a one-off bug. The raw source is kept at `docs/assets/mascot/compass-source-nanobanana.png`.
3. **Real 3D** (`CompassMascot3D.tsx`, React Three Fiber) — Abishek's call once (2) kept losing its hands. Every part is a primitive Three.js geometry (torus ring, sphere face/eyes, cone nose, cylinder/capsule limbs) with `meshPhysicalMaterial`/`meshStandardMaterial`, lit by a small manual light rig (ambient + directional + two point lights — deliberately *not* drei's `<Environment>`, which fetches an HDRI from a remote CDN and left the whole scene blank whenever that fetch couldn't complete in this environment). Animates via `useFrame`: idle sway/bob, a talking bounce + arm wave, and a "thinking" state that spins only the nose/needle around its own base rather than the whole body — a flat torus rotated on its own Y axis passes edge-on into a near-invisible sliver partway through every turn, so the whole-body spin from the CSS-avatar days doesn't translate to real 3D. Camera framing (`position` + `fov`) and the character's vertical recenter offset were tuned by rendering and re-screenshotting until the outstretched arms/hands and legs all sit inside frame — get this wrong and it's the exact same "hands cut off" symptom as (2), just from frustum clipping instead of a 2D crop.

**The landing page's hero got the same 3D character too**, ported by hand into vanilla Three.js (`public/landing.html` is plain HTML/JS, not React, so it can't use `CompassMascot3D.tsx`'s React Three Fiber component — the geometry/materials/lighting are duplicated inline in a `<script>` at the bottom of the file, kept numerically in sync with the React version). `frontend/public/mascot/compass-idle.png` is now fully unused and was deleted; `docs/assets/mascot/compass-source-nanobanana.png` stays as historical reference only.

Two more real bugs, caught the same way as everywhere else in this project — build, screenshot, don't assume:
- The `three.js` CDN URL was wrong on the first attempt (`.../three.js/r160/three.min.js`, a version-string format that doesn't exist on cdnjs) — a 404 that produced *no* console error and no visible failure, just a silently blank stage, because the `typeof THREE === "undefined"` guard treated a failed CDN load identically to "library not needed here." Fixed the URL (`.../three.js/0.160.0/three.min.js`) and turned the guard into a loud `console.error` so this doesn't silently regress again.
- The `<canvas>` briefly appeared to overflow its rounded stage container — actually a false alarm once measured (`boundingBox()` showed the canvas exactly matching its container); what looked like overflow was the character's raised hands rendering close enough to the frame edge to visually collide with the "Live · MRR" badge text sitting a few pixels above the stage's edge. Fixed by pulling the camera back (`z: 8 → 9.5` in both the React and vanilla versions) for more headroom, not by touching the (correct) layout.

Camera position/FOV are duplicated across `CompassMascot3D.tsx` and `landing.html` — if one changes, check whether the other needs the same adjustment for visual consistency.

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
- **Change the 3D mascot's shape/pose/materials**: edit the primitive geometries directly in `CompassMascot3D.tsx`'s `Character` component — there's no external asset to swap. If you reposition a limb, re-check it's still inside the camera frustum at the size(s) it's actually rendered at (toggle button 56px, panel header 40px, chat composer 28px, chat empty-state hero 96px) — this is the same "hands go missing" failure mode as the old PNG, just caused by frustum clipping instead of a bad crop.
- **Add a new animation state**: extend the `useFrame` callback's `if (state === ...)` branches. Keep whole-body rotations to small oscillations, not continuous spins — the ring/face is a flat disc and a continuous Y-axis spin passes edge-on into a near-invisible sliver partway through every rotation (this is why "thinking" spins the nose/needle, not the body).
- **Change the landing page's 3D mascot**: it's the vanilla-Three.js block near the bottom of `public/landing.html`'s `<script>` — geometry/pose changes made in `CompassMascot3D.tsx` need to be hand-ported here too (there's no shared module between the React app and this static file).
- **Add a new nav route**: `frontend/src/components/shell/TopNav.tsx`'s `NAV_ITEMS`.
- **Change the palette**: edit only the five `--color-*` values at the top of `globals.css` — everything else derives from them.
- **Add a chart that needs status coloring**: extend `statusColors.ts` rather than inventing a new color scheme; keep the category's text label visible (it's the accessibility mitigation).
