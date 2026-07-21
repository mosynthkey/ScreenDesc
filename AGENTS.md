# Agent guidelines

## Comments

- Prefer **no comment** when names and types already explain the code.
- When a comment is needed, write it in **English**, briefly (one line when possible).
- Comment only non-obvious intent: constraints, trade-offs, workarounds, or invariants that the code alone does not show.
- Do not restate what the next few lines do. Do not leave outdated comments; update or delete them with the code.

## GUI copy (l10n)

- Do not hardcode user-facing strings in Vue templates or UI helpers.
- Add English source text in `src/i18n/messages/en.ts`, and the Japanese translation in `src/i18n/messages/ja.ts`.
- Read strings with `t('key')` / `useI18n()` (or helpers in `src/i18n/labels.ts`).
- Keep message keys stable; prefer dotted names (`button.export`, `error.projectLoadFailed`).

## Style notes

- Match existing patterns in nearby files.
- Prefer clear iterator names (`sampleIndex`, `channelIndex`) over `i` / `j`.
