# First editor slice: verification

## Scope

This record covers the first foundation/editor slice in this repository. It does not inherit any checks or implementation from the earlier prototype described in the blueprint.

## Automated checks

`npm run check` passes syntax checks and all **7 Node regression tests** on Node.js 24.14.1:

- Stable passage identity and reversible edits with fresh operation ownership.
- Import/export schema round trip; malformed JSON, null paragraphs, duplicate IDs, oversized inputs, and credential-bearing fields rejected.
- Invalid mutations leave the current draft and history untouched.
- Successful generation commits once and can be undone.
- Editing and undoing invalidate a delayed generation, even if the prose returns to its initial value.
- Project/branch ownership changes, cancellation, and supersession prevent stale commits.
- The local HTTP server serves application assets and refuses Git metadata and other repository files.

Loopback HTTP checks need permission to connect to the local test server in restricted execution environments. The initial sandbox attempt was blocked by that network restriction; rerunning with loopback access passed.

## Manual browser checks

Checked against the running application at `http://127.0.0.1:4173` using the in-app browser:

- Changed the title, saved, and reloaded: the title was restored from IndexedDB.
- Edited a paragraph during the offline stream: the edited draft remained intact and the completion appeared separately as stale output.
- Used Undo and Redo: the previous and edited prose were restored correctly.
- Stopped a stream: partial text remained visible in the recoverable-sample panel.
- Completed an uninterrupted sample: a new passage appeared and Undo remained available.
- Exported project JSON successfully.
- Imported `tests/fixtures/invalid-project.json`: an error appeared and the existing draft remained intact.
- Imported `tests/fixtures/valid-project.json`: confirmation appeared, the fixture loaded, and Undo restored the previous project.
- Inspected the narrow-screen writing layout: controls and passages remain available in a single column.

## Limits and remaining checks

The browser checks above are manual, not a persistent automated browser suite. Full storage quota/failure simulation, cross-browser coverage, broad keyboard/accessibility auditing, and load testing are still pending. The code protects failed restore paths from overwriting stored records, but that failure path has not been fault-injected in the browser.

There is no real provider, WebGPU/model download, deployed site, persistent revision graph, branch UI, memory extraction, or continuity reviewer. Partial samples and undo history are session-only. One browser tab should edit the active draft at a time. No performance, AI quality, or user-study claims are established by this milestone.
