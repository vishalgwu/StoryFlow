# Local baseline evaluation — v0.5.0

Run `npm run evaluate` (also included in `npm run check`). The runner uses the real revision, memory, context, and review modules with 30 synthetic, author-labelled cases in `evaluation/cases.json`. The committed per-case result is `evaluation/baseline.json`. A changed outcome fails the check; inspect the cause before intentionally regenerating it with `node evaluation/run.mjs --write`. There are no network calls or paid inference. UUIDs are excluded from the report so it is reproducible.

## Results

| Continuity measure | Result |
| --- | --- |
| Labelled conflicts | 10 |
| Labelled safe cases | 10 |
| True positives / false positives | 6 / 0 |
| False negatives / true negatives | 4 / 10 |
| Precision on this set | 6/6 = 100% |
| Recall on this set | 6/10 = 60% |
| No-finding rate | 14/20 = 70% |
| Exact citations on emitted findings | 6/6 valid |
| Cost | $0 |

The no-finding rate includes both safe negatives and missed conflicts, rather than implying every abstention is correct. The four misses cover pronouns, paraphrases, world rules, and aliases. These are retained as known limitations instead of hiding them by testing only the supported grammar. Positive cases cover possession and can/cannot; safe cases cover recovery, dialogue, time shifts, uncertainty, different subjects/objects/conditions, state-changing events, and unrelated prose. Review never applies a patch during evaluation.

All **10 memory cases** match their expected inclusion decisions: distant entity retrieval after 30 intervening passages, object keyword retrieval, pending/dismissed exclusion, stale evidence, inclusive time bounds, known/unknown character viewpoint, and sibling exclusion. These are eligibility/retrieval fixtures with one candidate fact each; they do not measure ranking quality, semantic relevance precision, or learned retrieval performance. Existing regression tests additionally cover context budgets, locked facts, and branch history.

## Interpretation and outstanding product evaluation

These development fixtures are small, synthetic, and known during implementation. They are not held-out fiction, a user study, or evidence of general continuity accuracy. Zero false positives here does not predict zero false positives in real stories. No claim of latency, model adherence, writing-quality improvement, or WCAG certification follows from this benchmark.

Before a live AI product release, build a separately labelled held-out story set including ambiguous chronology, dialogue, aliases, state changes, and multiple viewpoints. Measure retrieval precision/recall, continuity precision/recall and abstention, citation correctness, branch leakage, latency, and cost separately. Compare visual steering with a prompt-box baseline using the same model and context/cost budget only after both exist. Recruit representative writers for task success, recovery, keyboard/screen-reader usability, and perceived control. Record methods, sample sizes, failures, and uncertainty. Those experiments remain unperformed; v0.5.0 is a local preview release.
