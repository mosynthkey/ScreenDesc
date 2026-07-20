# Agent guidelines

## Comments

- Prefer **no comment** when names and types already explain the code.
- When a comment is needed, write it in **English**, briefly (one line when possible).
- Comment only non-obvious intent: constraints, trade-offs, workarounds, or invariants that the code alone does not show.
- Do not restate what the next few lines do. Do not leave outdated comments; update or delete them with the code.
- GUI copy and user-facing error messages may stay in Japanese; code comments should not.

## Style notes

- Match existing patterns in nearby files.
- Prefer clear iterator names (`sampleIndex`, `channelIndex`) over `i` / `j`.
