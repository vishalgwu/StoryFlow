# Architecture decision: browser editor with immutable branches

## Scope and stack

Phases 0–2 provide a browser-first writing editor, reliable recovery, immutable revision history, and independent story branches. The broader blueprint still governs planned steering, evidence-backed memory, and continuity review.

Use buildless HTML/CSS and browser-native JavaScript modules, IndexedDB, Web Locks, and Node.js 22+ built-in HTTP/test tools. There are no external runtime dependencies or model downloads. Playwright is a pinned development-only dependency with a committed npm lockfile. A framework can be reconsidered when interaction complexity warrants it.

## Domain boundaries

- `domain.js` retains schema-v1 validation and the original editor for reading released recovery data. Its legacy snapshot limits apply only to that format.
- `history.js` owns schema-v2 workspace validation, immutable revisions/paragraph versions, branch transactions, lineage, restore, comparison, and legacy migration. Public workspace/project access returns copies. Each mutation validates a candidate workspace before replacing live state.
- `explorer.js` renders the branch tree/list, revision inspector, and comparison controls. Mutations call domain methods through a shared UI coordination path. A native branch selector and ordinary labeled buttons provide keyboard access without dragging.
- `session.js` validates internal recovery envelopes. Format 2 contains the complete workspace, optional one-step import/new-project backup, one unapplied paragraph edit, and one branch-scoped sample proposal. Format 1 and the original plain project record remain supported for migration.
- `storage.js` reads and writes the validated recovery envelope transactionally at the existing `projects/active` key. Success is reported only on transaction completion. Open/read/validation failures preserve existing data and disable saving. Quota and aborted-write failures preserve in-memory work with a retry/export path.
- `generation.js` captures operation, project, branch, revision, and editor epoch. Canceled, superseded, or stale operations cannot commit. Returning to a previously active branch still invalidates an older request. Offline template results use the same append and storage paths as manual edits, with explicit provenance.
- `app.js` coordinates Save/Cancel, working text, generation, explorer actions, and serialized checkpoints. A successful old save cannot mark a newer state as saved. Story and model text are rendered as text/value properties.
- `server.mjs` is loopback-only and serves only allowlisted application assets. Git metadata and project documents are not public assets.

## Workspace schema 2

A workspace stores its ID and active branch ID, branches, revisions, and paragraph versions.

A branch has a unique name, parent branch, fork revision, head revision, archive flag, and bounded undo/redo action pointers. Its initial head can share the fork revision; later revisions belong to that branch. Switching changes only the active branch. Naming/archive metadata can change while committed prose stays immutable.

A revision has an ID, authoring branch, parent revision, title, immutable paragraph-version IDs, timestamp, summary, source, optional restoration source, and optional generation provenance. Paragraph versions keep a stable paragraph ID and immutable text. Unchanged passage versions are reused. The offline fixture records its operation ID, provider label, and explicitly empty/null model and steering settings.

Undo/redo creates new revisions with explicit recovery provenance. Restore accepts an ancestor of the active head and creates a new revision whose parent is the current head. It never removes intervening writing. Fork can start at any active-branch ancestor. Sibling-only history is available for explicit comparison, not implicit restore. Automatic merging is deferred.

Validation rejects missing/duplicate IDs, broken heads, invalid version references, cycles, sibling ancestry leakage, unreachable records, unsupported fields, and invalid recovery pointers. Every branch fork must belong to its parent's ancestry. Limits are 20 MB portable JSON, 50 branches, 5,000 revisions, 20,000 paragraph versions, and the existing 2 MB draft/200-paragraph/20,000-character limits per revision. A failed limit check leaves the original workspace untouched. Immutable records are not pruned.

## Migration, replacement, and exports

Schema-v1 imports become a Main branch with a migration revision. Released Phase 1 recovery snapshots become immutable revisions on that branch, retaining current project/paragraph IDs and recovered undo/redo content. Unapplied paragraph edits and branch-scoped samples survive migration. A running sample becomes interrupted on reload and never appends automatically. Failed migration follows the same write-disabled recovery path as invalid stored data.

Portable exports contain the full schema-v2 graph, archive flags, and action pointers, and use compact JSON so whitespace cannot push a valid near-limit export over its import byte budget. A visible working paragraph becomes an export-only revision; it does not silently change the current editor. If that revision cannot fit, the app explicitly exports committed history and offers a separate text export of the pending words. Sample-panel text is exported separately.

Import and New project retain one previous workspace for immediate Undo/Redo, including reload recovery. Any subsequent edit or branch mutation clears that replacement backup. The backup is not exported with the current project and may add another 20 MB to browser storage. Confirmation asks the writer to export an independent backup first.

## Reliability and privacy

Checkpoints run after a 250 ms pause; generation checkpoints every four chunks and on completion/failure/cancel. Applied generation and its draft share a single snapshot. A failed write retains the unsaved-navigation warning. Successful saves clear storage errors without hiding separate generation/import errors.

A same-origin Web Lock grants one editing tab. Another tab can inspect/export but cannot mutate. Close the owner and reload to acquire editing. Browsers without Web Locks open read-only; a back-forward-cache return reloads to reacquire ownership.

Periodic checkpoints cannot guarantee the latest keystroke or word survives a crash, and browser storage may be evicted. Exports are the independent backup. There are no credentials, remote inference calls, server-side database, synchronization, or hosted service in this milestone.

## Next milestone

Phase 3 adds writer-approved memory candidates linked to immutable revisions, paragraph versions, and source spans. Retrieval must enforce branch ancestry and narrative-time scope. Keep those domain rules outside UI handlers and preserve the existing operation/transaction protections. Real provider adapters and steering controls require their own documented contracts and verification before claiming the intended AI workflow.
