import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { BranchEditor } from '../src/history.js';
import { assembleContext } from '../src/memory.js';

const cases = JSON.parse(await readFile(new URL('./cases.json', import.meta.url), 'utf8'));
function sourceStory(text) {
  const editor = new BranchEditor();
  editor.edit('Synthetic evaluation', editor.project.paragraphs.map(p => ({ ...p, text })));
  return editor;
}
function propose(editor, text) {
  const revision = editor.workspace.revisions.find(r => r.id === editor.branch.headRevisionId);
  return editor.proposeFact({ paragraphVersionId: revision.paragraphVersionIds[0], start: 0, end: text.length, claim: text, entities: ['Elara'] });
}
const continuity = [];
for (const sample of cases.continuity) {
  const editor = sourceStory(sample.source), factId = propose(editor, sample.source);
  editor.updateFact(factId, {}, 'accepted');
  for (const text of sample.between || []) editor.append(text);
  editor.append(sample.target);
  const original = editor.project, id = editor.startReview({}, 1000);
  let run;
  for (let step = 1; step <= 100; step++) {
    editor.advanceReview(id, 1000 + step);
    run = editor.workspace.reviewRuns.find(r => r.id === id);
    if (run.status !== 'running') break;
  }
  assert.notEqual(run.status, 'running');
  assert.deepEqual(editor.project, original, 'Evaluation must never apply repairs');
  const detected = run.findings.length > 0;
  const citationsValid = run.findings.every(f => [f.sourceEvidence, f.targetEvidence].every(e => {
    const passage = editor.workspace.paragraphVersions.find(p => p.id === e.paragraphVersionId);
    return passage?.text.slice(e.start, e.end) === e.quote;
  }));
  continuity.push({ id: sample.id, expectedConflict: sample.conflict, detected, citationsValid, abstained: !detected,
    toolCalls: run.counters.toolCalls, estimatedInputTokens: run.counters.estimatedTokens, actualCost: run.counters.actualCost });
}
const memory = [];
for (const sample of cases.memory) {
  const text = 'Elara lost the key.', editor = sourceStory(text), originalBranch = editor.branch.id;
  if (sample.sibling) editor.fork('Sibling');
  const proposed = propose(editor, text);
  const factId = editor.updateFact(proposed, { validFrom: 2, validUntil: 4, knowledge: [{ character: 'Elara', state: 'knows' }] }, sample.status || 'accepted');
  if (sample.sibling) editor.switchBranch(originalBranch);
  if (sample.stale) editor.edit(editor.project.title, editor.project.paragraphs.map(p => ({ ...p, text: 'Elara left the room.' })));
  for (let i = 0; i < (sample.distance || 0); i++) editor.append(`Unrelated passage ${i + 1}: rain covered the road.`);
  const context = assembleContext(editor.workspace, { query: sample.query, narrativeTime: sample.time ?? 3, viewpoint: sample.viewpoint || '', budget: 4096 });
  const included = context.included.some(item => item.factId === factId);
  memory.push({ id: sample.id, expectedIncluded: sample.expected, included, passed: included === sample.expected });
}
const tp = continuity.filter(c => c.expectedConflict && c.detected).length;
const fp = continuity.filter(c => !c.expectedConflict && c.detected).length;
const fn = continuity.filter(c => c.expectedConflict && !c.detected).length;
const tn = continuity.filter(c => !c.expectedConflict && !c.detected).length;
const report = {
  benchmark: 'StoryFlow synthetic local baseline v1',
  limitations: 'Author-labelled development fixtures, not held-out stories or a user study. No live model, steering comparison, general accuracy, or latency claim. Abstention includes safe negatives and unsupported conflicts.',
  continuity: { cases: continuity.length, truePositives: tp, falsePositives: fp, falseNegatives: fn, trueNegatives: tn,
    precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null,
    abstentionRate: (fn + tn) / continuity.length, citationValidity: continuity.every(c => c.citationsValid), actualCost: 0, results: continuity },
  memory: { cases: memory.length, passed: memory.filter(c => c.passed).length, results: memory }
};
const baseline = new URL('./baseline.json', import.meta.url);
if (!process.argv.includes('--write')) assert.deepEqual(report, JSON.parse(await readFile(baseline, 'utf8')), 'Evaluation changed: inspect outcomes before intentionally updating the baseline');
assert.equal(fp, 0, 'No false positives allowed on the labelled safe cases');
assert.equal(report.memory.passed, memory.length, 'Memory eligibility or retrieval regression');
assert.ok(report.continuity.citationValidity, 'Every finding needs exact citations');
if (process.argv.includes('--write')) await writeFile(baseline, JSON.stringify(report, null, 2) + '\n');
console.log(`Continuity: ${tp} TP, ${fp} FP, ${fn} FN, ${tn} TN; precision ${report.continuity.precision}, recall ${report.continuity.recall}; exact citations ${report.continuity.citationValidity}. Memory: ${report.memory.passed}/${memory.length}. Cost: $0.`);
