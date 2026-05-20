# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (hot reload)
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

No test suite, no linter configured.

## Architecture

Single-file React app (`src/App.jsx`) with no routing library. View state (`'form'` | `'history'`) is toggled via `useState` in the root `App` component — there is no React Router.

**Components (all in `src/App.jsx`):**

| Component | Role |
|---|---|
| `App` | Root. Owns all state (client info, items list, proposals, active view). |
| `Modal` | Overlay for entering quantity + price for a chosen service. Closed on backdrop click or Enter key. |
| `QuoteDoc` | The A4 quote document. Rendered **off-screen** (CSS: `left: -9999px; width: 794px`) so `html2canvas` can capture it. |
| `ProposalHistory` | Full-page history view listing saved proposals with edit/delete. |

**PDF generation flow:**
1. `QuoteDoc` is always mounted off-screen with current state.
2. On "Generate PDF", `html2canvas` captures it at `scale: 2`.
3. `jsPDF` converts the canvas to a multi-page A4 PDF and triggers download.
4. After download, the proposal is saved/updated in `localStorage` under the key `pergola_proposals`.

**Persistence:** `localStorage` only — `loadProposals()` / `persistProposals()` helpers at the top of `App.jsx`. Proposals are saved only when a PDF is exported (not on every edit).

**`SERVICES` array** (top of `App.jsx`) defines the fixed catalogue of quote line-item types. Each entry has `id`, `emoji`, `name`, `unit`, `priceLabel`, and optionally `isCustom: true`. The "custom item" (`isCustom`) lets users type a free-form name and pick their own unit.

**VAT** is hardcoded as `const VAT = 0.18` at the top of `App.jsx`.

## Key notes

- The entire app is Hebrew/RTL. The root `<html>` element has `lang="he" dir="rtl"`. All UI strings are in Hebrew.
- All styling lives in `src/index.css` — plain CSS, no modules, no Tailwind. The `.qdoc-*` CSS namespace is exclusively for the off-screen `QuoteDoc` PDF document; the rest styles the app UI.
- `better-sqlite3` and `express` appear in `package.json` dependencies but there is no backend/server code in the repo. They are currently unused.
- Deployed on Vercel. `vercel.json` just declares `buildCommand` and `outputDirectory` for the Vite build.
