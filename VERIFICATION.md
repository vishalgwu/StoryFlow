# Phase 1: reliable local editor — verification

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
