# Phase 3: evidence-backed local memory — verification

## Release gate and scope

The local memory workflow is implemented: exact evidence, pending approval, writer correction/dismissal, branch-specific decisions, narrative-time validity, per-character knowledge, stale-source revalidation, distant fact retrieval, inspectable budgets/context, and persistence/export. The extraction/retrieval implementation is a deterministic local baseline. Learned embeddings, LLM extraction, live model inference, and measured quality improvements are not claimed.

## Automated checks

- `npm run check`: syntax checks and **43 Node tests**.
- `npm run test:browser` with installed Chrome on Windows: **25 browser scenarios**, including 9 memory scenarios and the 16 prior editor/branch regressions.
- `git diff --check`: required before commit.

### Memory acceptance evidence

| Requirement | Coverage |
| --- | --- |
| Proposals do not become truth silently | Extraction/manual proposals start pending; only accepted facts enter authoritative context |
| Source links resolve | Exact revision, paragraph version, start/end, and quoted text are validated; browser evidence inspector highlights the original quote |
| Correction and decisions | Edits append a pending version; approval/dismissal preserves immutable decision history; repeated unchanged approval retains its lock |
| Branch isolation | Child decisions do not rewrite parent decisions; later parent/sibling facts stay excluded; historical forks recover earlier eligible decision versions |
| Narrative time | Inclusive writer-assigned validity bounds are tested before, inside, and after a range |
| Character knowledge | Reader, knows, does-not-know, and unknown states are tested separately |
| Plans and inferences | Accepted non-fact records stay out of authoritative continuation constraints and cannot be locked |
| Stale evidence | Changed/deleted source versions exclude a fact; current-quote revalidation returns it to pending for another approval |
| Distant retrieval | An early fact remains retrievable after 30 unrelated later passages using entity/keyword/local synonym relevance |
| Budget enforcement | Required instructions and eligible locks block preparation if they cannot fit; included/excluded reasons and exact context remain inspectable |
| Generation integration | Offline fixture consumes the captured approved claim; the revision records that exact context; later memory decisions invalidate an in-flight operation |
| Persistence and migration | Memory, decision links, and manifests survive export/import/reload; schema-v2 migration preserves history IDs and invents no facts |
| Defensive validation | Altered quotes/spans, invalid knowledge, foreign scope, cyclic history, prompt tampering, and parent-only context decisions are rejected |
| UI reliability | Unsaved form values/open state/focus survive an unrelated rerender; unsaved fields remain explicitly outside backups/reload recovery |

The earlier failed textarea check queried text content instead of its value; it was corrected to assert the displayed value. A missing exact accessible label on a nested select was fixed. A stale-approval test also caught a no-op guard running too early; stale evidence is now checked before an unchanged approval can return.

## Manual visual verification

The in-app browser migrated the existing Phase 2 project with its original prose and branches intact. On a separate Memory walkthrough branch, a saved passage was proposed, its category/entities/character knowledge were reviewed, and the record was approved. The original quote was highlighted in the evidence inspector; context preparation included the accepted fact with a relevance explanation and an estimated budget. Returning to Main showed zero memory records, preserving branch isolation. There were no warning/error console entries in this normal flow. A local screenshot was recorded separately from source code. Branch switches clear ordinary context previews; explicit sample-context inspection labels the captured source branch.

## Reproduce and limits

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
```

For installed Chrome in PowerShell, set `$env:STORYFLOW_BROWSER_CHANNEL='chrome'`. Stop an existing dev server first; the suite starts its own loopback server. GitHub CI runs the same suites in Chromium on Linux; inspect the commit's Actions run for remote results.

Time, entity names, aliases, record type, and character knowledge require writer review. Local extraction does not establish truth or reliably resolve negation/pronouns. The small synonym lexicon is not an embedding model. UTF-8 byte counts are conservative estimates rather than actual model usage. Recent prose is not semantically redacted by the character-knowledge filter. Model adherence, cross-browser coverage beyond the recorded environments, formal accessibility, scale benchmarks, and user-study outcomes are not established.

Memory is capped at 2,000 total decision versions and 500 current records per branch, within the existing 20 MB workspace limit. UI pages show 25 records. Up to 100 in-memory form drafts are retained across rerenders; only explicit saved decisions survive reload/export. Prose undo/redo does not undo memory decisions.

---

# Historical Phase 2 verification

The following records the released Phase 2 milestone. Current exports use schema 3; the schema-v2 graph described below remains supported for migration.

## Release gate

Phase 2 covers immutable revisions and paragraph versions, named branches with independent heads, a nested visual/list explorer, revision inspection, comparison, safe restore, archive/reopen, schema-v2 graph export/import, and migration of released Phase 1 data. Real AI, steering, memory, review, collaboration, and automatic merging are outside this milestone.

## Local automated results

- `npm run check`: syntax checks and **24 Node tests passed** on Node.js 24.14.1.
- `npm run test:browser`: **16 scenarios passed** using installed Chrome on Windows, including the ten editor reliability scenarios from Phase 1.
- `git diff --check`: required before commit.

The browser suite starts an isolated loopback server and fresh contexts. Its new Phase 2 paths cover:

| Path | Acceptance evidence |
| --- | --- |
| Fork and edit | Main retains its original prose and head while an alternative changes |
| Compare | Selected revisions show removed and added text without changing either draft |
| Restore and reload | Restore creates a fresh revision; later prose remains inspectable; Undo and reload retain the right branch |
| Historical fork | Forking an earlier revision excludes later Main-only prose |
| Rename/archive/reopen | Names and archive flags persist; reopening does not delete history |
| Portable round trip | Complete schema-v2 branch/revision/version graph and stable links survive export/import |
| New project | Previous graph can be recovered through the immediate project-replacement Undo |
| Stale stream after branch switching | Switching away and back cannot commit a late response to either branch; a proposal remains scoped to its original branch |
| Phase 1 migration | Current prose, stable IDs, unapplied edits, retained undo, and interrupted samples survive conversion |
| Malformed graph import | Broken heads are rejected without changing the active graph; branch actions are disabled during an unapplied paragraph edit |
| Full history | The 5,000-revision limit refuses an edit; committed history and unapplied words can still be exported separately |

Node tests additionally verify defensive copies of committed records, append-only undo/redo and restore provenance, paragraph-version reuse, sibling-only restore rejection, exact offline fixture provenance, missing references, cycles, duplicate IDs, unsupported fields, import size limits, branch/revision caps, and migration of legacy redo states.

## Manual visual check

The in-app browser migrated the existing Phase 1 draft with its original title and paragraphs intact. Forked an alternative, edited only that branch, reloaded, switched back to Main, and compared the two heads. Main retained the original prose. The branch hierarchy, active state, revision metadata, and struck-through/underlined comparison were inspected visually. No console warnings or errors were recorded during this normal flow. The preview screenshot is a local artifact, separate from repository source.

## Data flow and limits

UI action -> graph transaction on a copy -> full validation -> active head update -> serialized IndexedDB checkpoint -> validated recovery on reload. A failed graph mutation never replaces the previous workspace. The existing quota, aborted read/write, export, literal-text rendering, single-tab lock, and keyboard regression tests remain in the suite.

Schema-v2 portable exports have a 20 MB budget, 50 branches, 5,000 revisions, and 20,000 paragraph versions. Each revision retains the 2 MB/200-paragraph draft limit. History is not pruned; the action is refused at a cap. There is no claim of unlimited history or measured performance across all project sizes. Comparison is paragraph-based and labels moves; it is not word-level diff or semantic merging.

The generation fixture has no model or steering settings. Those are explicitly null/empty in its recorded metadata; no live model behavior is implied. Cross-browser, live-provider, deployed-site, GPU, formal accessibility, and user-study claims remain outside the evidence. GitHub Actions runs the same checks in Chromium on Linux; inspect its run for remote evidence.

## Reproduce Phase 2 checks

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
```

For installed Chrome, set `STORYFLOW_BROWSER_CHANNEL=chrome` (PowerShell: `$env:STORYFLOW_BROWSER_CHANNEL='chrome'`). Stop any existing dev server first. The suite owns its test server. Browser fault injection remains confined to test code.

---

# Historical Phase 1 verification

The following records the earlier Phase 1 milestone. Phase 2 replaces its bounded snapshot history with the immutable graph described above; old formats are still validated during migration.

## Scope and release gate

Phase 1 is complete for the browser-only, single-draft editor with a deterministic offline continuation fixture. A writer can explicitly save/cancel paragraph edits, undo/redo, reload, import/export, cancel a stream, recover partial output, and continue writing after a failed save or generation. Immutable revisions and a browser branch explorer are Phase 2; real model providers, steering, memory, and review are later work.

## Automated results

Verified on Windows with Node.js 24.14.1 and installed Google Chrome:

- `npm run check`: syntax checks and **12 Node tests passed**.
- `npm run test:browser` with `STORYFLOW_BROWSER_CHANNEL=chrome`: **10 browser scenarios passed**.
- `git diff --check`: passed.

The browser suite starts its own loopback server and uses isolated browser contexts. Failure injection is confined to test code; the application has no production fault switches or test endpoints. Browser tests include actual IndexedDB writes and reloads.

### Node coverage

- Stable paragraph IDs and reversible edits with fresh operation ownership.
- Portable schema round trips and malformed JSON, null records, duplicate IDs, oversized inputs, and credential-field rejection.
- Invalid mutations leave draft/history unchanged.
- Generation commits once and is undoable; edits, undo, project/branch changes, cancellation, and supersession invalidate stale responses.
- Loopback server serves application assets and refuses repository/private files.
- Original stored project format migrates into a recovery session without losing IDs or prose.
- Recovery restores unapplied paragraph text, undo/redo, and interrupted output without auto-committing it.
- Invalid recovery records and revision overflow are rejected safely.
- Large projects prune history to the 8 MB budget while preserving recent undo.

### Browser acceptance scenarios

| Scenario | Evidence |
| --- | --- |
| Paragraph save/cancel and reload | Cancel restores original; Save keeps ID; undo/redo and unapplied edits survive reload |
| Stream completion, stop, and stale writes | Normal completion appends once; Stop keeps partial output; intervening edits prevent automatic append |
| Reload during stream | Stored checkpoint returns as an interrupted proposal; draft stays unchanged |
| Import/export | Invalid import preserves draft; valid replacement can be undone; exported draft reimports; script-like prose stays literal |
| Quota and aborted writes | Draft remains open; failure is visible; Retry saving succeeds and survives reload |
| Invalid stored record | Startup preserves unreadable record and disables saving rather than replacing it |
| Concurrent tabs | Second tab is read-only; it can acquire editing after the owner closes and it reloads |
| Keyboard and narrow layout | Ctrl+Enter saves; Escape cancels; 390px layout has no horizontal page overflow |
| Stream disconnect | Partial output stays separate, error remains visible after checkpoint, ordinary editing still works |
| Aborted storage read | Recovery screen opens with saving disabled; original stored project is intact when reopened normally |

Fault injection exposed a null IndexedDB transaction-error path, which was fixed and then passed the complete suite. Stream errors were also kept distinct from successful storage saves so saving cannot hide a generation failure.

## Manual flow verification

The in-app browser loaded an existing draft written by the previous app version, demonstrating migration with its title and prose preserved. Explicit paragraph Edit, Save/Cancel controls, Escape cancellation, and save status were visually inspected. The console had no warning/error entries during this normal interaction. A local preview screenshot was recorded separately from repository source.

Flow: UI action -> domain validation/history -> serialized IndexedDB transaction -> current checkpoint acknowledgement -> reload and rendered recovery. Generation uses the same validated editor and snapshot path. There is no hosted API, credential requirement, remote inference call, or server-side database in this phase.

## Reproduce

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
```

To use installed Chrome instead, set `STORYFLOW_BROWSER_CHANNEL=chrome` (PowerShell: `$env:STORYFLOW_BROWSER_CHANNEL='chrome'`). Stop an existing local server before running the browser suite. Restricted environments need loopback/process-launch permission. CI is configured in `.github/workflows/checks.yml` to run the same suites using Chromium on Linux.

## Limits

Local automated browser evidence covers Chrome on Windows. Broader Firefox/Safari coverage, a formal accessibility audit, real-device/GPU testing, live providers, deployed-site testing, and user studies are not claimed. The workflow configuration is separate from local test evidence; consult GitHub Actions for its remote result.

Recovery checkpoints are periodic. A crash or eviction can lose the latest uncheckpointed input, and browser storage is not a backup. A second tab must reload to take ownership. Up to 50 prior edits are retained within an 8 MB history budget; exports contain the draft only, including a visible unapplied edit. Export the sample panel separately. Immutable version history and full branch-switch browser tests begin in Phase 2; current ownership tests already reject a changed branch ID.
