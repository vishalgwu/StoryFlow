# StoryFlow

An explainable narrative studio that helps writers steer AI-generated stories, explore alternative story paths, and inspect the evidence behind story memory and continuity suggestions.

The writer retains final authority over the prose and the facts of the story.

## Current status

**Phase 2 complete: immutable history and visual branches.** The local editor now includes a branch tree/list, independent story paths, revision inspection and comparison, safe restore, archive/reopen, and exports that preserve the full history graph. Phase 1 editing, recovery, validation, and storage-failure safeguards remain in place. See [verification](VERIFICATION.md) for acceptance evidence and limitations.

Story memory, continuity review, steering controls, and real model providers remain planned. The continuation demo returns a fixed, explicitly labeled sample and makes no AI service calls.

### Progress checkpoint

**Phases 0–2 are complete for the browser-only foundation and branch workflow. The next milestone is Phase 3: evidence-backed story memory.** Progress is tracked by acceptance gates; there is no measured whole-project completion percentage. Memory, continuity review, real AI, steering, and evaluation remain ahead.

What works now:

- A runnable local writing studio with a documented stack and separate UI, domain, storage, and generation modules.
- One active project with multiple independent branches, title/paragraph editing, stable paragraph IDs, IndexedDB autosave, and explicit save status.
- Explicit paragraph save/cancel, recovery checkpoints for unapplied edits, and branch-local undo/redo that appends immutable recovery revisions and survives reload.
- Named branches, nested visual/list exploration, fork from an earlier revision, revision comparison, and recoverable restore. Archived branches keep their history and can be reopened.
- Schema-v2 exports preserve revisions, paragraph versions, fork origins, branch heads, archive states, and recovery pointers. Schema-v1 projects and Phase 1 browser records migrate automatically.
- A streamed offline sample with cancellation, checkpointed partial/stale output, and project/branch/revision ownership checks. Interrupted output is restored as a proposal, never automatically appended.
- Retryable save errors, preservation of unreadable stored data, and a single-tab editing lock.
- Twenty-four passing Node regression tests and sixteen automated browser acceptance scenarios, plus a CI workflow. See [verification](VERIFICATION.md) for exact results and environment limits.

Next, add proposed facts linked to immutable source passages, writer approval, and retrieval filtered by branch ancestry in Phase 3. Real model integration and visual steering still need implementation before the intended AI-writing workflow can be demonstrated end to end.

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

Review a selected chapter against relevant accepted facts. Findings will cite source passages, explain uncertainty, and optionally propose minimal edits.

The writer can accept, edit, dismiss, or mark a finding as an intentional exception. Proposed edits require approval and must match the current source text before application. Reviews will have explicit cancellation and resource budgets.

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
| 3 | Approved, passage-linked story memory | Not started | Relevant facts are retrieved; wrong-branch facts are excluded; stale evidence is visible |
| 4 | Bounded continuity review | Not started | Findings cite evidence and patches require approval and valid preconditions |
| 5 | Evaluation, accessibility, and release polish | Not started | The main writing journey works end to end and claims match measured results |

Phase 6 in the blueprint is optional, evidence-driven expansion (for example, cross-device sync or collaboration), beyond the initial product described above. It has not started.

Generation currently uses a deterministic offline fixture. Node and browser tests verify branch switching, including switch-away-and-back during a running stream. Attention anchors do not yet exist and their remapping rules will be implemented with steering. Automatic merging, simultaneous collaboration, social features, multimedia generation, and foundation-model training are outside the initial scope.

## Validation and evaluation plan

Future checks should cover import validation, branch isolation, revision ownership, cancellation, stale patches, persistence failures, and recoverable partial streams. Controlled provider fixtures should make regression tests reproducible without paid inference.

Product evaluation should compare visual steering with a prompt-box baseline under comparable model and context budgets. Memory retrieval and continuity review should be measured separately, including false positives, wrong-branch leakage, and abstention. Benefits remain hypotheses until evaluated; historical prototype checks do not count as current results.

## Repository contents

```text
StoryFlow/
|-- index.html, styles.css           Writing studio interface
|-- src/app.js                       UI coordination and serialized saves
|-- src/domain.js                    Project validation and reversible editing
|-- src/history.js                   Immutable revision graph and branch rules
|-- src/explorer.js                  Branch tree, revision inspection, and comparison UI
|-- src/session.js                   Validated recovery snapshots and migration
|-- src/storage.js                   IndexedDB persistence
|-- src/generation.js                Request ownership and offline fixture
|-- server.mjs                       Loopback-only development server
|-- tests/                           Domain, HTTP, and browser regression checks
|-- playwright.config.js             Isolated browser regression configuration
|-- .github/workflows/checks.yml      Checks on main pushes and pull requests
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

Open **http://127.0.0.1:4173** in a current browser with IndexedDB and Web Locks support. Use the server instead of opening `index.html` directly.

- Choose **Edit passage**, then **Save changes** to apply or **Cancel edit** to restore its original prose. Unapplied edits are checkpointed after a short pause and return after reload.
- **Save draft** applies the active paragraph edit and saves immediately. Title changes save automatically.
- **Undo** and **Redo** survive reload and create recovery revisions on the active branch. **Ctrl/Cmd+Enter** saves a paragraph, **Escape** cancels it, and **Ctrl/Cmd+S** saves the draft. Outside text editing, **Ctrl/Cmd+Z** and **Ctrl/Cmd+Shift+Z** navigate draft history.
- Stopped, failed, or interrupted sample output returns in the review panel. It requires an explicit action to add to the current draft. A new run asks before replacing recoverable text.
- **Retry saving** becomes available after a failed write. Export a backup while storage is unavailable.
- A second tab opens read-only while another tab owns the draft. Close the owner and reload the other tab to edit there.

Export a project JSON backup before clearing browser data or replacing a project. Export preserves the entire branch/revision graph; a visible unapplied edit becomes an export-only revision without changing the editor. If an edit cannot fit within the history limits, Export project backs up the committed graph and explicitly asks you to use **Export edit text** for the pending words. The separate sample panel still needs **Export sample text**. Import and **New project** keep one previous-project recovery copy for immediate Undo/Redo; that copy is replaced by the next project replacement and cleared by an edit or branch mutation.

### Explore branches and history

1. Enter a **Branch name** and choose **Fork current draft**. An empty name creates a unique Alternative name. The original branch remains unchanged.
2. Edit the new path and use **Active branch** or an **Open** button in the nested tree to switch paths. Save or cancel an unapplied paragraph edit first.
3. Choose a revision in **Revision history** to inspect its prose, timestamp, source, and restoration provenance. Offline-generated revisions also retain their operation ID and explicitly empty model/steering settings.
4. Use **Fork selected revision** to explore an earlier point. **Restore selected revision** creates a new revision on the current branch and keeps all intervening work. Restore and fork accept that branch's ancestors; sibling-only history is available for comparison rather than implicit restoration.
5. Choose any two revisions under **Compare two revisions**. Removed text is struck through, added text is underlined, and passage moves are labeled. Comparison is by stable paragraph identity, not a word-level diff or automatic merge.
6. To rename the active branch, enter a name and choose **Rename active branch**. Switch away before archiving it. **Reopen** makes an archived path available again without deleting its history.

Running output stays owned by its original branch. Switching away and back still makes it stale; adding a retained sample requires an explicit action on its original branch.

```sh
npm run check
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
- Project JSON is schema version 2, with limits of 20 MB, 50 branches, 5,000 revisions, and 20,000 paragraph versions. Each revision retains the 2 MB draft budget with up to 200 paragraphs of 20,000 characters each. At a limit, the attempted mutation is refused without deleting history; export and use **New project** to continue separately.
- Schema-v1 imports are still supported and migrated. Unknown fields, broken references, cycles, sibling ancestry leaks, duplicate IDs, and unsupported records are rejected before replacement.
- Import/New project require confirmation and retain one immediate project-replacement undo copy. This backup can add another 20 MB to browser storage, but is not included in portable exports. Export first for a durable backup.
- Checkpoints are periodic, not a guarantee against losing the latest keystroke or streamed word during a crash. Wait for the saved indicator or export before closing. Starting a new run replaces the saved sample panel after confirmation when needed.
- Storage failures are surfaced; if stored data cannot be restored, saving is disabled to avoid overwriting it. Export any new work before closing.
- Browser storage may be evicted. There is no cross-device sync, hosted backend, service-worker offline reload guarantee, or paid/live model integration.

## License

This project is licensed under the [MIT License](LICENSE).
