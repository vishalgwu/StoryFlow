# StoryFlow

An explainable narrative studio that helps writers steer AI-generated stories, explore alternative story paths, and inspect the evidence behind story memory and continuity suggestions.

The writer retains final authority over the prose and the facts of the story.

## Current status

**Planning stage.** This repository contains the project introduction, implementation blueprint, and MIT license. There is no application code, runnable demo, or test suite yet.

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

The framework, default model, supported provider set, and hosting platform have not been selected. Browser inference, local models, and user-configured remote endpoints are options to evaluate. Application state, story memory, and model prompt/KV caches are separate concerns.

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
|-- README.md                        Project overview and current status
|-- Story-Steer-Project-Handoff.pdf   Detailed implementation blueprint
|-- LICENSE                          MIT license
|-- .gitattributes                   Binary handling for PDF documents
`-- .gitignore                       Initial ignore rules
```

## Getting started

Clone the repository and read the blueprint:

```sh
git clone https://github.com/vishalgwu/StoryFlow.git
cd StoryFlow
```

There are no install, development-server, or test commands yet. Those instructions will be added when the application stack and first working slice are implemented.

## License

This project is licensed under the [MIT License](LICENSE).
