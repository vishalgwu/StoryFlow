# v0.6.1: navigation and motion polish

The review found abrupt anchor jumps, disappearing navigation, fixed-control overlap risk, repeated word/layout work in cursor updates, and an active-section offset conflict. The fixes use native smooth anchor scrolling, sticky navigation, measured dock/footer clearances, cached word nodes, transform-based cursor travel, frame-based drag updates, and elapsed-time edge scrolling. Wheel/touch scrolling is not intercepted.

- `npm run check`: 64 Node tests and the unchanged 30-case evaluation.
- Browser suite: 46 scenarios, including three new polish scenarios plus all 43 previous cases.
- New coverage checks section navigation in both directions, visible headings above fixed controls, active-section tracking, native wheel input both ways, reduced-motion CSS, keyboard Home/End over a 600-word story, and a 320px adaptive dock/footer without horizontal overflow.
- Existing axe audits and doubled-text 320px checks remain part of the release gate. Manual local visual review covers scrolling between the writer and supporting panels.

These checks establish behavior in tested Chrome/Chromium environments; they are not an FPS benchmark, a promise of perfect animation on every device, or a replacement for human accessibility testing. Story schema 4 and persistence contracts remain unchanged.

---

# v0.6.0: story canvas and movable cursor

The reference site and its source were inspected before implementation. The new dark monospace writing surface provides a inline ⊕ cursor, muted future text, inline editing, and a writing-action dock. It retains StoryFlow's existing domain/storage modules. No reference model adapters or steering dials are claimed.

- `npm run check`: syntax, **64 passing Node tests**, and the unchanged **30-case evaluation**.
- Browser suite: **43 scenarios**, including five new canvas scenarios and the 38 previous regressions.
- Five Node cursor tests cover exact Unicode/whitespace/punctuation boundaries, start/passage/end positions, branch preservation, undo/redo/export, stale/foreign ownership rejection, atomic validation failure, and stale evidence after a changed prefix.
- Five browser scenarios cover pointer drag, forward/backward keyboard movement, double-click return to end, selection without prose mutation, earlier-point writing with reload recovery, generation on a preserved alternative, and menu accessibility/disabled editing guards.
- The full accessibility audit still covers initial/memory/review states and 320px doubled-text reflow. The renamed generation button uses an accessible name containing its visible label. Existing native read-only textareas remain the accessible representation of prose; visual word spans are marked aria-hidden to avoid duplicate screen-reader text. Editing uses the normal native textarea.
- Manual local browser review checks the reference-inspired layout and cursor menu. Screenshots are kept outside the repository; CI retains the browser report as before.

Cursor selection is ephemeral and resets after revision/branch/project/reload changes. Starting writing creates a blank passage using normal checkpointed Save/Cancel recovery. An earlier selection forks atomically and never rewrites the original branch. Generation preparation failure may leave a prefix branch, with its original still preserved. No project schema change is required.

---

# Phase 5: evaluated local preview — verification

## Release gate and scope

v0.5.0 completes the local-preview Phase 5 gate. This is not the complete live AI/visual-steering product. See [release notes](RELEASE_NOTES.md), [evaluation](docs/evaluation.md), and [accessibility](docs/accessibility.md) for methods, results, and explicit limits.

## Executed checks

- `npm run check`: syntax checks, **59 Node tests**, and the **30-case evaluation** pass.
- `npm run test:browser` with Chrome on Windows: **38 scenarios** including all 34 prior regressions and four release scenarios.
- Axe-core audits initial editor, expanded memory fields, continuity findings/evidence, and enlarged text at 320px with zero detected violations under the selected WCAG A/AA and best-practice rules. This is automated evidence, not conformance certification.
- Keyboard checks cover skip navigation, save/cancel, and focus after dynamic approval/dismissal. Narrow reflow checks enforce no horizontal document overflow and usable Apply/Undo.
- One complete scenario covers edit → fork → approved memory → captured context → offline continuation → cited review → edited repair → reload → portable export/import → unchanged original branch. It asserts no browser runtime errors or external requests during that journey.
- `git diff --check` before commit. CI independently runs Node/evaluation and Chromium browser checks, retaining audit JSON/screenshots for seven days.

The initial narrow audit exposed enlarged heading overflow and an unfocusable scrolling revision preview; heading wrapping and named focusable scrolling regions fix them. Initial test setup errors (textarea text-content assertions and CSP-blocked inline test styling) were corrected to value assertions and a test stylesheet response without weakening application CSP.

## Measured baseline and limits

Twenty synthetic continuity cases yield 6 true positives, 0 false positives, 4 false negatives, and 10 true negatives: 100% precision and 60% recall on this development set. Six emitted findings have valid exact citations; 14 cases produce no finding. All 10 memory inclusion cases match their labels. Cost is zero. These cases do not establish general accuracy, semantic ranking performance, model adherence, writing-quality gains, or human usability. Four unsupported-language misses remain visible in the baseline.

Manual screen-reader, browser zoom/OS assistive-technology checks, held-out fiction evaluation, and writer studies remain unperformed. Live model integration and visual steering remain unfinished product work. No new storage schema is introduced; existing schema 4 and legacy migrations remain covered by regressions.

---

# Phase 4: bounded local continuity review — verification

## Release gate and scope

The local reviewer freezes a branch/revision, approved facts, and exceptions; reports supported possible conflicts with two exact citations; and offers editable repairs requiring approval. It checks definite-object possession and explicit matching can/cannot statements. It abstains on dialogue, uncertainty, time cues, unsupported grammar, intervening recovery, and excessive relevant context. No general semantic accuracy, paid inference, or quality improvement is claimed.

## Automated checks

- `npm run check`: syntax validation and **59 passing Node tests**, including 16 continuity tests.
- `npm run test:browser`, installed Chrome on Windows: **34 browser scenarios**, including 9 continuity scenarios and all 25 prior regressions.
- `git diff --check` before commit. GitHub Actions independently runs Node and Chromium checks on main.

The Node suite covers exact citations, no automatic prose changes, edited approval, atomic audit/undo, stale base and changed-memory rejection, branch/time/knowledge filters, unsupported-language abstention, budget exits, partial results, cancel, exceptions/reconsideration, generation ownership, interrupted recovery, malformed imports, failure isolation, and budgeted recovery evidence outside the selected range.

Browser scenarios cover editable replacement/approval/undo, stale patches after writing, intentional exceptions and reconsideration, partial results and prose-free trace downloads, cancel while editing, interrupted reload, injected review failure with continued editing/saving, recovery/dialogue abstention, branch switching during a frozen run, and export/import validation.

## Limits and recovery

The reviewer is deterministic and deliberately narrow. Zero findings is not proof of consistency. UTF-8 byte estimates are conservative input estimates, not provider usage; actual cost remains zero. Runs are limited by calls, input estimate, elapsed time, and findings, with at most one running review. Evidence retrieval includes a bounded number of relevant intervening passages; ambiguity leads to abstention.

Budget-exhausted partial findings remain eligible for explicit approval if fresh. Canceled, failed, and interrupted findings are inspectable only. Reload interrupts instead of silently resuming. One applied patch changes the base and makes remaining old-base proposals stale. Exceptions suppress an exact signature on their own branch until reconsidered. Review progress is persisted through the normal save queue; pending form edits remain session-only. Runs/exceptions survive schema-v4 exports and imports; older schemas migrate without invented review history.

---

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

When enlarged text or a short window makes fixed bars consume too much of the viewport, navigation and writing controls move into normal document flow so they cannot trap or cover the content. This fallback is recalculated on resize.
