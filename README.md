# StoryFlow

An explainable narrative studio that helps writers steer AI-generated stories, explore alternative story paths, and inspect the evidence behind story memory and continuity suggestions.

The writer retains final authority over the prose and the facts of the story.

## Current status

**Phase 5 complete for the evaluated local preview. v0.6.0 adds the reference-inspired writing canvas and movable ⊕ story cursor.** The full local journey is tested from editing and branching through approved memory, offline continuation, cited continuity repair, reload, and export/import. Section navigation, keyboard focus, enlarged-text reflow, automated accessibility audits, in-app help, and reproducible evaluation are included. See [release notes](RELEASE_NOTES.md), [verification](VERIFICATION.md), [evaluation results](docs/evaluation.md), and [accessibility evidence](docs/accessibility.md).

The reviewer supports explicit definite-object possession conflicts and matching can/cannot statements. It abstains on unsupported syntax, dialogue, uncertainty, temporal cues, and intervening recovery. Memory and review use conservative local rules. No model calls, learned embeddings, or measured general continuity accuracy are claimed. Real providers and steering controls remain planned.

### Progress checkpoint

**Phases 0–5 are complete for their documented local-preview scopes.** There is no measured whole-project completion percentage. Live AI, learned retrieval, and visual steering still need implementation and evaluation.

What works now:

- A runnable local writing studio with a documented stack and separate UI, domain, storage, and generation modules.
- One active project with multiple independent branches, title/paragraph editing, stable paragraph IDs, IndexedDB autosave, and explicit save status.
- Explicit paragraph save/cancel, recovery checkpoints for unapplied edits, and branch-local undo/redo that appends immutable recovery revisions and survives reload.
- Named branches, nested visual/list exploration, fork from an earlier revision, revision comparison, and recoverable restore. Archived branches keep their history and can be reopened.
- Schema-v4 exports preserve revisions, paragraph versions, branches, archive states, recovery pointers, memory versions, source spans, and captured generation context. Schema-v1/v2/v3 projects and released browser records migrate automatically.
- Pending/accepted/dismissed memory for characters, locations, relationships, world rules, events, threads, and knowledge. Established facts, inferences, and author plans remain distinct.
- Branch-specific fact decisions, inclusive narrative-time ranges, reader/character knowledge, stale-evidence revalidation, and inspectable context inclusion/exclusion reasons.
- A streamed offline sample with cancellation, checkpointed partial/stale output, and project/branch/revision ownership checks. Interrupted output is restored as a proposal, never automatically appended.
- Retryable save errors, preservation of unreadable stored data, and a single-tab editing lock.
- Bounded continuity review with cited conflicts, approval-only editable patches, undo, branch-local intentional exceptions, checkpoints, and prose-free trace exports.
- Sixty-four Node regression tests, thirty reproducible evaluation cases, and forty-six automated browser acceptance scenarios, plus a CI workflow. See [verification](VERIFICATION.md) for exact results and environment limits.

The local preview release gate is complete. Real model integration, visual steering, held-out quality evaluation, writer studies, and manual assistive-technology testing remain open before the intended AI product can be released.

The blueprint uses **Story Steer Studio** as the product name; **StoryFlow** is the repository name. Its references to an earlier prototype and historical test results are design context, not implemented features or verification results for this repository.

Read the full [project blueprint and implementation handoff](Story-Steer-Project-Handoff.pdf) for the proposed requirements, architecture, acceptance criteria, evaluation plan, and open decisions.

## The concept

StoryFlow is intended for individual fiction writers working on short stories and chapters. It combines direct control over AI continuations with recoverable story history and evidence-backed memory.

The intended writing journey is:

1. Create a premise, open an example, or edit a draft.
2. Select relevant passages and adjust narrative steering controls.
3. Generate a continuation, with streaming and cancellation.
4. Fork an alternative and compare it with the original.
5. Inspect and approve proposed story facts.
6. Review possible continuity conflicts and choose whether to apply suggested repairs.
7. Save and export the project with its history.

## Planned signature features

### Safe editing and visual branches

Edit paragraphs with undo/redo and stable identities. Explore alternatives through immutable revisions and independent branches. Compare, name, reopen, and restore versions without erasing later work.

Every generation will belong to a specific project, branch, and base revision. A delayed or canceled response must never overwrite newer writing or land in another branch.

### Evidence-backed story memory

Track characters, places, relationships, world rules, events, unresolved threads, and character knowledge. Proposed facts will link to supporting passages and remain subject to writer approval.

Memory must respect branch ancestry and narrative time. Events from a sibling branch must not leak into the active story, and reader knowledge must remain distinct from character knowledge. When supporting prose changes, dependent evidence must be marked stale.

### Bounded continuity review

Review a selected passage range against eligible accepted facts. Supported local findings cite both source passages, explain uncertainty, and propose a minimal edit.

The writer can apply an edited replacement, dismiss a finding, or record an intentional exception. Proposed edits require approval and must match the exact current branch, revision, fact decision, and passage. Reviews have cancellation and explicit resource budgets.

## Design principles

- Keep the story canvas central and supporting panels optional.
- Preserve a recovery path for generated changes and edits.
- Separate writer intent, established facts, model inferences, and evaluation estimates.
- Make included context and supporting evidence inspectable.
- Provide keyboard alternatives, visible focus, and accessible status feedback.
- Label offline template output and disclose where story text is sent.
- Keep credentials out of project exports and ordinary logs.

## Proposed architecture

Begin with a browser-first application and clear boundaries between the interface, domain rules, persistence, context assembly, and generation orchestration.

- **Persistence:** IndexedDB for structured projects and revisions; small preferences in localStorage; validated, versioned import/export.
- **Generation:** provider adapters with explicit operation ownership, streaming, cancellation, usage reporting, and recoverable partial output.
- **Context:** budgeted recent prose, approved facts, selected excerpts, and retrieved evidence, filtered by branch and narrative time.
- **Memory:** source-linked records; summaries and embeddings support retrieval rather than replace authoritative prose.
- **Optional backend:** introduce only when managed model access, durable reviews, cross-device projects, or collaboration requires it.

The implementation uses browser-native JavaScript modules, HTML/CSS, IndexedDB, Web Locks, and Node's built-in HTTP server and test runner. It has no runtime npm dependencies and no build step. Playwright is a pinned development-only dependency for browser regression tests. See [the architecture decision](docs/architecture.md). Default models, real providers, and hosting remain undecided. Application state, story memory, and model prompt/KV caches are separate concerns.

## Implementation roadmap

| Phase | Focus | Status | Release gate |
| --- | --- | --- | --- |
| 0 | Independent scaffold and documented stack | Complete | App runs locally and its own checks pass |
| 1 | Editor integrity, persistence validation, undo, cancellation | Complete for the local single-draft scope | Save/cancel, undo/reload, import safety, cancellation, stale ownership, and storage-failure scenarios pass automated checks |
| 2 | Immutable revisions and visual branches | Complete for the local branch workflow | Fork, compare, restore, migration, and export preserve independent histories; browser switching cannot accept stale completions |
| 3 | Approved, passage-linked story memory | Complete for the local baseline | Approval/evidence links, distant retrieval, branch/time/knowledge filtering, stale revalidation, context budgets, and persistence are tested |
| 4 | Bounded continuity review | Complete for the conservative local baseline | Findings cite evidence and patches require approval and valid preconditions |
| 5 | Evaluation, accessibility, and release polish | Complete for the local preview | Local journey, reproducible evaluation, axe audits, keyboard/reflow, recovery and release documentation pass; broader product research remains open |

Phase 6 in the blueprint is optional, evidence-driven expansion (for example, cross-device sync or collaboration), beyond the initial product described above. It has not started.

Generation currently uses a deterministic offline fixture. Node and browser tests verify branch switching, including switch-away-and-back during a running stream. Attention anchors do not yet exist and their remapping rules will be implemented with steering. Automatic merging, simultaneous collaboration, social features, multimedia generation, and foundation-model training are outside the initial scope.

## Validation and evaluation plan

Current checks cover import validation, branch isolation, revision ownership, cancellation, stale patches, persistence failures, recoverable partial streams, and the complete local writing journey. `npm run evaluate` reproduces 20 continuity and 10 memory fixtures and fails on an unreviewed baseline change. On this small synthetic continuity set: 6 true positives, 0 false positives, 4 false negatives, 10 true negatives (100% precision, 60% recall). All 6 emitted findings have exact citations; 10/10 memory inclusion cases match expectations. These are development fixtures, not general quality estimates.

Product evaluation should compare visual steering with a prompt-box baseline under comparable model and context budgets. Memory retrieval and continuity review should be measured separately, including false positives, wrong-branch leakage, and abstention. Benefits remain hypotheses until evaluated; historical prototype checks do not count as current results.

## Repository contents

```text
StoryFlow/
|-- index.html, styles.css           Writing studio interface
|-- src/app.js                       UI coordination and serialized saves
|-- src/domain.js                    Project validation and reversible editing
|-- src/history.js                   Immutable revision graph and branch rules
|-- src/cursor.js                    Exact word boundaries and validated story prefixes
|-- src/canvas.js                    Draggable/keyboard story cursor and canvas UI
|-- src/explorer.js                  Branch tree, revision inspection, and comparison UI
|-- src/memory.js                    Memory lifecycle, evidence, retrieval, and budgets
|-- src/memoryui.js                  Approval queue, evidence inspector, and context preview
|-- src/review.js                    Bounded review, citations, budgets, and patch validation
|-- src/reviewui.js                  Findings, approval, exceptions, and trace UI
|-- src/session.js                   Validated recovery snapshots and migration
|-- src/storage.js                   IndexedDB persistence
|-- src/generation.js                Request ownership and offline fixture
|-- server.mjs                       Loopback-only development server
|-- tests/                           Domain, HTTP, and browser regression checks
|-- playwright.config.js             Isolated browser regression configuration
|-- .github/workflows/checks.yml      Checks on main pushes and pull requests
|-- evaluation/                     Labelled synthetic cases, runner, and baseline report
|-- RELEASE_NOTES.md                 Local preview release scope and upgrade guidance
|-- docs/evaluation.md               Measured results and unperformed product research
|-- docs/accessibility.md            Automated evidence and manual follow-up
|-- docs/architecture.md             Initial stack decision and limitations
|-- VERIFICATION.md                  Executed checks and manual acceptance paths
|-- Story-Steer-Project-Handoff.pdf   Detailed implementation blueprint
`-- LICENSE                         MIT license
```

## Getting started

Clone the repository and read the blueprint:

```sh
git clone https://github.com/vishalgwu/StoryFlow.git
cd StoryFlow
```

Use Node.js 22 or newer. No dependency installation is needed.

```sh
npm start
```

Use **Write**, **Branches**, **Memory**, **Continuity**, and **Help** to navigate the panels. A keyboard skip link reaches the editor. Help includes the writing journey, shortcuts, privacy, and recovery guidance.

Open **http://127.0.0.1:4173** in a current browser with IndexedDB and Web Locks support. Use the server instead of opening `index.html` directly.

- Choose **Edit passage**, then **Save changes** to apply or **Cancel edit** to restore its original prose. Unapplied edits are checkpointed after a short pause and return after reload.
- **Save draft** applies the active paragraph edit and saves immediately. Title changes save automatically.
- **Undo** and **Redo** survive reload and create recovery revisions on the active branch. **Ctrl/Cmd+Enter** saves a paragraph, **Escape** cancels it, and **Ctrl/Cmd+S** saves the draft. Outside text editing, **Ctrl/Cmd+Z** and **Ctrl/Cmd+Shift+Z** navigate draft history.
- Stopped, failed, or interrupted sample output returns in the review panel. It requires an explicit action to add to the current draft. A new run asks before replacing recoverable text.
- **Retry saving** becomes available after a failed write. Export a backup while storage is unavailable.
- A second tab opens read-only while another tab owns the draft. Close the owner and reload the other tab to edit there.

Export a project JSON backup before clearing browser data or replacing a project. Export preserves the entire branch/revision graph; a visible unapplied edit becomes an export-only revision without changing the editor. If an edit cannot fit within the history limits, Export project backs up the committed graph and explicitly asks you to use **Export edit text** for the pending words. The separate sample panel still needs **Export sample text**. Import and **New project** keep one previous-project recovery copy for immediate Undo/Redo; that copy is replaced by the next project replacement and cleared by a prose, branch, memory, or review mutation.

### Smooth navigation and motion

v0.6.1 adds native smooth section navigation with a sticky active-section bar, readable writing typography, and an adaptive bottom action bar. Wheel and touch scrolling remain native. Fixed controls are measured so section headings and focused controls can scroll clear of them, including narrow screens and enlarged text. The writing bar becomes more compact when using supporting tools.

The circle moves using a short transform transition; pointer dragging remains immediate and its edge scrolling scales with elapsed frame time. Keyboard Home/End and Return cursor to end reveal the selected story position on long drafts. The OS **Reduce motion** preference disables animated travel and smooth scrolling. These are interaction improvements, not a measured frame-rate or universal device-performance guarantee.

### Write with the ⊕ story cursor

The writing canvas follows the dark, minimal, monospace direction of [Story Steer Studio](https://story-steer-studio-visha.vishalfulsundar2024.chatgpt.site/) ([reference source](https://github.com/vishalgwu/story-steer-studio)). It adapts the writing interaction onto StoryFlow's existing immutable history and recovery system; it does not import the reference's provider integrations or steering dials.

- Drag the ⊕ circle backward or forward to a word, or focus it and use Left/Right (Up/Down also work). Home selects the beginning; End, double-click, or **Return cursor to end** selects the end. Clicking a word also selects its boundary. Moving the cursor only changes the selection; later words dim without changing saved prose.
- Click the circle to open its menu, then **Write a passage here**, or use **⊕ Write here** directly. At an earlier point, StoryFlow atomically creates a **Cursor alternative** branch with the exact prefix and a blank new passage. Your original ending stays on its original branch. Type and use normal **Save changes** / **Cancel edit**; unapplied writing uses the existing reload recovery. Cancel leaves the blank passage; Undo can recover the preceding revision.
- **Generate next ↗** uses the offline sample engine. At an earlier point it creates the same safe prefix branch before preparing context and starting the existing stream. Generation cancellation/stale ownership checks and retained partial output still apply. If preparation fails, the prefix branch remains recoverable and the original is intact.
- Double-click prose or choose **Edit passage** to revise existing words. Finish or cancel the edit before moving the writing cursor. Cursor writing is disabled in read-only tabs and while a generation runs.
- Cursor selection is temporary and returns to the end after a revision, branch/project change, or reload. Its position is not portable export data; committed writing and alternative branches are.

Design reference: [Story Steer Studio](https://story-steer-studio-visha.vishalfulsundar2024.chatgpt.site/) and its [source repository](https://github.com/vishalgwu/story-steer-studio).

The circle is a continuation cursor, not a model-attention control. Live AI and tone/tension steering remain separate unfinished features. Existing Branches, Memory, Continuity, backups, and Help remain available below the writing canvas and through the section links.

### Explore branches and history

1. Enter a **Branch name** and choose **Fork current draft**. An empty name creates a unique Alternative name. The original branch remains unchanged.
2. Edit the new path and use **Active branch** or an **Open** button in the nested tree to switch paths. Save or cancel an unapplied paragraph edit first.
3. Choose a revision in **Revision history** to inspect its prose, timestamp, source, and restoration provenance. Offline-generated revisions also retain their operation ID and explicitly empty model/steering settings.
4. Use **Fork selected revision** to explore an earlier point. **Restore selected revision** creates a new revision on the current branch and keeps all intervening work. Restore and fork accept that branch's ancestors; sibling-only history is available for comparison rather than implicit restoration.
5. Choose any two revisions under **Compare two revisions**. Removed text is struck through, added text is underlined, and passage moves are labeled. Comparison is by stable paragraph identity, not a word-level diff or automatic merge.
6. To rename the active branch, enter a name and choose **Rename active branch**. Switch away before archiving it. **Reopen** makes an archived path available again without deleting its history.

Running output stays owned by its original branch. Switching away and back still makes it stale; adding a retained sample requires an explicit action on its original branch.

### Use evidence-backed story memory

1. Save your prose, then choose **Suggest facts from draft**. Up to 40 local candidates are proposed per run. They quote saved sentences; suggested categories and entity names need writer review.
2. Alternatively, choose an **Evidence passage**, select a quote in the saved passage, and choose **Propose selected evidence**. With no selection, the whole passage is used, up to 2,000 characters.
3. Use **Open evidence** to inspect the immutable source paragraph with the exact support highlighted. Expand the card to edit its claim, category, type, entities, narrative-time range, and character knowledge.
4. Choose **Approve memory**, **Dismiss memory**, or **Save proposal changes**. Saving changed fields resets approval to pending. Accepted plans and inferences are retained as separate records and are never authoritative continuation constraints. Only accepted facts can be locked.
5. Set a topic/entity query, a writer-assigned narrative time step, and an optional character viewpoint; blank viewpoint means reader. Time ranges include both endpoints. Unspecified character knowledge is unknown, not automatically shared.
6. Choose **Prepare context** to inspect facts included/excluded and why, source citations, recent prose excerpts, and the exact prepared context. The UTF-8 byte count is a conservative input-token estimate, not provider usage. Required instructions and eligible locked facts must fit the budget or the request is blocked.
7. **Generate next ↗ (offline sample)** captures that context. The offline fixture reuses the first included claim, or the original lighthouse sample if none is included. **Inspect sample context** shows the original snapshot even after later memory changes.

Changing a supporting paragraph marks its facts stale. **Revalidate evidence** links the unchanged quote to its current passage version and resets approval; approve again after review. If the quote is gone or ambiguous, select fresh evidence and propose a new record. Undoing prose to its original version can make that exact source current again.

A fork copies the current decision versions available at its selected revision. Later parent/sibling decisions do not leak into it. Child approval/dismissal changes only that branch. Historical forks walk earlier fact decisions when later decisions belong to later revisions. Decisions made at the same prose revision use the current decision at that revision; memory decisions do not create separate prose revisions.

Memory form fields are saved only by **Save proposal changes** or **Approve memory**. Up to 100 in-memory form drafts are retained during navigation/rerenders, including focus preservation; they are not reload recovery or export data. Prose undo/redo does not undo memory decisions; make another explicit memory decision to revise one.

### Review continuity

1. Save prose and approve its supporting memory facts. Open **Continuity review**, choose a revision, passage range, narrative time, and reader/character viewpoint. Historical revisions are inspectable; applying a patch requires the exact current branch head.
2. Set call, estimated-input-token, wall-time, and finding budgets, then start review. The local reviewer costs zero and makes no network calls. It checks only explicit possession and matching can/cannot conflicts; absence of findings does not establish consistency.
3. Inspect both immutable passages and the uncertainty explanation. Edit **Proposed replacement**, then choose **Apply patch**, **Dismiss finding**, or enter a reason and mark an intentional exception. Applying changes exactly one passage, records an audit revision, and supports Undo. Other findings from that old base become stale; rerun review after an edit.
4. Cancel at any time. Budget exhaustion retains partial findings that can still be approved if current. Canceled, failed, and interrupted runs retain inspectable findings but cannot apply them. Reload interrupts a running review without resuming it automatically. Writing and saving remain available during review.
5. Download the review trace for settings, IDs, operations, estimated usage, abstention counts, and exit reason. It excludes prose, evidence quotes, and replacement text; project exports retain the full review. Exceptions suppress only the exact finding signature on that branch and can be reconsidered. They are not inherited by forks.

Edited replacement/reason form drafts are session-only until a decision is saved. Review progress is checkpointed through the normal save queue. Starting a review clears the immediate previous-project undo backup, so export first for a durable backup. Input usage is a conservative byte-based estimate, not model billing. Relevant intervening context is bounded; excessive or ambiguous context leads to abstention.

```sh
npm run check
# Reproduce the evaluation separately:
npm run evaluate
# Or run only the regression suite:
npm test
```

To run the browser suite, install development dependencies and a test browser:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

Alternatively, set `STORYFLOW_BROWSER_CHANNEL=chrome` to use an installed Google Chrome. In PowerShell: `$env:STORYFLOW_BROWSER_CHANNEL='chrome'`. Browser tests start and stop their own server, so stop an existing `npm start` session first. The GitHub Actions workflow runs both suites using Chromium on Linux; local verification used Chrome on Windows.

The server is for local development and serves only application assets. It is not a production hosting or authentication service.

### Current limits

- One active draft per browser origin, with a Web Lock preventing concurrent editing in multiple tabs. Browsers without Web Locks open read-only.
- Each branch keeps up to 50 undo/redo action pointers. Immutable revisions and passage versions are not pruned. The old Phase 1 recovery format's 8 MB history budget applies only when reading legacy records.
- Project JSON is schema version 4, with limits of 20 MB, 50 branches, 5,000 revisions, 20,000 paragraph versions, 2,000 memory decision versions, and 500 current memory records per branch, 100 review runs, and 200 intentional exceptions. Each prose revision retains the 2 MB/200-paragraph/20,000-character limits. At a cap, mutation is refused without deleting history; export and use **New project** to continue separately.
- Schema-v1/v2/v3 imports are supported and migrated without inventing memory. Unknown fields, broken references, cycles, sibling ancestry leaks, altered evidence, duplicate IDs, and unsupported records are rejected before replacement.
- Import/New project require confirmation and retain one immediate project-replacement undo copy. This backup can add another 20 MB to browser storage, but is not included in portable exports. Export first for a durable backup.
- Checkpoints are periodic, not a guarantee against losing the latest keystroke or streamed word during a crash. Wait for the saved indicator or export before closing. Starting a new run replaces the saved sample panel after confirmation when needed.
- Storage failures are surfaced; if stored data cannot be restored, saving is disabled to avoid overwriting it. Export any new work before closing.
- Browser storage may be evicted. There is no cross-device sync, hosted backend, service-worker offline reload guarantee, or paid/live model integration.
- Local extraction does not verify truth or reliably resolve negation, pronouns, aliases, narrative time, or who knows a fact. Writers set those fields. Learned embeddings, model-based extraction, and claims of retrieval/continuity improvement remain future work.
- Knowledge filtering applies to retrieved memory; recent source prose is still story context and is not semantically redacted. Locking does not override branch, time, or knowledge eligibility. No live model adherence guarantee is claimed.

## License

This project is licensed under the [MIT License](LICENSE).
