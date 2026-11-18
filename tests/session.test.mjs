import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, Editor, MAX_HISTORY_BYTES } from '../src/domain.js';
import { snapshot, restoreSession, validateSession } from '../src/session.js';

test('legacy stored drafts migrate without losing project IDs or prose', () => {
  const project = createProject(); const restored = restoreSession(project);
  assert.deepEqual(restored.editor.project, project);
  assert.deepEqual(restored.editor.undoStack, []);
  assert.equal(restored.working, null);
});
test('reload recovers unapplied edit, undo/redo and interrupted generation without committing it', () => {
  const editor = new Editor(createProject()); editor.append('Second'); editor.restore('undo');
  const working = { paragraphId: editor.project.paragraphs[0].id, text: 'Unapplied words' };
  const proposal = { id: 'run', projectId: editor.project.id, branchId: editor.project.branchId, text: 'Partial sample', status: 'running' };
  const record = snapshot(editor, working, proposal); const restored = restoreSession(record);
  assert.deepEqual(restored.working, working);
  assert.equal(restored.proposal.status, 'interrupted');
  assert.equal(record.proposal.status, 'running');
  assert.equal(restored.editor.project.paragraphs.length, 1);
  restored.editor.restore('redo'); assert.equal(restored.editor.project.paragraphs[1].text, 'Second');
});
test('malformed recovery data cannot silently replace drafts', () => {
  const record = snapshot(new Editor(createProject()));
  for (const mutation of [{ undo: [null] }, { formatVersion: 99 }, { working: { paragraphId: 'missing', text: 'orphan' } },
    { proposal: { id: 'run', projectId: 'project', branchId: 'main', text: 'x', status: 'invented' } }, { apiKey: 'secret' }]) {
    assert.throws(() => validateSession({ ...record, ...mutation }));
  }
  assert.throws(() => restoreSession(null));
});
test('history is bounded; revision overflow cannot corrupt current state', () => {
  const editor = new Editor(createProject());
  for (let i = 0; i < 60; i++) editor.edit(`Title ${i}`, editor.project.paragraphs);
  assert.equal(editor.undoStack.length, 50);
  const full = new Editor({ ...createProject(), revision: Number.MAX_SAFE_INTEGER });
  const original = structuredClone(full.project);
  assert.throws(() => full.append('Cannot commit'));
  assert.deepEqual(full.project, original); assert.equal(full.undoStack.length, 0);
});

test('large projects prune history to a byte budget while keeping recent undo', () => {
  const project = createProject();
  project.paragraphs = Array.from({ length: 40 }, (_, i) => ({ id: `p-${i}`, text: 'x'.repeat(20_000) }));
  const editor = new Editor(project);
  for (let i = 0; i < 15; i++) editor.edit(`Large ${i}`, editor.project.paragraphs);
  assert.ok(editor.undoStack.length < 15);
  assert.ok(new TextEncoder().encode(JSON.stringify([editor.undoStack, editor.redoStack])).length <= MAX_HISTORY_BYTES);
  const restored = restoreSession(snapshot(editor));
  restored.editor.restore('undo'); assert.equal(restored.editor.project.title, 'Large 13');
});
