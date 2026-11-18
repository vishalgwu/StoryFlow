import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchEditor, validateWorkspace, parseWorkspace, revisionContent, compareRevisions, lineage } from '../src/history.js';
import { createProject, Editor } from '../src/domain.js';
import { Generation } from '../src/generation.js';
import { snapshot, restoreSession } from '../src/session.js';

test('forking and editing preserve immutable ancestry and stable passage versions', () => {
  const editor = new BranchEditor(), before = editor.workspace, main = editor.branch.id;
  const alternative = editor.fork('A different ending');
  editor.edit('Alternative', editor.project.paragraphs.map(p => ({ ...p, text: 'Different words.' })));
  const after = editor.workspace;
  assert.deepEqual(after.revisions.slice(0, before.revisions.length), before.revisions);
  assert.deepEqual(after.paragraphVersions.slice(0, before.paragraphVersions.length), before.paragraphVersions);
  assert.equal(after.branches.find(b => b.id === main).headRevisionId, before.branches[0].headRevisionId);
  assert.equal(after.branches.find(b => b.id === alternative).forkRevisionId, before.branches[0].headRevisionId);
  assert.equal(editor.project.paragraphs[0].id, revisionContent(before, before.revisions[0].id).paragraphs[0].id);
  editor.switchBranch(main); assert.equal(editor.project.title, 'The last light');
});
test('revision data exposed to callers cannot mutate committed history', () => {
  const editor = new BranchEditor(), head = editor.branch.headRevisionId;
  const workspace = editor.workspace; workspace.revisions[0].title = 'Tampered'; workspace.paragraphVersions[0].text = 'Tampered';
  const project = editor.project; project.paragraphs[0].text = 'Also tampered';
  assert.equal(revisionContent(editor.workspace, head).title, 'The last light');
  assert.notEqual(editor.project.paragraphs[0].text, 'Tampered');
});
test('branch-local undo/redo and restore append recovery revisions without erasing later work', () => {
  const editor = new BranchEditor(), initial = editor.branch.headRevisionId;
  editor.append('Later work'); const later = editor.branch.headRevisionId;
  editor.restore('undo'); assert.equal(editor.project.paragraphs.length, 1);
  editor.restore('redo'); assert.equal(editor.project.paragraphs.length, 2);
  const beforeRestore = editor.branch.headRevisionId;
  editor.restoreRevision(initial);
  const revision = editor.workspace.revisions.at(-1);
  assert.equal(revision.parentId, beforeRestore); assert.equal(revision.restoredFrom, initial);
  assert.equal(revision.source, 'restore'); assert.equal(editor.project.paragraphs.length, 1);
  assert.equal(revisionContent(editor.workspace, later).paragraphs[1].text, 'Later work');
  const main = editor.branch.id; editor.fork('Other'); editor.append('Sibling only'); editor.restore('undo');
  editor.switchBranch(main); assert.equal(editor.project.paragraphs.length, 1);
  assert.ok(lineage(editor.workspace, editor.branch.headRevisionId).some(r => r.id === later));
});
test('fork from earlier revision excludes later sibling prose and supports archive/reopen', () => {
  const editor = new BranchEditor(), initial = editor.branch.headRevisionId, main = editor.branch.id;
  editor.append('Only on main'); const mainHead = editor.branch.headRevisionId;
  const fork = editor.fork('Earlier alternative', initial); assert.equal(editor.project.paragraphs.length, 1);
  assert.throws(() => editor.archive(fork));
  editor.switchBranch(main); editor.archive(fork); assert.throws(() => editor.switchBranch(fork));
  editor.archive(fork, false); editor.switchBranch(fork); editor.rename('Reopened');
  assert.equal(editor.branch.name, 'Reopened');
  assert.equal(editor.workspace.branches.find(b => b.id === main).headRevisionId, mainHead);
});
test('switch-away-and-back invalidates late generation even when branch head is unchanged', () => {
  const editor = new BranchEditor(), main = editor.branch.id;
  const generation = new Generation(editor), operation = generation.begin(); operation.text = 'Late completion';
  editor.fork('Other path'); editor.switchBranch(main);
  const before = editor.workspace;
  assert.equal(generation.finish(operation), false); assert.equal(operation.status, 'stale');
  assert.deepEqual(editor.workspace, before);
});
test('portable round trip and recovery preserve archived branches, versions, links and import undo', () => {
  const editor = new BranchEditor(), main = editor.branch.id;
  const fork = editor.fork('Alternative'); editor.append('Alternative prose'); editor.switchBranch(main); editor.archive(fork);
  const exported = editor.workspace;
  assert.deepEqual(parseWorkspace(JSON.stringify(exported)), exported);
  const recovered = restoreSession(snapshot(editor)).editor;
  assert.deepEqual(recovered.workspace, exported);
  recovered.replace(new BranchEditor().workspace);
  const afterReload = restoreSession(snapshot(recovered)).editor;
  afterReload.restore('undo'); assert.deepEqual(afterReload.workspace, exported);
  afterReload.restore('redo'); assert.notEqual(afterReload.workspace.id, exported.id);
});
test('legacy draft and recovery migration preserve current prose, IDs, undo and redo', () => {
  const legacy = new Editor(createProject()), id = legacy.project.paragraphs[0].id;
  legacy.append('Earlier second passage'); legacy.append('Third passage'); legacy.restore('undo');
  const migrated = BranchEditor.fromLegacy(restoreSession(snapshot(legacy)).editor);
  assert.equal(migrated.project.paragraphs.length, 2); assert.equal(migrated.project.paragraphs[0].id, id);
  migrated.restore('redo'); assert.equal(migrated.project.paragraphs.length, 3);
  migrated.restore('undo'); assert.equal(migrated.project.paragraphs.length, 2);
  const portable = parseWorkspace(JSON.stringify(createProject()));
  assert.equal(portable.schemaVersion, 3); assert.equal(portable.branches[0].name, 'Main');
});
test('comparison reports additions, removals, edits and ordering differences', () => {
  const editor = new BranchEditor(), initial = editor.branch.headRevisionId;
  editor.append('Added'); const added = editor.branch.headRevisionId;
  assert.equal(compareRevisions(editor.workspace, initial, added).changes.at(-1).kind, 'added');
  assert.equal(compareRevisions(editor.workspace, added, initial).changes.at(-1).kind, 'removed');
  editor.edit(editor.project.title, [...editor.project.paragraphs].reverse());
  assert.ok(compareRevisions(editor.workspace, added, editor.branch.headRevisionId).changes.every(c => c.kind === 'moved'));
  editor.edit('Changed title', editor.project.paragraphs.map(p => ({ ...p, text: p.text + ' changed' })));
  assert.ok(compareRevisions(editor.workspace, added, editor.branch.headRevisionId).changes.every(c => c.kind === 'changed'));
});
test('invalid graph links, cycles, duplicate IDs, foreign heads and unsafe fields are rejected', () => {
  const editor = new BranchEditor(); editor.append('Extra revision');
  const mutations = [
    w => { w.revisions[0].parentId = w.revisions.at(-1).id; },
    w => { w.branches[0].headRevisionId = 'missing'; },
    w => { w.revisions.at(-1).paragraphVersionIds = ['missing']; },
    w => { w.paragraphVersions.push(structuredClone(w.paragraphVersions[0])); },
    w => { w.revisions[0].apiKey = 'secret'; },
    w => { w.branches[0].parentBranchId = w.branches[0].id; },
    w => { w.revisions.at(-1).restoredFrom = 'missing'; },
    w => { w.activeBranchId = 'missing'; },
    w => { w.paragraphVersions[0].text = 'x'.repeat(20_001); },
  ];
  for (const mutate of mutations) { const next = editor.workspace; mutate(next); assert.throws(() => validateWorkspace(next)); }
  const before = editor.workspace; assert.throws(() => editor.fork('Main')); assert.deepEqual(editor.workspace, before);
  assert.throws(() => parseWorkspace('x'.repeat(20_000_001)));
});
test('restoring a sibling-only revision fails without mutating any history', () => {
  const editor = new BranchEditor(), main = editor.branch.id;
  editor.fork('Sibling'); editor.append('Sibling secret'); const siblingRevision = editor.branch.headRevisionId;
  editor.switchBranch(main); const before = editor.workspace;
  assert.throws(() => editor.restoreRevision(siblingRevision));
  assert.deepEqual(editor.workspace, before);
});

test('generation revisions retain exact fixture provenance through export', () => {
  const editor = new BranchEditor(), generation = new Generation(editor);
  const operation = generation.begin(); operation.text = 'Recorded sample';
  assert.equal(generation.finish(operation), true);
  const revision = parseWorkspace(JSON.stringify(editor.workspace)).revisions.at(-1);
  assert.equal(revision.source, 'offline'); assert.equal(revision.generation.operationId, operation.id);
  assert.equal(revision.generation.provider, 'offline-template');
  assert.equal(revision.generation.model, null); assert.equal(revision.generation.steering, null);
});

test('revision and branch limits refuse mutations without dropping history', () => {
  const base = new BranchEditor().workspace, initial = base.revisions[0];
  base.revisions = Array.from({ length: 5000 }, (_, i) => ({ ...initial, id: `revision-${i}`, parentId: i ? `revision-${i - 1}` : null }));
  base.branches[0].headRevisionId = 'revision-4999';
  const editor = new BranchEditor(base); assert.throws(() => editor.append('Beyond the cap'));
  assert.equal(editor.workspace.revisions.length, 5000); assert.equal(editor.branch.headRevisionId, 'revision-4999');
  const branches = new BranchEditor();
  for (let i = 1; i < 50; i++) branches.fork(`Path ${i}`);
  const before = branches.workspace; assert.throws(() => branches.fork('One too many'));
  assert.deepEqual(branches.workspace, before);
});
