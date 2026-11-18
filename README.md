# StoryFlow

An explainable narrative studio that helps writers steer AI-generated stories, explore alternative story paths, and inspect the evidence behind story memory and continuity suggestions.

The writer retains final authority over the prose and the facts of the story.

## Current status

**Phase 1 complete: reliable local editor.** The editor supports explicit paragraph save/cancel, browser recovery for unapplied edits and partial continuations, persistent bounded undo/redo, validated import/export, storage-failure recovery, and protection against stale responses and conflicting tabs. See [verification](VERIFICATION.md) for acceptance evidence and limitations.

Visual branches, story memory, continuity review, steering controls, and real model providers remain planned. The continuation demo returns a fixed, explicitly labeled sample and makes no AI service calls.

### Progress checkpoint

**Phases 0 and 1 are complete for the initial browser-only, single-draft scope. The next milestone is Phase 2: immutable revision history and visual branches.** Progress is tracked by the acceptance gates below. The previous 10–15% estimate described the earlier first slice; there is no measured whole-project completion percentage. The branch, memory, reviewer, real AI, steering, and evaluation systems remain ahead.

What works now:

- A runnable local writing studio with a documented stack and separate UI, domain, storage, and generation modules.
- One active draft with title/paragraph editing, stable paragraph IDs, IndexedDB autosave, and explicit save status.
- Explicit paragraph save/cancel, recovery checkpoints for unapplied edits, and undo/redo that survives reload within a bounded history budget.
- Versioned, size-bounded JSON import/export with validation, replacement confirmation, and migration of the original browser draft format.
- A streamed offline sample with cancellation, checkpointed partial/stale output, and project/branch/revision ownership checks. Interrupted output is restored as a proposal, never automatically appended.
- Retryable save errors, preservation of unreadable stored data, and a single-tab editing lock.
- Twelve passing Node regression tests and ten passing automated browser scenarios in local Chrome, plus a CI workflow. See [verification](VERIFICATION.md) for exact coverage and environment limits.

Next, replace the bounded recovery history with an immutable revision graph and implement branch creation, switching, comparison, and restore in Phase 2. Real model integration and visual steering still need implementation before the intended AI-writing workflow can be demonstrated end to end.

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
| 2 | Immutable revisions and visual branches | Not started | Fork, compare, restore, and export preserve independent histories |
| 3 | Approved, passage-linked story memory | Not started | Relevant facts are retrieved; wrong-branch facts are excluded; stale evidence is visible |
| 4 | Bounded continuity review | Not started | Findings cite evidence and patches require approval and valid preconditions |
| 5 | Evaluation, accessibility, and release polish | Not started | The main writing journey works end to end and claims match measured results |

Phase 6 in the blueprint is optional, evidence-driven expansion (for example, cross-device sync or collaboration), beyond the initial product described above. It has not started and is excluded from the rough progress estimate.

Phase 1 uses a deterministic offline fixture. Branch switching is verified at the operation-ownership boundary in Node tests; browser branch-switch acceptance belongs to Phase 2 once branches exist. Attention anchors do not yet exist and their remapping rules will be implemented with steering. Simultaneous collaboration, social features, multimedia generation, and foundation-model training are outside the initial scope.

## Validation and evaluation plan

Future checks should cover import validation, branch isolation, revision ownership, cancellation, stale patches, persistence failures, and recoverable partial streams. Controlled provider fixtures should make regression tests reproducible without paid inference.

Product evaluation should compare visual steering with a prompt-box baseline under comparable model and context budgets. Memory retrieval and continuity review should be measured separately, including false positives, wrong-branch leakage, and abstention. Benefits remain hypotheses until evaluated; historical prototype checks do not count as current results.

## Repository contents

```text
StoryFlow/
|-- index.html, styles.css           Writing studio interface
|-- src/app.js                       UI coordination and serialized saves
|-- src/domain.js                    Project validation and reversible editing
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
- **Undo** and **Redo** survive reload within the recovery-history budget. **Ctrl/Cmd+Enter** saves a paragraph, **Escape** cancels it, and **Ctrl/Cmd+S** saves the draft. Outside text editing, **Ctrl/Cmd+Z** and **Ctrl/Cmd+Shift+Z** navigate draft history.
- Stopped, failed, or interrupted sample output returns in the review panel. It requires an explicit action to add to the current draft. A new run asks before replacing recoverable text.
- **Retry saving** becomes available after a failed write. Export a backup while storage is unavailable.
- A second tab opens read-only while another tab owns the draft. Close the owner and reload the other tab to edit there.

Export a project JSON backup before clearing browser data or replacing a draft. Export includes a visible unapplied paragraph edit, but not undo history or the separate sample panel; use **Export sample text** for that panel.

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
- Undo/redo retains up to 50 prior edits with an 8 MB combined history budget. Older recovery steps are pruned for large projects. This is recoverable editor history, not the immutable branch graph planned for Phase 2.
- Project JSON is schema version 1, at most 2 MB, with up to 200 paragraphs of 20,000 characters each. Unsupported fields and malformed records are rejected before replacement.
- Imports require confirmation and can be undone within retained history. Export the current draft first for a durable backup.
- Checkpoints are periodic, not a guarantee against losing the latest keystroke or streamed word during a crash. Wait for the saved indicator or export before closing. Starting a new run replaces the saved sample panel after confirmation when needed.
- Storage failures are surfaced; if stored data cannot be restored, saving is disabled to avoid overwriting it. Export any new work before closing.
- Browser storage may be evicted. There is no cross-device sync, hosted backend, service-worker offline reload guarantee, or paid/live model integration.

## License

This project is licensed under the [MIT License](LICENSE).
