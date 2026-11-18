# StoryFlow

An explainable narrative studio that helps writers steer AI-generated stories, explore alternative story paths, and inspect the evidence behind story memory and continuity suggestions.

The writer retains final authority over the prose and the facts of the story.

## Current status

**First foundation slice implemented.** A browser editor now supports a single locally saved draft, paragraph editing, session undo/redo, validated project import/export, and a streamed offline continuation fixture with cancellation and stale-response protection. See [verification](VERIFICATION.md) for checks and limitations.

Visual branches, story memory, continuity review, steering controls, and real model providers remain planned. The continuation demo returns a fixed, explicitly labeled sample and makes no AI service calls.

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

The initial implementation uses browser-native JavaScript modules, HTML/CSS, IndexedDB, and Node's built-in HTTP server and test runner. It has no runtime npm dependencies and no build step. This keeps the first editor slice small and makes its domain rules testable independently of the UI. See [the architecture decision](docs/architecture.md). Default models, real providers, and hosting remain undecided. Application state, story memory, and model prompt/KV caches are separate concerns.

## Implementation roadmap

| Phase | Focus | Release gate |
| --- | --- | --- |
| 0 | Independent scaffold and documented stack | App runs locally and its own checks pass |
| 1 | Editor integrity, persistence validation, undo, cancellation | Edits and drafts survive reloads and stale responses |
| 2 | Immutable revisions and visual branches | Fork, compare, restore, and export preserve independent histories |
| 3 | Approved, passage-linked story memory | Relevant facts are retrieved; wrong-branch facts are excluded; stale evidence is visible |
| 4 | Bounded continuity review | Findings cite evidence and patches require approval and valid preconditions |
| 5 | Evaluation, accessibility, and release polish | The main writing journey works end to end and claims match measured results |

The first implementation slice should deliver an editable saved draft, safe import boundaries, undo, and generation ownership using a deterministic model fixture. Simultaneous collaboration, social features, multimedia generation, and foundation-model training are outside the initial scope.

## Validation and evaluation plan

Future checks should cover import validation, branch isolation, revision ownership, cancellation, stale patches, persistence failures, and recoverable partial streams. Controlled provider fixtures should make regression tests reproducible without paid inference.

Product evaluation should compare visual steering with a prompt-box baseline under comparable model and context budgets. Memory retrieval and continuity review should be measured separately, including false positives, wrong-branch leakage, and abstention. Benefits remain hypotheses until evaluated; historical prototype checks do not count as current results.

## Repository contents

```text
StoryFlow/
|-- index.html, styles.css           Writing studio interface
|-- src/app.js                       UI coordination and serialized saves
|-- src/domain.js                    Project validation and reversible editing
|-- src/storage.js                   IndexedDB persistence
|-- src/generation.js                Request ownership and offline fixture
|-- server.mjs                       Loopback-only development server
|-- tests/                          Domain and HTTP regression checks
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

Open **http://127.0.0.1:4173** in a current browser. Use the server instead of opening `index.html` directly. Drafts save automatically after a short pause; **Save draft** also saves immediately. **Undo** and **Redo** apply within the current session. Export a project JSON backup before clearing browser data or replacing a draft.

```sh
npm run check
# Or run only the regression suite:
npm test
```

The server is for local development and serves only application assets. It is not a production hosting or authentication service.

### Current limits

- One active draft per browser origin; concurrent editing in multiple tabs is not supported.
- Undo/redo retains up to 50 prior edits in memory and resets on reload. Persistent revision history is a later milestone.
- Project JSON is schema version 1, at most 2 MB, with up to 200 paragraphs of 20,000 characters each. Unsupported fields and malformed records are rejected before replacement.
- Imports require confirmation and can be undone during the session. Export the current draft first for a durable backup.
- Stopped or stale continuation text stays in the review panel until the next run or reload. Export that text to preserve it.
- Storage failures are surfaced; if stored data cannot be restored, saving is disabled to avoid overwriting it. Export any new work before closing.
- Browser storage may be evicted. There is no cross-device sync, hosted backend, service-worker offline reload guarantee, or paid/live model integration.

## License

This project is licensed under the [MIT License](LICENSE).
