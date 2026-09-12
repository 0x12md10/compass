# v3/BUILD_PLAN.md — Compass Rebrand, Product Shell & Marketing Site: Phased Build Plan

Read `v3/SCOPE.md` first. Same conventions as root/`v2` `BUILD_PLAN.md`: work top to bottom, update the status table as you go, add a line under "Flagged for Abishek" instead of quietly building something on the cut list, log material plan changes at the bottom.

## Status tracker

| Ticket | Name | Status | Notes |
|---|---|---|---|
| P1 | Design tokens + app shell | Done | Palette tokens added to `globals.css` as CSS custom properties + Tailwind `@theme inline` mappings, light/dark variants. `AppShell`/`TopNav` built in `frontend/src/components/shell/`. Verified via `npm run build`. Palette swapped mid-review (round 2, see log) — token *names* (`--color-indigo`, `--accent`, etc.) stayed stable so this was a values-only edit, no component changes needed. |
| P2 | Dashboard-as-home relocation | Done | Dashboard moved to `/` (wrapped in `AppShell`), v1 ask-bar moved to `/ask` (restyled with tokens, behavior unchanged), `/dashboard` now a server-side redirect to `/`. Verified via `npm run build` — all 3 routes compile. |
| P3 | Compass rebrand (naming + avatar) | Done | All "Milo" references renamed to "Compass" (grep-verified zero hits in `frontend/`). Avatar switched from hand-drawn SVG (3 rounds of iteration, kept in the Compass Mascot artifact for history) to a Gemini/Nano-Banana-generated hero PNG (`frontend/public/mascot/compass-idle.png`, source at `docs/assets/mascot/compass-source-nanobanana.png`), animated purely with CSS (`CompassAvatar.tsx` + `globals.css` `--animate-compass-*` keyframes) — float/tilt/bounce per idle/thinking/talking, no per-state artwork. Wired into `MascotToggleButton` and `MascotPanel` (state derived from existing `loading`/`result`, no new state machine). Visually verified via Playwright screenshots of the toggle button and panel in the idle and thinking states (dashboard, thinking-badge spinner both confirmed rendering correctly); the talking state's CSS path is code-verified but not screenshot-confirmed since no backend was running in this pass to produce a real answer — worth a quick look once the backend's up. `npm run build` clean throughout. |
| P4 | Compass full-page chat UI (`/compass`) | Done | New route, chronological multi-turn conversation (frontend-state array of turns, each still one independent `/ask` call — no chaining). User bubbles right-aligned, Compass-avatar-fronted assistant cards left-aligned, reusing `ChartRenderer`/SQL-toggle/refusal styling unmodified. Empty state reuses the example-prompt pattern from `/ask`. Header avatar and per-turn avatar both derive state from existing `loading`/turn-status, same pattern as P3's `MascotPanel`. "Ask Compass" added to nav. Visually verified via Playwright (empty state, sent question, loading state) — talking/refusal states are code-verified but not screenshot-confirmed, same backend-not-running caveat as P3. `npm run build` clean. Guardrail re-check (adversarial question through `/compass`) still pending a real backend — flagged below. |
| P5 | Dashboard visual overhaul (Figma reference) | Done | Ran the `dataviz` skill's procedure rather than eyeballing colors: single chart accent (`--chart-series-1`, tokenized light/dark) for ranking/magnitude bars and the revenue/signup line charts (now gradient-filled area charts); the fixed, never-themed status palette from the skill's own reference (`good`/`warning`/`critical`) applied only where a category IS a status — Customers by Status and Ticket Volume — via `statusColors.ts`. Validated the status set with `scripts/validate_palette.js`: it fails the CVD adjacent-pair check (expected for a red/green pair — this is exactly why the skill requires the icon+label mitigation), which is satisfied here since every bar's x-axis category name is always a visible direct label, never color-alone. Point-in-time stat tiles (MRR, overdue rate) got the "hero number" treatment per the skill's own component guidance. Every remaining hardcoded hex in `charts/`/`dashboard/` replaced with the v3 CSS tokens. Visually verified with Playwright at desktop light, desktop dark, and phone (390px) widths — caught and removed an inconsistently-rendering `LabelList` (worked on some bar charts, not others) rather than ship the inconsistency; the x-axis category labels already satisfy the relief rule so it wasn't needed anyway. `npm run build` clean. |
| P6 | Marketing landing page (`/landing`) | Done | Built with the `landing` skill's intake answered from established v3 context (product/pitch, business-buyer audience, our palette, professional tone) rather than re-asking. Single self-contained `public/landing.html` (Inter, GSAP + ScrollTrigger, hero/features/trust-strip/closing-cta, mouse parallax, floating shapes) served at exactly `/landing` via a route handler (`app/landing/route.ts`) reading the static file, so the marketing page stays visually independent from the app shell. Passed the skill's own `html_validator.py` clean. Copy cross-checked against v1/v2/v3 SCOPE docs' actual feature set, not overclaimed. **Found and fixed two real bugs, not just styled it:** (1) the Nano-Banana mascot PNG had a fully opaque alpha channel (confirmed via pixel inspection) with a checkerboard pattern baked into the RGB data — a hallucinated-transparency artifact, not real transparency — fixed with a border-flood-fill chroma-key (safer than a color threshold; won't eat the character's own light-colored eyes/face) and re-cropped; same corrected asset now used everywhere (toggle button, panel, `/compass`, landing hero). (2) The feature cards, trust panel, and closing CTA were scroll-gated at `opacity:0` via ScrollTrigger and stayed invisible in a full-page capture with no real scroll — the classic "content parked at opacity:0 waiting on an observer" anti-pattern, and a real risk for any user whose layout shifts after ScrollTrigger's initial calculation (late-loading images/fonts). Fixed with a `ScrollTrigger.refresh()` on window load plus a hard timeout fallback that forces anything still hidden to visible — verified both the real-scroll reveal and the no-scroll fallback path separately. `npm run build` clean. |
| P7 | Docs update | Done | New `docs/modules/compass.md` covers all of P1-P6 (shell, rebrand+avatar, `/compass`, dashboard overhaul, `/landing`) plus both real bugs found along the way, cross-linked from `docs/ARCHITECTURE.md` and `docs/README.md` (also fixed a stale "D4 frontend pending" line there — D4 was done back in v2). `docs/modules/mascot-analyst.md` header updated to point forward to `compass.md` rather than being silently superseded. Root `README.md`'s "demo, in two parts" became "in four parts" (dashboard-as-home, Compass, classic ask, landing). |

Status values: `Not started`, `In progress`, `Blocked (reason)`, `Done`.

---

## P1 — Design tokens + app shell

**Why:** Everything downstream (dashboard, Compass chat, landing page) should read as one product, not three separately-styled pages. Tokens first, shell second, so later tickets consume them instead of re-deciding colors.

**Tasks:**
- Define the palette as CSS custom properties in `globals.css`: Deep Indigo `#2C2A72`, Soft Violet `#8C7AE6`, Liquid Silver `#D9DCE3`, plus derived surface/text/border tokens for light and dark mode.
- Build an `AppShell`/`TopNav` component: product name/logo, primary nav (Dashboard now; Ask Compass and Classic Ask added as their routes land in P4/P2).
- Wrap the dashboard route in the shell.

**Acceptance criteria:**
- Palette tokens defined once, referenced (not re-typed as raw hex) by the shell.
- Nav renders on the dashboard route with an active-link state.
- No visual regression to existing dashboard tile functionality (data still loads, filters still work).

---

## P2 — Dashboard-as-home relocation

**Why:** Abishek: "dashboard should be our main page." Structural move, not a rebuild — reuses already-verified D1/D2 components.

**Tasks:**
- Move dashboard content from `/dashboard` to `/` (root), inside the P1 shell.
- Relocate v1's ask-bar page from `/` to `/ask`, unchanged in behavior.
- Add a `/dashboard` → `/` redirect so no existing links/bookmarks 404.
- Add "Classic Ask" nav link to `/ask`.

**Acceptance criteria:**
- `/` renders the dashboard with the shell; `/ask` renders the original v1 UI unmodified in behavior.
- `/dashboard` redirects to `/`.

---

## P3 — Compass rebrand (naming + avatar)

**Why:** Do the rename once, early — `MascotContext`/`MascotPanel`/`AskAiButton`/`MascotToggleButton` all reference "Milo" and would otherwise need touching twice (once now, once when the avatar is built).

**Tasks:**
- Rename all "Milo" references (component copy, aria-labels, docs) to "Compass".
- Replace the plain letter-circle `MascotToggleButton` with an animated Compass avatar component (SVG/CSS, Framer Motion) with distinct idle / thinking / talking visual states, driven by the existing `loading`/`isOpen` state already in `MascotContext`/`MascotPanel`.
- Restyle the floating widget and toggle button with the P1 palette tokens.

**Acceptance criteria:**
- No "Milo" string remains anywhere in `frontend/`.
- Avatar visibly animates differently between idle, loading ("thinking"), and a result being shown ("talking"), without changing any request/response behavior.
- Guardrail behavior unchanged — this is a presentation-only change (re-run one of D5's adversarial spot-checks after, per v2 SCOPE.md §7's "never weaken guardrails" invariant — presentation tickets included, just to confirm nothing in the rename touched request logic).

---

## P4 — Compass full-page chat UI (`/compass`)

**Why:** Abishek asked for a Claude-like full chat experience in addition to the floating widget.

**Tasks:**
- New route `/compass`: message list (user/assistant turns), composer input, per-assistant-message rendering of explanation/chart/SQL (reusing `ChartRenderer`, not rebuilding it).
- Frontend-only conversation state (array of turns) — each turn is still an independent `/ask` call; no backend change, no multi-step chaining.
- Add "Ask Compass" nav link.
- Empty state and example prompts, in the spirit of the existing ask-bar's `EXAMPLE_QUESTIONS`.

**Acceptance criteria:**
- A user can ask multiple questions in sequence and see them stack as a conversation.
- Refusal/error states render in-line per message, same guardrail copy as the floating widget/ask bar.
- Verified: an adversarial question inside `/compass` is refused identically to the ask bar/floating widget (same D5-style spot-check as P3).

---

## P5 — Dashboard visual overhaul (Figma reference)

**Why:** Make the dashboard look like the referenced real business dashboard (Abishek's Figma link) rather than a grid of bordered boxes.

**Tasks:**
- Re-run the `dataviz` skill's guidance against the existing tile set before changing chart colors/marks.
- Rework KPI-row hierarchy (point-in-time stats emphasized, e.g. larger stat tiles at top) and card density/spacing per the Figma reference's structure.
- Apply P1 palette tokens throughout (replace the hardcoded `#2a78d6` accent, etc.).

**Acceptance criteria:**
- All 8 existing tiles still render the same underlying data (no data-layer changes — presentation only).
- Visually reviewed at laptop and phone width (per v2 D2's standing "actually look at it" discipline).

---

## P6 — Marketing landing page (`/landing`)

**Why:** A public-facing page that sells the product, per Abishek's ask — built last so it can honestly show off a finished-looking product.

**Tasks:**
- Use the `landing` skill's intake (product/pitch, audience, tone) before writing copy.
- Hero section featuring the Compass avatar (reuse the P3 component) with motion.
- Feature sections covering: the dashboard, the guardrailed NL→SQL engine, Compass as an AI analyst.
- CTA linking into `/` (the dashboard).

**Acceptance criteria:**
- Self-contained, responsive, animated landing page at `/landing` using the P1 palette.
- No functional claims made that the product doesn't actually do (cross-check copy against `v1`/`v2` SCOPE docs' actual feature set).

---

## P7 — Docs update

**Tasks:**
- Update or replace `docs/modules/mascot-analyst.md` to reflect the Compass rename and new UI (or add `docs/modules/compass.md` and cross-link).
- Update root `README.md`'s "demo, in two parts" section to a "demo, in N parts" covering the shell/landing page.
- Cross-link from `docs/ARCHITECTURE.md`.

**Acceptance criteria:** matches `v3/SCOPE.md` §7 Definition of Done items 6.

---

## Flagged for Abishek

- ~~P3 and P4's "talking" / refusal / error visual states are code-correct... not screenshot-confirmed~~ — **resolved.** With the real backend up (`aac_postgres` Docker container + `uvicorn` + configured Groq key), live-verified through `/compass`: "What's our current MRR?" returned the correct `$246,681.00` (matching D0/D1's independently-verified figure) with working stat tile + SQL toggle, and "Delete all customers with overdue invoices" was correctly refused ("I can only provide read-only SELECT queries and cannot perform deletions.") in the same amber styling as the ask bar/floating widget. Same guardrail outcome as v2's D5, now proven through `/compass` specifically too.

## Log of changes

- 2026-09-12 (post-P7 polish): Two real fixes plus a rebrand, from Abishek's live look at the shipped app: (1) the landing hero's mascot `<img>` had hardcoded `width="600" height="600"` assuming a square image, but the actual chroma-keyed crop is 914×669 — the mismatch made the browser lay out a square box and squeeze the image into it. Fixed by correcting the attributes to the real dimensions. (2) **Product renamed from "AI Analytics Copilot" to Compass** — the mascot's name now doubles as the product name (Abishek's choice from 4 options). New abstract logomark (`CompassLogo.tsx` — a ring + needle glyph, deliberately distinct from the illustrated mascot: one is chrome, one is a character) replacing the plain "AI" letter badge in the nav and landing topbar. Renamed through `layout.tsx` metadata, `TopNav`, `landing.html` (title/meta/topbar/copy — reworded a few spots that would otherwise have said "Compass ... with Compass"), root `README.md`, and `docs/ARCHITECTURE.md`'s title.

- 2026-09-12: Palette replaced mid-review (round 2): Soft Periwinkle `#9381FF` / Periwinkle `#B8B8FF` / Ghost White `#F8F7FF` / Antique White `#FFEEDD` / Peach Fuzz `#FFD8BE`, superseding the round-1 Deep Indigo/Soft Violet/Liquid Silver set. Propagated into `frontend/src/app/globals.css` (values only — token names unchanged, so P1/P2's shell/dashboard/ask-page components needed no edits) and into the Compass mascot artifact under review for P3. See `v3/SCOPE.md` §3 for the full mapping and the one derived tone (`#2E2A5C` ink, not in the given set).
- 2026-09-12: v3 initiative created per Abishek's request (landing page, Compass mascot rebrand + animated avatar, dashboard-as-home with nav shell, full-page Claude-like Compass chat + floating widget, senior-UX palette/design pass). Palette (`#2C2A72` / `#8C7AE6` / `#D9DCE3`), pseudo-2D/CSS mascot (not WebGL 3D), and build order confirmed with Abishek before starting.
