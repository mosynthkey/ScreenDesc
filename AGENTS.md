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

### Project store (`src/stores/` + `src/composables/`)

- `src/stores/annotationStore.ts` — the Pinia store (`useAnnotationStore`, setup-store syntax): reactive state, layout refresh, edit undo, snapshot restore, and every mutation action (selection, sections, annotations, style setters, export/clipboard). App imports this.
- `projectPersistence.ts`, `projectImageLifecycle.ts`, `projectFileIO.ts`, `projectThumbnail.ts` (`src/composables/`) — satellite composables for autosave scheduling, image load/replace/crop, `.screendesc.json`/bundle IO, and thumbnail rendering. Each exported function takes a `core: StoreCore` parameter (see the store file) instead of calling `useAnnotationStore()` itself — some of this logic runs during the store's own setup(), where the store instance doesn't exist yet.
- Consuming the store: destructure state/getters via Pinia's `storeToRefs()`; destructure actions directly (they're plain functions, unaffected by the reactivity-loss `storeToRefs` guards against). `state` itself is a stable reactive object reference, so `const { state } = store` (not routed through `storeToRefs`) is correct and keeps `state.foo` working without `.value`.

### Style panels (`src/components/`)

- `ProjectStyleSettings.vue` — shared/project style controls (right rail).
- `AnnotationStyleSettings.vue` — selected-annotation controls (left rail).
- Do not reintroduce a combined `StylePanel.vue` unless both rails truly need one component again.
- Both call `useAnnotationStore()` directly instead of taking their fields as props — every field they show is a 1:1 store read/write with no App-local UI state involved, so prop-drilling them through `App.vue` was pure ceremony. Use `toRefs(store.state)` for plain state fields and Pinia's `storeToRefs(store)` for store getters (`selectedAnnotations`, `documentWidth`, `documentHeight`, `labelPositions`); call setter/action functions straight off the store. Generic, store-agnostic components (`CropConfirmDialog`, `ExportDialog`, `FontFamilyPicker`, etc.) should keep props/emits — wiring them to the store would couple reusable components to one domain.
- `AnnotationCanvas.vue` still takes its state as props from `App.vue` (deliberately not converted): its 1500+ lines read `store.state` fields extensively inside drag/hit-test logic, and `store.state` is `readonly()` — DeepReadonly leakage into that file's internal typing was judged too high-risk for the value gained. `Toolbar.vue` similarly stayed prop-based: it mixes store fields (`toolMode`, `sectionVisibility`) with genuinely App-local state (`page`, `showToolDock`, `copyJustSucceeded`), so a partial conversion would be more confusing than the status quo.
- Pure store-derived App.vue logic with no local-UI coupling belongs on the store as an action/getter, not as an `onXxx` wrapper in `App.vue` — see `commitDescription`, `patchSelectedAnnotations`, `toggleSectionOutline`/`toggleSectionOutlineHalo`, `updateCalloutPosition`/`updateAnchorOffset`, and the `selectedAnnotations`/`documentWidth`/`documentHeight`/`labelPositions` getters in `annotationStore.ts`. Keep the wrapper in `App.vue` only when it also coordinates dialogs, file inputs, or other local UI state.

### Canvas

- `AnnotationCanvas.vue` — pointer tools, SVG drawing, inline label edit.
- `useCanvasViewport.ts` — fit-to-width zoom, wheel/pinch/Safari gesture handling.

### Analytics

- Google Analytics (gtag.js) loads when `VITE_GA_MEASUREMENT_ID` is set (`src/analytics/googleAnalytics.ts`).
- Copy `.env.example` → `.env` / `.env.production` and paste the measurement ID.

### Deploy (GitHub Pages + Release model)

- ONNX stays out of git (`public/models/*.onnx`). Store it on a GitHub Release (`model` / `screenparser.onnx`).
- PaddleOCR `.tar` models stay out of git (`public/models/paddleocr/*.tar`); fetch with `npm run fetch-ocr-model`.
- CI: tag pushes matching `v*` (or manual workflow_dispatch) run `fetch-model` + `fetch-ocr-model`, then deploy Pages.
- Local: keep a copy under `public/models/`, or run `npm run fetch-model` (needs `gh` or `MODEL_DOWNLOAD_URL`).
- Publish/update the Release asset: `./scripts/publish-model-release.sh`
- Optional secrets/vars: `VITE_GA_MEASUREMENT_ID` (secret), `BASE_PATH` (var, default `/<repo>/`).

## Style notes

- Match existing patterns in nearby files.
- Prefer clear iterator names (`sampleIndex`, `channelIndex`) over `i` / `j`.
