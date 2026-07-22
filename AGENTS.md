# Agent guidelines

## Comments

- Prefer **no comment** when names and types already explain the code.
- When a comment is needed, write it in **English**, briefly (one line when possible).
- Comment only non-obvious intent: constraints, trade-offs, workarounds, or invariants that the code alone does not show.
- Do not restate what the next few lines do. Do not leave outdated comments; update or delete them with the code.

## GUI copy (l10n)

- Do not hardcode user-facing strings in Vue templates or UI helpers.
- Add English source text in `src/i18n/messages/en.ts`, and the Japanese translation in `src/i18n/messages/ja.ts`.
- Read strings with `t('key')` / `useI18n()`.
- Keep message keys stable; prefer dotted names (`button.export`, `error.projectLoadFailed`).

## Code layout

Keep new logic near its existing home; prefer extending these modules over growing a catch-all file.

### Project store (`src/composables/`)

- `useAnnotationStore.ts` — public API: annotation edits, style setters, export/clipboard. App imports this.
- `annotationStoreCore.ts` — shared reactive state, layout refresh, edit undo, snapshot restore.
- `projectPersistence.ts` — autosave / named-project overwrite scheduling.
- `projectImageLifecycle.ts` — load, replace, crop, section detection kickoff.
- `projectFileIO.ts` — `.screendesc.json` / bundle download and import, gallery load/save.

### Style panels (`src/components/`)

- `ProjectStyleSettings.vue` — shared/project style controls (right rail).
- `AnnotationStyleSettings.vue` — selected-annotation controls (left rail).
- Do not reintroduce a combined `StylePanel.vue` unless both rails truly need one component again.

### Canvas

- `AnnotationCanvas.vue` — pointer tools, SVG drawing, inline label edit.
- `useCanvasViewport.ts` — fit-to-width zoom, wheel/pinch/Safari gesture handling.

### Analytics

- Cloudflare Web Analytics loads when `VITE_CF_BEACON_TOKEN` is set (`src/analytics/cloudflareWebAnalytics.ts`).
- Copy `.env.example` → `.env` / `.env.production` and paste the site token from the Cloudflare dashboard.

## Style notes

- Match existing patterns in nearby files.
- Prefer clear iterator names (`sampleIndex`, `channelIndex`) over `i` / `j`.
