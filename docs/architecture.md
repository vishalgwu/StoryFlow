# Initial architecture decision

## Scope

Phase 0 and a small Phase 1 slice: edit and save one draft, validate imports, undo edits, and prevent delayed generation from overwriting newer text. The PDF remains the broader specification; this slice does not implement its full revision graph or review system.

## Decision

Use buildless HTML/CSS and browser-native JavaScript modules, IndexedDB transactions, and Node.js 22+ built-in development and test tools. There are no external runtime dependencies or model downloads. A framework can be reconsidered when interaction complexity warrants it.

## Boundaries

- `domain.js` owns schema validation, stable paragraph IDs, reversible editing, and monotonically advancing editor ownership. Validation completes before mutation.
- `storage.js` stores a validated snapshot in a single IndexedDB transaction. The UI serializes saves, reports success only after transaction completion, and protects unreadable stored data from automatic replacement.
- `generation.js` captures operation, project, branch, revision, and session epoch. Canceled, superseded, or stale operations cannot commit. The single branch ID is groundwork, not an implemented branching UI.
- `app.js` connects user actions to those services. Story and generated text are rendered with text/value properties, never interpreted as HTML.
- `server.mjs` binds only to loopback and allowlists public application files. Git metadata and project documents are not served.

## Recovery and privacy

The draft auto-saves after 500 ms of inactivity. Saves are serialized, and the saved indicator corresponds to the current editor epoch. A failed save keeps the draft in memory with an export option and an unsaved-navigation warning. Undo state is session-only. Interrupted fixture output is kept separately in memory and can be downloaded. Browser eviction, cross-tab coordination, and persistent run recovery are not solved in this slice.

Imports enforce a versioned, bounded schema and reject unknown fields, null paragraphs, duplicate IDs, and oversized text before any mutation. Import replacement is confirmed and undoable. Importing does not execute story content or set credentials. There are no credentials or remote inference requests in this implementation.

## Next milestone

Expand editor integrity with persistent revision history, draft editing ergonomics, and reload recovery for partial generations before implementing the branch explorer. Add a real provider only behind the same operation-ownership contract and deterministic failure fixtures. No backend is needed for the current slice.
