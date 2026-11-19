import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchEditor, validateWorkspace, parseWorkspace } from '../src/history.js';
import { findingStaleReason, reviewTrace, ReviewController } from '../src/review.js';
import { snapshot, restoreSession } from '../src/session.js';
import { Generation } from '../src/generation.js';
import { assembleContext } from '../src/memory.js';
function story(source = 'Elara lost the key.', targets = ['Elara carries the key.']) {
  const editor = new BranchEditor(); editor.edit('Continuity fixture', editor.project.paragraphs.map(p => ({ ...p, text: source })));
  const head = editor.workspace.revisions.find(r => r.id === editor.branch.headRevisionId), version = editor.workspace.paragraphVersions.find(p => p.id === head.paragraphVersionIds[0]);
  const fact = editor.proposeFact({ paragraphVersionId: version.id, start: 0, end: source.length, claim: source, category: 'event', entities: ['Elara'] });
  editor.updateFact(fact, {}, 'accepted'); targets.forEach(text => editor.append(text)); return editor;
}
function finish(editor, options = {}) {
  const id = editor.startReview(options, 1000);
  for (let i = 1; i < 1000 && editor.workspace.reviewRuns.find(r => r.id === id).status === 'running'; i++) editor.advanceReview(id, 1000 + i);
  return editor.workspace.reviewRuns.find(r => r.id === id);
}

test('bounded review cites both immutable passages and never changes prose automatically', () => {
  const editor = story(), before = editor.project, epoch = editor.epoch, run = finish(editor);
  assert.equal(run.status, 'findings_ready'); assert.equal(run.findings.length, 1);
  assert.equal(run.findings[0].sourceEvidence.quote, 'Elara lost the key.'); assert.equal(run.findings[0].targetEvidence.quote, 'Elara carries the key.');
  assert.equal(run.findings[0].patch.replacement, 'Elara does not carry the key.');
  assert.equal(run.counters.actualCost, 0); assert.equal(run.counters.toolCalls, 4);
  assert.deepEqual(editor.project, before); assert.equal(editor.epoch, epoch);
});
test('approved edited patch is atomic, audited, undoable, and cannot apply twice', () => {
  const editor = story(), run = finish(editor), finding = run.findings[0], original = editor.project.paragraphs[1].text;
  editor.applyReviewPatch(run.id, finding.id, 'Elara searched for the missing key.');
  assert.equal(editor.project.paragraphs[1].text, 'Elara searched for the missing key.');
  const applied = editor.workspace.reviewRuns[0].findings[0]; assert.equal(applied.decision, 'applied'); assert.equal(applied.appliedReplacement, editor.project.paragraphs[1].text);
  assert.equal(editor.workspace.revisions.at(-1).source, 'review'); assert.throws(() => editor.applyReviewPatch(run.id, finding.id, finding.patch.replacement));
  editor.restore('undo'); assert.equal(editor.project.paragraphs[1].text, original); assert.ok(editor.workspace.revisions.some(r => r.id === applied.appliedRevisionId));
});
test('new edits, branch changes, and changed memory decisions reject stale patches', () => {
  for (const mutation of [e => e.append('Newer prose'), e => e.fork('Other'), e => e.updateFact(e.branch.memoryFactIds[0], {}, 'dismissed')]) {
    const editor = story(), run = finish(editor), finding = run.findings[0]; mutation(editor); const before = editor.workspace;
    assert.ok(findingStaleReason(editor.workspace, run, finding)); assert.throws(() => editor.applyReviewPatch(run.id, finding.id, finding.patch.replacement)); assert.deepEqual(editor.workspace, before);
  }
});
test('explicit ability negation is checked only with the same subject and condition', () => {
  const editor = story('Elara cannot hear the forest after sunrise.', ['Elara can hear the forest after sunrise.']);
  const run = finish(editor); assert.equal(run.findings[0].type, 'direct_negation'); assert.equal(run.findings[0].patch.replacement, 'Elara cannot hear the forest after sunrise.');
  assert.equal(finish(story('Elara cannot hear the forest after sunrise.', ['Elara can hear the forest.'])).findings.length, 0);
});
test('dialogue, uncertainty, temporal cues and intervening recovery lead to abstention', () => {
  for (const targets of [['"Elara carries the key."'], ['Perhaps Elara carries the key.'], ['Elara carries the key now.'], ['Elara recovered the key.', 'Elara carries the key.'], ['Elara found the key.']]) {
    const run = finish(story('Elara lost the key.', targets)); assert.equal(run.findings.length, 0); assert.ok(run.abstentions.length);
  }
});
test('unsupported claims and non-conflicting prose do not become invented findings', () => {
  const editor = story('Elara lost the key.', ['Rowan carries the key.']); assert.equal(finish(editor).findings.length, 0);
  const unsupported = story('The sky was unusually quiet.', ['The sky was loud.']); assert.equal(finish(unsupported).findings.length, 0);
});
test('fact approval, branch, time and character filters apply before review', () => {
  const editor = story(); const fact = editor.branch.memoryFactIds[0]; editor.updateFact(fact, { validFrom: 2, validUntil: 4, knowledge: [{ character: 'Elara', state: 'knows' }] }, 'accepted');
  assert.equal(finish(editor, { narrativeTime: 1 }).factIds.length, 0);
  assert.equal(finish(editor, { narrativeTime: 3, viewpoint: 'Rowan' }).factIds.length, 0);
  assert.equal(finish(editor, { narrativeTime: 3, viewpoint: 'Elara' }).findings.length, 1);
  const beforeFact = editor.workspace.revisions[0].id; editor.fork('Before memory', beforeFact); assert.equal(finish(editor).factIds.length, 0);
});
test('call, token, wall-time and finding budgets stop work with bounded counters', () => {
  const calls = finish(story(), { maxCalls: 3 }); assert.equal(calls.status, 'budget_exhausted'); assert.equal(calls.counters.toolCalls, 3); assert.equal(calls.findings.length, 0);
  const tokens = finish(story('Elara lost the key.', ['x'.repeat(400)]), { maxTokens: 256 }); assert.equal(tokens.status, 'budget_exhausted'); assert.ok(tokens.counters.estimatedTokens <= 256);
  const editor = story(), id = editor.startReview({ maxMs: 50 }, 1000); editor.advanceReview(id, 1050); assert.equal(editor.workspace.reviewRuns[0].status, 'budget_exhausted'); assert.equal(editor.workspace.reviewRuns[0].trace.length, 0);
  const partial = finish(story('Elara lost the key.', ['Elara carries the key.', 'Elara has the key.']), { maxFindings: 1 }); assert.equal(partial.status, 'budget_exhausted'); assert.equal(partial.findings.length, 1);
});
test('partial findings survive budget exhaustion and can be explicitly approved', () => {
  const editor = story('Elara lost the key.', ['Elara carries the key.', 'Elara has the key.']);
  const run = finish(editor, { maxCalls: 5 }); assert.equal(run.status, 'budget_exhausted'); assert.equal(run.findings.length, 1);
  editor.applyReviewPatch(run.id, run.findings[0].id, run.findings[0].patch.replacement); assert.equal(editor.project.paragraphs[1].text, 'Elara does not carry the key.');
});
test('cancel is terminal, preserves partial findings and blocks patch application', () => {
  const editor = story('Elara lost the key.', ['Elara carries the key.', 'Elara has the key.']); const id = editor.startReview({}, 1000);
  for (let i = 1; !editor.workspace.reviewRuns[0].findings.length; i++) editor.advanceReview(id, 1000 + i);
  editor.stopReview(id); const before = editor.workspace; editor.advanceReview(id, 1200); assert.deepEqual(editor.workspace, before);
  assert.equal(before.reviewRuns[0].findings.length, 1); assert.throws(() => editor.applyReviewPatch(id, before.reviewRuns[0].findings[0].id, 'New text'));
});
test('intentional exceptions suppress exact repeats, can be reconsidered, and remain branch-local', () => {
  const editor = story(), run = finish(editor), finding = run.findings[0], main = editor.branch.id;
  editor.decideFinding(run.id, finding.id, 'intentional', 'Intentional reveal.');
  assert.equal(finish(editor).findings.length, 0); assert.ok(editor.workspace.reviewRuns.at(-1).abstentions.some(a => /intentional/.test(a.reason)));
  editor.fork('Alternative'); assert.equal(finish(editor).findings.length, 1);
  editor.switchBranch(main); editor.reconsiderException(editor.workspace.reviewExceptions[0].id); assert.equal(finish(editor).findings.length, 1);
});
test('review metadata does not invalidate generation; approved prose repairs do', () => {
  const editor = story(), generation = new Generation(editor), operation = generation.begin(assembleContext(editor.workspace)); operation.text = 'A new passage.';
  finish(editor); assert.equal(generation.finish(operation), true);
  const run = editor.workspace.reviewRuns[0]; assert.ok(findingStaleReason(editor.workspace, run, run.findings[0]));
});
test('reload interrupts active runs without resuming them and exports retain review history', () => {
  const editor = story(), id = editor.startReview({}, 1000); editor.advanceReview(id, 1001);
  const restored = restoreSession(snapshot(editor)).editor; assert.equal(restored.workspace.reviewRuns[0].status, 'interrupted');
  assert.deepEqual(parseWorkspace(JSON.stringify(restored.workspace)), restored.workspace);
  const old = story().workspace; old.schemaVersion = 3; delete old.reviewRuns; delete old.reviewExceptions;
  const migrated = parseWorkspace(JSON.stringify(old)); assert.equal(migrated.schemaVersion, 4); assert.equal(migrated.memoryFacts.length, old.memoryFacts.length);
});
test('malformed citations, patch preconditions, usage, and hidden rewrites are rejected', () => {
  const editor = story(), run = finish(editor), finding = run.findings[0];
  for (const mutate of [w => { w.reviewRuns[0].findings[0].sourceEvidence.quote = 'False evidence'; }, w => { w.reviewRuns[0].findings[0].patch.paragraphId = 'other'; }, w => { w.reviewRuns[0].counters.actualCost = 1; }, w => { w.reviewRuns[0].trace[0].tool = 'shell'; }, w => { w.reviewRuns[0].baseRevisionId = 'foreign'; }]) {
    const invalid = editor.workspace; mutate(invalid); assert.throws(() => validateWorkspace(invalid));
  }
  editor.applyReviewPatch(run.id, finding.id, finding.patch.replacement);
  const invalid = editor.workspace; invalid.revisions.at(-1).title = 'Hidden rewrite'; assert.throws(() => validateWorkspace(invalid));
  const trace = JSON.stringify(reviewTrace(run)); assert.ok(!trace.includes('Elara carries')); assert.ok(!trace.includes('Elara lost')); assert.ok(!trace.includes('replacement'));
});
test('review failure leaves the editor usable and preserves a failed run', async () => {
  const editor = story(); editor.advanceReview = () => { throw new Error('Injected reviewer failure'); };
  const controller = new ReviewController(editor); await controller.start();
  assert.equal(controller.active, false); assert.equal(editor.workspace.reviewRuns[0].status, 'failed');
  editor.append('Writing still works.'); assert.equal(editor.project.paragraphs.at(-1).text, 'Writing still works.');
});

test('intervening recovery outside the selected range is retrieved, budgeted, and leads to abstention', () => {
  const editor = story('Elara lost the key.', ['Elara recovered the key.', 'Elara carries the key.']);
  const run = finish(editor, { start: 3, end: 3 }); assert.equal(run.findings.length, 0);
  const middle = editor.workspace.revisions.find(r => r.id === run.baseRevisionId).paragraphVersionIds[1];
  assert.ok(run.trace.find(entry => entry.tool === 'retrieve_passages').refs.includes(middle));
  assert.ok(run.abstentions.some(a => /intervening/.test(a.reason)));
});
