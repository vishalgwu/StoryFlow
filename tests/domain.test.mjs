import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, Editor, parseProject, validateProject } from '../src/domain.js';
import { Generation } from '../src/generation.js';
import { server } from '../server.mjs';

test('edit preserves passage identity; undo and redo restore content with fresh ownership', () => {
  const editor = new Editor(createProject()); const original = structuredClone(editor.project);
  editor.edit('Changed', original.paragraphs.map(p => ({ ...p, text: 'New text' })));
  assert.equal(editor.project.paragraphs[0].id, original.paragraphs[0].id);
  editor.restore('undo'); assert.equal(editor.project.title, original.title);
  editor.restore('redo'); assert.equal(editor.project.paragraphs[0].text, 'New text');
  assert.equal(editor.epoch, 3);
});
test('imports reject malformed, duplicate, oversized and credential-bearing records', () => {
  const project = createProject();
  for (const paragraphs of [[null], [{ text: 'missing id' }], [project.paragraphs[0], project.paragraphs[0]], [{ id: 'x', text: 'x'.repeat(20_001) }]]) {
    assert.throws(() => validateProject({ ...project, paragraphs }));
  }
  assert.throws(() => validateProject({ ...project, apiKey: 'secret' }));
  assert.throws(() => parseProject('x'.repeat(2_000_001)));
  assert.throws(() => parseProject('{'));
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
});
test('invalid mutation leaves draft and undo history intact', () => {
  const editor = new Editor(createProject()); const before = structuredClone(editor.project);
  assert.throws(() => editor.edit('bad', [null]));
  assert.deepEqual(editor.project, before); assert.equal(editor.undoStack.length, 0);
});
test('successful generation commits once and is undoable', () => {
  const editor = new Editor(createProject()), generation = new Generation(editor);
  const operation = generation.begin(); operation.text = 'Continuation';
  assert.equal(generation.finish(operation), true); assert.equal(generation.finish(operation), false);
  assert.equal(editor.project.paragraphs.length, 2);
  editor.restore('undo'); assert.equal(editor.project.paragraphs.length, 1);
});
test('edits and undo invalidate old generation even when content returns to original', () => {
  const editor = new Editor(createProject()), generation = new Generation(editor);
  const operation = generation.begin(); operation.text = 'Old response';
  editor.append('Manual'); editor.restore('undo');
  assert.equal(generation.finish(operation), false); assert.equal(operation.status, 'stale');
  assert.equal(editor.project.paragraphs.length, 1);
});
test('branch/project changes, canceled and superseded operations cannot commit', () => {
  for (const key of ['branchId', 'id']) {
    const editor = new Editor(createProject()), generation = new Generation(editor);
    const operation = generation.begin(); operation.text = 'Wrong owner';
    editor.project[key] = 'another'; assert.equal(generation.finish(operation), false);
  }
  const editor = new Editor(createProject()), generation = new Generation(editor);
  const old = generation.begin(); old.text = 'Partial'; const current = generation.begin();
  assert.equal(generation.finish(old), false); current.text = 'Canceled'; generation.cancel();
  assert.equal(generation.finish(current), false); assert.equal(old.text, 'Partial');
  assert.equal(editor.project.paragraphs.length, 1);
});
test('local server serves modules and refuses repository/private files', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/', '/styles.css', '/src/app.js']) assert.equal((await fetch(base + path)).status, 200);
    for (const path of ['/.git/config', '/package.json', '/README.md']) assert.equal((await fetch(base + path)).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
