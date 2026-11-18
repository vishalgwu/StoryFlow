import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchEditor, parseWorkspace, validateWorkspace } from '../src/history.js';
import { visibleFacts, evidenceState, assembleContext, validateContext, estimateTokens, CATEGORIES } from '../src/memory.js';
import { Generation, offlineContinuation } from '../src/generation.js';
import { snapshot, restoreSession } from '../src/session.js';

function story(text = 'Elara cannot hear the forest after sunrise.') {
  const editor = new BranchEditor(); editor.edit('Forest', editor.project.paragraphs.map(p => ({ ...p, text }))); return editor;
}
function proposal(editor, updates = {}) {
  const workspace = editor.workspace, head = workspace.revisions.find(r => r.id === editor.branch.headRevisionId);
  const passage = workspace.paragraphVersions.find(p => p.id === head.paragraphVersionIds[0]);
  return editor.proposeFact({ paragraphVersionId: passage.id, start: 0, end: passage.text.length, claim: passage.text, entities: ['Elara'], ...updates });
}
const accept = (editor, factId, updates = {}) => editor.updateFact(factId, updates, 'accepted');

test('local extraction produces pending, exact evidence and does not repeat dismissed candidates', () => {
  const editor = story(); assert.equal(editor.extractFacts(), 1);
  const fact = visibleFacts(editor.workspace)[0]; assert.equal(fact.status, 'pending');
  assert.equal(fact.evidence.quote, editor.project.paragraphs[0].text);
  assert.equal(assembleContext(editor.workspace).included.length, 0);
  editor.updateFact(fact.id, {}, 'dismissed'); assert.equal(editor.extractFacts(), 0);
});
test('approval enters continuation context; the fixture consumes it with recorded provenance', async () => {
  const editor = story(), fact = accept(editor, proposal(editor), { locked: true });
  const context = assembleContext(editor.workspace, { query: 'Elara dawn hearing' });
  assert.equal(context.included[0].factId, fact); assert.match(context.prompt, /Evidence/);
  validateContext(context, editor.workspace);
  const generation = new Generation(editor), operation = generation.begin(context);
  for await (const chunk of offlineContinuation(operation.context)) operation.text += chunk;
  assert.match(operation.text, /Elara cannot hear/); assert.equal(generation.finish(operation), true);
  assert.deepEqual(editor.workspace.revisions.at(-1).generation.context, context);
});
test('editing an approved fact creates a pending version and preserves decision evidence', () => {
  const editor = story(), accepted = accept(editor, proposal(editor));
  const pending = editor.updateFact(accepted, { claim: 'Writer-corrected claim' });
  assert.equal(visibleFacts(editor.workspace)[0].status, 'pending');
  assert.equal(editor.workspace.memoryFacts.find(f => f.id === accepted).status, 'accepted');
  assert.equal(editor.workspace.memoryFacts.find(f => f.id === pending).previousId, accepted);
  assert.equal(assembleContext(editor.workspace).included.length, 0);
});
test('edited or deleted evidence becomes stale; revalidation requires a fresh approval', () => {
  const editor = story(), accepted = accept(editor, proposal(editor));
  editor.edit(editor.project.title, editor.project.paragraphs.map(p => ({ ...p, text: p.text + ' Rowan watched.' })));
  assert.equal(evidenceState(editor.workspace, visibleFacts(editor.workspace)[0]).stale, true);
  assert.equal(assembleContext(editor.workspace).included.length, 0);
  assert.throws(() => accept(editor, accepted));
  const pending = editor.updateFact(accepted, {}, 'pending', true);
  assert.equal(visibleFacts(editor.workspace)[0].status, 'pending');
  assert.equal(evidenceState(editor.workspace, visibleFacts(editor.workspace)[0]).stale, false);
  accept(editor, pending); assert.equal(assembleContext(editor.workspace).included.length, 1);
  editor.edit(editor.project.title, []); assert.equal(assembleContext(editor.workspace).included.length, 0);
});
test('fork snapshots isolate later parent approvals, sibling facts and child decisions', () => {
  const editor = story(), original = accept(editor, proposal(editor)), main = editor.branch.id;
  const child = editor.fork('Child');
  editor.updateFact(original, {}, 'dismissed'); assert.equal(assembleContext(editor.workspace).included.length, 0);
  editor.switchBranch(main); assert.equal(assembleContext(editor.workspace).included.length, 1);
  editor.append('Rowan carries a silver key.'); editor.extractFacts();
  const later = visibleFacts(editor.workspace).find(f => f.status === 'pending'); accept(editor, later.id);
  editor.switchBranch(child); assert.equal(visibleFacts(editor.workspace).length, 1);
  assert.ok(assembleContext(editor.workspace).omitted.every(i => i.factId !== later.id));
  editor.fork('Sibling of grandchild'); assert.equal(assembleContext(editor.workspace).included.length, 0);
});
test('historical forks exclude facts whose decision revision occurs later', () => {
  const editor = story(), before = editor.branch.headRevisionId;
  editor.append('A later event.'); accept(editor, proposal(editor));
  editor.fork('Before approval', before); assert.equal(visibleFacts(editor.workspace).length, 0);
});
test('narrative validity is inclusive and distinguishes loss from later recovery', () => {
  const editor = story('Elara lost the key.');
  accept(editor, proposal(editor, { validFrom: 2, validUntil: 4 }));
  assert.equal(assembleContext(editor.workspace, { narrativeTime: 1 }).included.length, 0);
  assert.equal(assembleContext(editor.workspace, { narrativeTime: 2 }).included.length, 1);
  assert.equal(assembleContext(editor.workspace, { narrativeTime: 4 }).included.length, 1);
  assert.equal(assembleContext(editor.workspace, { narrativeTime: 5 }).included.length, 0);
});
test('reader knowledge and individual characters remain separate', () => {
  const editor = story(), factId = proposal(editor, { readerKnows: false, knowledge: [{ character: 'Elara', state: 'knows' }, { character: 'Rowan', state: 'does_not_know' }, { character: 'Mara', state: 'unknown' }] });
  accept(editor, factId);
  assert.equal(assembleContext(editor.workspace).included.length, 0);
  assert.equal(assembleContext(editor.workspace, { viewpoint: 'elara' }).included.length, 1);
  assert.equal(assembleContext(editor.workspace, { viewpoint: 'Rowan' }).included.length, 0);
  assert.equal(assembleContext(editor.workspace, { viewpoint: 'Mara' }).included.length, 0);
});
test('plans and inferences never become authoritative constraints or locked facts', () => {
  for (const kind of ['plan', 'inference']) {
    const editor = story(), candidate = proposal(editor, { kind });
    assert.throws(() => accept(editor, candidate, { locked: true }));
    accept(editor, candidate); assert.equal(assembleContext(editor.workspace).included.length, 0);
  }
  for (const category of CATEGORIES) { const editor = story(); assert.ok(proposal(editor, { category })); }
});
test('distant approved fact outranks recent noise using entities and local synonym expansion', () => {
  const editor = story('Elara cannot hear the forest after sunrise.');
  const target = accept(editor, proposal(editor));
  for (let i = 0; i < 30; i++) editor.append(`Unrelated scene ${i}: ships waited by the harbor.`);
  const context = assembleContext(editor.workspace, { query: 'Elara listening at dawn', budget: 1500 });
  assert.equal(context.included[0].factId, target); assert.ok(context.estimatedTokens <= context.budget);
  validateContext(context, editor.workspace);
});
test('locked constraints block rather than silently truncate an undersized request', () => {
  const editor = story(), accepted = accept(editor, proposal(editor), { locked: true, claim: 'Established rule. '.repeat(40) });
  const blocked = assembleContext(editor.workspace, { budget: 256 });
  assert.equal(blocked.status, 'blocked'); assert.equal(blocked.prompt, '');
  assert.equal(blocked.omitted[0].factId, accepted); assert.ok(blocked.requiredTokens > blocked.budget);
  assert.throws(() => new Generation(editor).begin(blocked));
  const prepared = assembleContext(editor.workspace, { budget: 4096 });
  assert.equal(prepared.status, 'ready'); assert.equal(prepared.estimatedTokens, estimateTokens(prepared.prompt));
});
test('memory and manifests round trip through project export and reload', () => {
  const editor = story(); accept(editor, proposal(editor), { locked: true });
  const context = assembleContext(editor.workspace), generation = new Generation(editor), operation = generation.begin(context);
  operation.text = 'A continuation.'; assert.equal(generation.finish(operation), true);
  const portable = parseWorkspace(JSON.stringify(editor.workspace)); assert.deepEqual(portable, editor.workspace);
  const restored = restoreSession(snapshot(editor, null, { id: 'sample', projectId: editor.project.id, branchId: editor.branch.id, text: 'Partial', status: 'canceled', context }));
  assert.deepEqual(restored.editor.workspace, editor.workspace); assert.deepEqual(restored.proposal.context, context);
});
test('schema-v2 projects migrate without inventing facts or changing history IDs', () => {
  const workspace = new BranchEditor().workspace; workspace.schemaVersion = 2; delete workspace.memoryFacts;
  workspace.branches.forEach(b => delete b.memoryFactIds);
  const migrated = parseWorkspace(JSON.stringify(workspace));
  assert.equal(migrated.schemaVersion, 3); assert.deepEqual(migrated.memoryFacts, []);
  assert.equal(migrated.revisions[0].id, workspace.revisions[0].id);
});
test('invalid evidence, foreign scope, malicious fields and context tampering are rejected atomically', () => {
  const editor = story(), accepted = accept(editor, proposal(editor)); const before = editor.workspace;
  assert.throws(() => editor.updateFact(accepted, { apiKey: 'secret' })); assert.deepEqual(editor.workspace, before);
  for (const mutate of [w => { w.memoryFacts[0].evidence.quote = 'Invented support'; }, w => { w.memoryFacts[0].evidence.end = 99999; },
    w => { w.memoryFacts[0].scopeBranchId = 'foreign'; }, w => { w.memoryFacts[0].knowledge = [null]; }, w => { w.memoryFacts[0].previousId = w.memoryFacts[0].id; }]) {
    const invalid = editor.workspace; mutate(invalid); assert.throws(() => validateWorkspace(invalid));
  }
  const context = assembleContext(editor.workspace); context.prompt += 'Untracked instruction'; context.estimatedTokens = estimateTokens(context.prompt);
  assert.throws(() => validateContext(context, editor.workspace));
});

test('parent decisions after a fork cannot silently rewrite the child memory snapshot', () => {
  const editor = story(), accepted = accept(editor, proposal(editor)), main = editor.branch.id;
  const child = editor.fork('Independent'); editor.switchBranch(main); editor.updateFact(accepted, {}, 'dismissed');
  assert.equal(assembleContext(editor.workspace).included.length, 0);
  editor.switchBranch(child); assert.equal(assembleContext(editor.workspace).included[0].factId, accepted);
});

test('captured context includes knowledge/time and a memory decision invalidates an in-flight request', () => {
  const editor = story(), accepted = accept(editor, proposal(editor), { knowledge: [{ character: 'Elara', state: 'knows' }] });
  const context = assembleContext(editor.workspace, { viewpoint: 'Elara', narrativeTime: 3 });
  assert.match(context.prompt, /Viewpoint: Elara/); assert.match(context.prompt, /Narrative time: 3/); assert.match(context.prompt, /Elara=knows/);
  const generation = new Generation(editor), operation = generation.begin(context); operation.text = 'Old proposal';
  editor.updateFact(accepted, {}, 'dismissed');
  assert.equal(generation.finish(operation), false); assert.equal(operation.status, 'stale');
  assert.deepEqual(operation.context, context);
});

test('repeated approvals preserve a lock without consuming new memory versions', () => {
  const editor = story(), accepted = accept(editor, proposal(editor), { locked: true });
  const count = editor.workspace.memoryFacts.length;
  const epoch = editor.epoch;
  assert.equal(accept(editor, accepted), accepted);
  assert.equal(editor.workspace.memoryFacts.length, count);
  assert.equal(editor.epoch, epoch);
  assert.equal(visibleFacts(editor.workspace)[0].locked, true);
});

test('historical fork recovers the earlier decision instead of losing a later-edited fact', () => {
  const editor = story(), accepted = accept(editor, proposal(editor)), earlier = editor.branch.headRevisionId;
  editor.append('Later scene.'); editor.updateFact(accepted, {}, 'dismissed');
  editor.fork('Earlier memory', earlier);
  assert.equal(visibleFacts(editor.workspace)[0].id, accepted);
  assert.equal(assembleContext(editor.workspace).included.length, 1);
});

test('a parent decision made after a fork cannot be forged into the child context', () => {
  const editor = story(), accepted = accept(editor, proposal(editor)), main = editor.branch.id;
  const child = editor.fork('Snapshot'); editor.switchBranch(main);
  const parentDecision = editor.updateFact(accepted, { claim: 'Parent-only corrected claim.' }, 'accepted');
  editor.switchBranch(child); const context = assembleContext(editor.workspace);
  context.included[0].factId = parentDecision; context.included[0].claim = 'Parent-only corrected claim.';
  assert.throws(() => validateContext(context, editor.workspace), /unapproved or wrong-scope context fact/);
});
