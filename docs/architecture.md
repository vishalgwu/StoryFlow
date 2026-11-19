# Architecture decision: editor, immutable branches, and evidence-backed memory

## Scope and stack

Phases 0–5 provide a browser-first writing editor, reliable recovery, immutable branches, approved local memory, bounded continuity review, and an evaluated local preview. v0.6.0 adds a story-first canvas and safe continuation cursor. Prompt steering, real model providers, and learned semantic retrieval remain planned.

Use buildless HTML/CSS and browser-native JavaScript modules, IndexedDB, Web Locks, and Node.js 22+ built-in HTTP/test tools. There are no external runtime dependencies or model downloads. Playwright is a pinned development-only dependency with a committed npm lockfile. A framework can be reconsidered when interaction complexity warrants it.

## Domain boundaries

- `domain.js` retains schema-v1 validation and the original editor for reading released recovery data. Its legacy snapshot limits apply only to that format.
- `history.js` owns schema-v4 workspace validation, immutable revisions/paragraph versions, branch transactions, lineage, restore, comparison, memory mutations, and legacy migration. Public workspace/project access returns copies. Each mutation validates a candidate workspace before replacing live state. True no-ops retain operation ownership and project-replacement recovery.
- `memory.js` owns candidate extraction, immutable fact decision versions, source-span validation, branch inheritance, stale-evidence checks, narrative validity, character knowledge, context ranking, budgets, and manifest validation. It has no DOM or model/network dependency.
- `memoryui.js` owns the review queue, memory forms, source inspector, and included/omitted context explanations. It never silently approves extracted candidates. In-memory form buffers preserve fields, open state, focus, and caret across unrelated rerenders; only explicit save/approval persists metadata.
- `explorer.js` renders the branch tree/list, revision inspector, and comparison controls. Mutations call domain methods through a shared UI coordination path. A native branch selector and ordinary labeled buttons provide keyboard access without dragging.
- `session.js` validates internal recovery envelopes. Format 2 contains the complete workspace, optional one-step import/new-project backup, one unapplied paragraph edit, and one branch-scoped sample proposal. Format 1 and the original plain project record remain supported for migration.
- `storage.js` reads and writes the validated recovery envelope transactionally at the existing `projects/active` key. Success is reported only on transaction completion. Open/read/validation failures preserve existing data and disable saving. Quota and aborted-write failures preserve in-memory work with a retry/export path.
- `generation.js` captures operation, project, branch, revision, and editor epoch. Canceled, superseded, or stale operations cannot commit. Returning to a previously active branch still invalidates an older request. Offline template results use the same append and storage paths as manual edits, with explicit provenance.
- `app.js` coordinates Save/Cancel, working text, generation, explorer actions, and serialized checkpoints. A successful old save cannot mark a newer state as saved. Story and model text are rendered as text/value properties.
- `server.mjs` is loopback-only and serves only allowlisted application assets. Git metadata and project documents are not public assets.

## Workspace schema 3

A workspace stores its ID and active branch ID, branches, revisions, paragraph versions, and immutable memory decision records. Schema-v2 projects migrate by adding empty memory indexes; schema-v1 project/recovery migration remains supported.

A branch has a unique name, parent branch, fork revision, head revision, archive flag, bounded undo/redo action pointers, and its current memory decision IDs. Its initial head can share the fork revision; later revisions belong to that branch. Switching changes only the active branch. Naming/archive metadata and memory indexes can change while committed prose and fact versions stay immutable.

A revision has an ID, authoring branch, parent revision, title, immutable paragraph-version IDs, timestamp, summary, source, optional restoration source, and optional generation provenance. Paragraph versions keep a stable paragraph ID and immutable text. Unchanged passage versions are reused. The offline fixture records its operation ID, provider label, null/empty model and steering settings, and the exact captured context manifest.

Undo/redo creates new revisions with explicit recovery provenance. Restore accepts an ancestor of the active head and creates a new revision whose parent is the current head. It never removes intervening writing. Fork can start at any active-branch ancestor. Sibling-only history is available for explicit comparison, not implicit restore. Automatic merging is deferred.

Validation rejects missing/duplicate IDs, broken heads, invalid version references, cycles, sibling ancestry leakage, unreachable records, unsupported fields, and invalid recovery pointers. Every branch fork must belong to its parent's ancestry. Limits are 20 MB portable JSON, 50 branches, 5,000 revisions, 20,000 paragraph versions, and the existing 2 MB draft/200-paragraph/20,000-character limits per revision. A failed limit check leaves the original workspace untouched. Immutable records are not pruned.

## Migration, replacement, and exports

Schema-v1 imports become a Main branch with a migration revision. Released Phase 1 recovery snapshots become immutable revisions on that branch, retaining current project/paragraph IDs and recovered undo/redo content. Unapplied paragraph edits and branch-scoped samples survive migration. A running sample becomes interrupted on reload and never appends automatically. Failed migration follows the same write-disabled recovery path as invalid stored data.

Portable exports contain the full schema-v4 graph, archive flags, action pointers, memory decision history, supporting source spans, and committed generation contexts. They use compact JSON so whitespace cannot push a valid near-limit export over its import budget. A visible working paragraph becomes an export-only revision without silently changing the editor. If it cannot fit, the app explicitly exports committed history and offers a separate pending-text export. Sample-panel text is exported separately. Unsaved memory form fields are not exported.

Import and New project retain one previous workspace for immediate Undo/Redo, including reload recovery. A subsequent prose, branch, memory, or review mutation clears that backup. It is not exported with the current project and may add another 20 MB to browser storage. Confirmation asks the writer to export an independent backup first.

## Memory lifecycle and scope

Each record names its immutable root and previous decision, scope branch, decision revision, claim, category, fact/inference/plan type, pending/accepted/dismissed status, entities, narrative validity range, reader visibility, per-character knowledge, lock, origin, and exact evidence revision/version/span/quote. Limits are 2,000 total memory versions and 500 current records per branch, within the workspace's 20 MB budget. Evidence spans must match their immutable source exactly. Bad references, altered quotes, invalid character states, decision cycles, and backward decision ancestry fail before mutation.

Approving, editing, dismissing, or revalidating appends a fact version and updates only the active branch's pointer. Saving changed fields resets approval. Plans and inferences remain non-authoritative even when accepted. Only accepted facts can be locked. Repeating an unchanged approval does not allocate another version or silently remove its lock. Approval of stale evidence still fails before the no-op check.

Forks snapshot eligible decision IDs. A historical fork walks predecessor decisions until their decision/source revisions belong to its ancestry. A child cannot inherit later parent/sibling decisions, and child changes cannot rewrite the parent. Decisions at the same prose revision use the current decision at that revision; there is no separate prose revision per memory decision. Prose undo/restore retains memory records and derives freshness from the restored paragraph versions.

Staleness is computed from the selected head: if the supporting paragraph version was edited or removed, the accepted fact is excluded. Revalidation requires a current, unambiguous matching quote and resets the fact to pending. The old source/decision remains immutable and inspectable.

## Context contract

Retrieval considers the active branch's current decisions and filters approval, fact type, evidence freshness, inclusive writer-assigned time bounds, and reader/character knowledge. Absent character knowledge is unknown. Eligible locks rank first; other facts rank by entity, keyword, and a small synonym lexicon. This is a deterministic baseline, not learned embedding retrieval or truth verification.

The prepared prompt includes the viewpoint/time, approved claims, validity/knowledge metadata, exact citations/quotes, and bounded recent prose excerpts. UTF-8 bytes are used as a conservative input-token upper bound, explicitly not actual provider usage. If instructions plus eligible locks exceed the budget, preparation is blocked; locks are never silently dropped to make a request fit. Other exclusions have inspectable reasons. Knowledge filtering applies to memory; recent prose is not semantically redacted.

An operation captures the context before streaming. Memory mutations advance editor ownership and invalidate an older operation. Included/omitted decisions must belong to the branch's inherited decision chains, not merely share a fact root. Context text is reconstructed from the manifest and immutable evidence during validation. History records keep the captured manifest after subsequent edits. Context previews are labeled outdated when the draft, memory, or settings change.

The offline continuation fixture reuses the first approved included claim or falls back to the lighthouse sample. This tests the data contract without a model call or an assertion about AI adherence. Local sentence extraction proposes up to 40 exact-quote candidates; writers correct classification, entities, time, and knowledge.

## Reliability and privacy

Checkpoints run after a 250 ms pause; generation checkpoints every four chunks and on completion/failure/cancel. Applied generation and its draft share a single snapshot. A failed write retains the unsaved-navigation warning. Successful saves clear storage errors without hiding separate generation/import errors.

A same-origin Web Lock grants one editing tab. Another tab can inspect/export but cannot mutate. Close the owner and reload to acquire editing. Browsers without Web Locks open read-only; a back-forward-cache return reloads to reacquire ownership.

Periodic checkpoints cannot guarantee the latest keystroke or word survives a crash, and browser storage may be evicted. Exports are the independent backup. There are no credentials, remote inference calls, server-side database, synchronization, or hosted service in this milestone.

## Bounded continuity review (Phase 4)

Schema 4 adds review runs and intentional exceptions; schemas 1–3 migrate with empty review history. `review.js` freezes branch, revision, eligible accepted fact decisions, exception IDs, time/viewpoint, range, and resource settings. A resumable cursor advances local read/retrieve/propose stages with bounded calls, estimated UTF-8 input bytes, elapsed time, findings, and zero cost. `reviewui.js` exposes status, cancellation, citations, editable proposals, decisions, and trace export. Review progress does not change generation ownership; applying a repair does.

Only definite-object possession and matching explicit can/cannot statements are supported. Dialogue, uncertainty, temporal cues, unsupported syntax, intervening transitions, and excessive relevant context cause abstention. Relevant intervening passages outside the selected target range are retrieved and charged before checking recovery. This is a conservative rule baseline, not a general semantic checker.

Every finding retains immutable source and target spans plus exact patch preconditions. Applying requires the active branch, unchanged base head, current eligible fact decision, and exact target paragraph version/text. The transaction writes one paragraph and a source-review revision with a validated applied audit; unrelated paragraphs and title cannot change. Approval is explicit and undoable. A changed head makes remaining proposals stale. Intentional exceptions are exact-signature, branch-local records with reasons and reconsideration history.

Checkpoints retain partial findings. Budget exhaustion may permit explicit approval of fresh partial results; canceled, failed, or reload-interrupted runs are read-only. Reload never resumes review automatically. Runs are capped at 100 and exceptions at 200 within the existing 20 MB workspace limit. Trace exports contain IDs/settings/operation counters and exit reasons without prose or patch text; portable project exports retain full evidence and decisions. Validation rejects malformed scope, citations, counters, patches, exceptions, and hidden rewrites. Any review mutation clears the immediate import undo backup.

## Evaluation and local preview release (Phase 5)

`evaluation/run.mjs` exercises the real editor, memory/context and review modules against labelled synthetic cases. It compares a reproducible per-case report with the committed baseline; changes require explicit inspection before regeneration. The runner never applies repairs. `npm run check` includes this evaluation alongside syntax and Node regression checks.

The UI adds section links, a skip link, in-app workflow/recovery guidance, focus recovery after dynamic decisions, and keyboard-accessible scrolling panels. Playwright uses the development-only axe checker in representative states and verifies keyboard navigation, 320px reflow with enlarged CSS fonts, and a complete portable-backup journey. CI retains audit/screenshot evidence on all runs. No runtime dependencies, backend, build step, or schema change are added. See the evaluation and accessibility documents for exact results and unperformed research.

## Remaining product work

The local-preview Phase 5 gate is complete. Real provider adapters, visual steering, learned retrieval, held-out quality evaluation, writer research, and manual assistive-technology checks remain open. They need their own implementation and evidence before claiming the intended AI-writing product is complete. Optional Phase 6 expansion remains evidence-driven rather than automatically started.

## Story canvas and continuation cursor (v0.6.0)

`cursor.js` derives UTF-16 word boundaries and validates project/branch/revision ownership before slicing a prefix. `BranchEditor.continueAt` atomically validates and writes either an appended passage or a new prefix branch with a unique Cursor alternative name. Parent prose/history and inherited fact decisions are retained; changed evidence becomes stale under existing rules. The operation uses existing undo pointers and schema 4, including export/import and reload recovery.

`canvas.js` renders the visual words and an inline cursor. It supports click/drag, edge scrolling, keyboard movement, and an explicit writing action. The native read-only textarea is retained as the accessible prose source; visual spans are aria-hidden. New manual writing immediately opens the normal checkpointed paragraph editor. Generation at an earlier cursor first forks the prefix, then uses existing context preparation and generation ownership. No new model call, dial, steering payload, or inference capability is implied by this presentation change. Cursor state is intentionally ephemeral and reset on prose/scope changes.

## Navigation and motion (v0.6.1)

`navigation.js` measures sticky navigation, footer, and writing dock with ResizeObserver, publishing CSS clearances without changing story state. A passive scroll listener schedules at most one section-highlight update per animation frame; the dock compacts outside the writing canvas. Native wheel/touch behavior is retained, and only programmatic section/cursor travel is smoothed, respecting reduced-motion preferences.

The canvas caches rendered word spans, skips unchanged word-class work, and avoids cursor geometry reads during ordinary control-state updates. Pointer coordinates are consumed once per animation frame; native caret hits find words where supported, with a visible-geometry fallback. Drag-edge scrolling uses elapsed frame time and immediate scroll steps. Cursor travel uses transforms. These changes reduce redundant work without claiming a measured frame-rate improvement.
