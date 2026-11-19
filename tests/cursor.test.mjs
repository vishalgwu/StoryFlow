import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchEditor, parseWorkspace } from '../src/history.js';
import { storyWords, cursorPrefix } from '../src/cursor.js';
const position = (editor, wordIndex) => ({ projectId: editor.project.id, branchId: editor.branch.id, baseRevisionId: editor.project.revision, wordIndex });
function story() {
  const editor = new BranchEditor(); editor.edit('A living draft', editor.project.paragraphs.map(p => ({ ...p, text: 'Elara found the moonlit gate.' })));
  editor.append('The old ending stays safe.'); return editor;
}
test('word boundaries preserve punctuation, whitespace and Unicode exactly', () => {
  const editor = new BranchEditor(); editor.edit('Unicode', editor.project.paragraphs.map(p => ({ ...p, text: 'Élara  👋\nfound the key.' })));
  assert.deepEqual(storyWords(editor.project).map(w => w.text), ['Élara', '👋', 'found', 'the', 'key.']);
  assert.equal(cursorPrefix(editor.project, position(editor, 2)).paragraphs[0].text, 'Élara  👋');
  assert.throws(() => cursorPrefix(editor.project, position(editor, 1.2)));
});
test('writing from an earlier word creates a branch and preserves the original future', () => {
  const editor = story(), main = editor.branch.id, original = editor.project.paragraphs;
  assert.equal(editor.continueAt(position(editor, 3), 'A new possibility opens.'), true);
  assert.equal(editor.project.paragraphs[0].text, 'Elara found the');
  assert.equal(editor.project.paragraphs[0].id, original[0].id);
  assert.equal(editor.project.paragraphs[1].text, 'A new possibility opens.');
  const child = editor.branch.id; editor.switchBranch(main); assert.deepEqual(editor.project.paragraphs, original);
  editor.switchBranch(child); editor.restore('undo'); assert.deepEqual(editor.project.paragraphs, original);
  editor.restore('redo'); assert.equal(editor.project.paragraphs[1].text, 'A new possibility opens.');
  assert.deepEqual(parseWorkspace(JSON.stringify(editor.workspace)), editor.workspace);
});
test('cursor start, passage boundary and end behave without deleting another branch', () => {
  const beginning = story(); beginning.continueAt(position(beginning, 0), 'A different opening.');
  assert.equal(beginning.project.paragraphs.length, 1); assert.equal(beginning.project.paragraphs[0].text, 'A different opening.');
  const boundary = story(); boundary.continueAt(position(boundary, 5)); assert.equal(boundary.project.paragraphs.length, 1); assert.equal(boundary.project.paragraphs[0].text, 'Elara found the moonlit gate.');
  const end = story(), branchId = end.branch.id; end.continueAt(position(end, storyWords(end.project).length), 'One more scene.');
  assert.equal(end.branch.id, branchId); assert.equal(end.project.paragraphs.length, 3);
  const before = end.workspace; end.continueAt(position(end, storyWords(end.project).length)); assert.deepEqual(end.workspace, before);
});
test('stale or foreign cursor and overflowing writing fail atomically', () => {
  const editor = story(), stale = position(editor, 2); editor.append('A newer sentence.');
  for (const cursor of [stale, { ...position(editor, 2), branchId: 'foreign' }, position(editor, 1000)]) {
    const before = editor.workspace; assert.throws(() => editor.continueAt(cursor, 'Keep safe.')); assert.deepEqual(editor.workspace, before);
  }
  const before = editor.workspace; assert.throws(() => editor.continueAt(position(editor, 2), 'x'.repeat(20001))); assert.deepEqual(editor.workspace, before);
});
test('forking from a cursor retains memory history and marks changed evidence stale', async () => {
  const { evidenceState } = await import('../src/memory.js');
  const editor = story(), original = editor.branch.id, version = editor.workspace.revisions.find(r => r.id === editor.branch.headRevisionId).paragraphVersionIds[0];
  const fact = editor.proposeFact({ paragraphVersionId: version, start: 0, end: 27, claim: 'Elara found the moonlit gate.' });
  editor.updateFact(fact, {}, 'accepted'); editor.continueAt(position(editor, 2), 'A forked scene.');
  const accepted = editor.workspace.memoryFacts.find(f => f.id === editor.branch.memoryFactIds[0]);
  assert.equal(evidenceState(editor.workspace, accepted).stale, true);
  editor.switchBranch(original); assert.equal(evidenceState(editor.workspace, accepted).stale, false);
});
