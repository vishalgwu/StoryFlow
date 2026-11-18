# Architecture decision: reliable browser editor

## Scope

Phases 0 and 1: edit and recover one draft, validate imports, undo edits, and prevent obsolete generation from overwriting newer text. The PDF remains the broader specification. Its immutable revision graph, visual branches, attention anchors, memory, and continuity review are outside this milestone.

## Stack

Buildless HTML/CSS and browser-native JavaScript modules, IndexedDB transactions, Web Locks, and Node.js 22+ built-in development/test tools. There are no external runtime dependencies or model downloads. Playwright is pinned as a development-only dependency with a committed npm lockfile. A framework can be reconsidered when interaction complexity warrants it.

## Boundaries

- `domain.js` owns project validation, stable paragraph IDs, reversible editing, revision overflow checks, and monotonically advancing operation ownership. Validation completes before mutation. History is capped at 50 steps and 8 MB combined; large projects prune oldest recovery states.
- `session.js` defines a versioned internal recovery envelope containing the portable project, bounded undo/redo, one unapplied paragraph edit, and one continuation proposal. It validates recovery data and migrates the original plain project record. Portable project exports stay at schema version 1 and do not expose internal history.
- `storage.js` reads and writes the envelope transactionally at the existing `projects/active` key. Success is reported only after transaction completion. A blocked/failed open, aborted read, invalid record, quota failure, or aborted write has an explicit failure path. Unreadable data is never overwritten by startup autosave.
- `generation.js` captures operation, project, branch, revision, and editor epoch. Canceled, superseded, or stale operations cannot commit. Beginning a paragraph edit invalidates an in-flight request even before the edit is applied. The branch ID is groundwork for Phase 2, not an implemented branch explorer.
- `app.js` manages explicit paragraph Save/Cancel and the UI's unapplied working text, invokes the domain/storage services, serializes checkpoint writes, and renders story text using text/value properties. A successful older save cannot mark a newer edit as saved.
- `server.mjs` binds only to loopback and allowlists public application files. Git metadata and project documents are not served.

## Persistence and recovery

Title changes, paragraph edits, undo/redo, imports, and proposal decisions schedule a checkpoint after a 250 ms pause. Streaming output checkpoints every four chunks, with a final checkpoint on completion/failure/cancel. Generation completion and its appended prose share one snapshot so storage cannot record an applied proposal separately from its draft. Stops and stale results remain proposals; a formerly running proposal becomes interrupted on reload and requires explicit acceptance.

Paragraph text is initially read-only. Edit opens one working copy. Save applies one reversible domain change; Cancel restores its original. An unapplied copy is checkpointed independently and returns after reload. Export includes that visible copy after validation without implicitly committing it. Save draft and Ctrl/Cmd+S apply it and save immediately.

Failed writes leave the in-memory draft intact and retain an unsaved-navigation warning. Retry saving serializes behind prior writes. Successful storage recovery clears storage errors without hiding a separate generation/import error. Failed restore disables writes until reload, protecting the stored record while permitting temporary writing and export.

A same-origin Web Lock grants one tab editing ownership until it closes/navigates away. Another tab can read/export a snapshot but cannot mutate it. It must reload after the owner closes. Browsers without Web Locks open read-only. Restoring a page from the back-forward cache reloads it to reacquire ownership.

## Constraints and privacy

Imports are size-bounded, validate before replacement, require confirmation, and are undoable within retained history. Unknown fields, credentials, null paragraphs, duplicate IDs, and oversized text are rejected. Recovery data is validated separately. No story/model text is executed as markup. There are no credentials or remote model calls in this implementation.

Browser eviction and loss of the latest uncheckpointed keystroke/word remain possible. Exports are the independent backup. Stored history supports local recovery; it does not claim immutable ancestry, branching, or export of a revision tree. No hosted service is necessary for this scope.

## Next milestone

Phase 2 introduces immutable paragraph versions and revisions, branch heads/ancestry, visual/list navigation, comparison, restore records, and tree-preserving exports with migration. Keep the existing ownership and transaction safeguards. Real model adapters must later honor the same cancellation and stale-result contracts and be tested through deterministic failure fixtures.
