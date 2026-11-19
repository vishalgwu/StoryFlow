# v0.5.0 — evaluated local preview

Phase 5 completes the documented **local preview** release gate: reproducible baseline evaluation, automated accessibility checks, keyboard/reflow fixes, in-app guidance, and one complete writing-to-backup acceptance journey. The intended live AI and visual-steering product is not yet complete.

- Added Write/Branches/Memory/Continuity/Help navigation and a keyboard skip link.
- Added keyboard/recovery/privacy help and explicit local-preview limitations.
- Preserved focus after dynamic decisions and made scrolling text panels keyboard-accessible.
- Fixed enlarged headings overflowing narrow screens; improved touch targets and forced-colors focus.
- Added a 30-case reproducible evaluation with honest reporting of four unsupported-language misses.
- Added axe audits, keyboard/reflow checks, and an edit → branch → approve memory → offline continuation → continuity repair → reload → export/import → original-branch acceptance scenario.
- CI retains accessibility JSON and browser screenshots as short-lived evidence.

## Validation

`npm run check` runs syntax checks, 59 Node regression tests, and the 30-case evaluation. `npm run test:browser` runs 38 browser scenarios. `npm ci` installs the pinned development tools; the application itself still has no runtime dependencies or build step. See `VERIFICATION.md`, `docs/evaluation.md`, and `docs/accessibility.md` for exact evidence and limits.

## Upgrade and backup

No new project schema is introduced: schema 4 remains current, and schemas 1–3 migrate as before. Export a project backup before clearing browser data or replacing a project. Run the app through `npm start` on the same browser origin to retain existing local data. Unsaved memory/repair form drafts are session-only. Browser storage is not cross-device sync.

## Remaining product work

Live provider adapters, visual steering/attention anchors, learned retrieval, held-out quality evaluation, writer studies, and manual assistive-technology testing remain open. This preview makes no general continuity-accuracy, writing-quality, model-adherence, WCAG-conformance, or production-hosting claim.
