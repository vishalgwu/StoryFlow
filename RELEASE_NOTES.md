# v0.6.1 — smoother navigation and writing controls

- Native smooth section navigation, persistent section links, and an active-section indicator.
- Dynamic spacing for the bottom writing bar/footer so focused controls and section headings remain clear; a compact bar while working in supporting panels.
- Refined writing typography, title hierarchy, button feedback, panel borders, and scrollbars.
- Cached word spans, fewer duplicate cursor layout operations, transform-based travel, and one cursor drag update per animation frame. Drag-edge scrolling scales with elapsed frame time.
- Long-story keyboard cursor positions scroll into view. Reduced-motion preferences disable animated scrolling and cursor travel. Native wheel/touch scrolling is preserved.

Validation: 64 Node tests, 30 evaluation cases, and 46 browser scenarios, including new checks for bidirectional navigation/wheel input, reduced motion, long-story cursor visibility, and narrow dock clearance. No schema, provider, or story-content changes are introduced. Smoothness varies by browser/hardware; no measured FPS claim is made.

---

# v0.6.0 — the story is the writing surface

A dark, minimal, monospace canvas inspired by the supplied Story Steer Studio reference. Move the ⊕ cursor backward or forward through the words, return to the end, and write a whole story a passage at a time. Writing/generating at an earlier point creates an alternative and preserves the previous ending. New writing uses the existing checkpointed paragraph editor, rather than a separate unprotected draft field.

The circle supports pointer dragging, edge scrolling, keyboard arrows/Home/End, click-to-open writing actions, and double-click-to-end. Read-only/editing/generation guards remain enforced. Existing memory, continuity, revisions, export/import, and offline generation remain available. No live AI or prompt-steering controls are added in this UI release.

Validation: 64 Node tests, 30 evaluation cases, and 43 browser scenarios. Existing schema 4 and storage origin are unchanged; export a backup before clearing browser data. Cursor selection is temporary; committed writing and branches persist. See README and VERIFICATION for controls and limitations.

---

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

When enlarged text or a short window makes fixed bars consume too much of the viewport, navigation and writing controls move into normal document flow so they cannot trap or cover the content. This fallback is recalculated on resize.
