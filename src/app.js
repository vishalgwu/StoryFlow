import { createProject, Editor, parseProject, MAX_BYTES } from './domain.js';
import { openStorage, loadProject, saveProject } from './storage.js';
import { Generation, offlineContinuation } from './generation.js';

const $ = id => document.getElementById(id);
let editor, generation, db, dirty = false, timer, saveQueue = Promise.resolve();
const showError = error => { $('error').textContent = error.message; $('error').hidden = false; };
function changed() {
  dirty = true;
  $('save-status').textContent = 'Unsaved changes';
  $('undo').disabled = !editor.undoStack.length;
  $('redo').disabled = !editor.redoStack.length;
  $('words').textContent = `${editor.project.paragraphs.map(p => p.text).join(' ').trim().split(/\s+/).filter(Boolean).length} words`;
  clearTimeout(timer); timer = setTimeout(persist, 500);
}
async function persist() {
  clearTimeout(timer);
  const snapshot = structuredClone(editor.project), epoch = editor.epoch;
  $('save-status').textContent = 'Saving…';
  // Serialize transactions so a slower earlier save cannot replace a newer one.
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    if (!db) throw new Error('Browser storage unavailable. Export your draft to keep it.');
    await saveProject(db, snapshot);
    if (epoch === editor.epoch) { dirty = false; $('save-status').textContent = 'Saved in this browser'; }
  });
  try { await saveQueue; }
  catch (error) { $('save-status').textContent = 'Save failed — export a backup'; showError(error); }
}
function render() {
  $('title').value = editor.project.title;
  $('paragraphs').replaceChildren();
  for (const paragraph of editor.project.paragraphs) {
    const label = document.createElement('label'); label.className = 'paragraph-label';
    label.htmlFor = 'p-' + paragraph.id; label.textContent = `PASSAGE ${$('paragraphs').children.length / 2 + 1}`;
    const input = document.createElement('textarea'); input.className = 'paragraph'; input.id = label.htmlFor;
    input.maxLength = 20_000; input.value = paragraph.text;
    input.addEventListener('input', () => {
      try {
        editor.edit($('title').value, editor.project.paragraphs.map(p => p.id === paragraph.id ? { ...p, text: input.value } : p)); changed();
      } catch (error) {
        input.value = editor.project.paragraphs.find(p => p.id === paragraph.id).text;
        showError(new Error('Project size limit reached. Export this draft before starting another.'));
      }
    });
    $('paragraphs').append(label, input);
  }
  $('undo').disabled = !editor.undoStack.length; $('redo').disabled = !editor.redoStack.length;
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('title').addEventListener('input', () => { editor.edit($('title').value, editor.project.paragraphs); changed(); });
$('save').onclick = persist;
for (const direction of ['undo', 'redo']) $(direction).onclick = () => { editor.restore(direction); render(); changed(); };
$('add').onclick = () => {
  try { editor.append(''); render(); changed(); $('paragraphs').lastElementChild.focus(); }
  catch (error) { showError(error); }
};
$('export').onclick = () => download(JSON.stringify(editor.project, null, 2), 'storyflow-project.json', 'application/json');
$('import').onclick = () => { $('file').value = ''; $('file').click(); };
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file) return;
  try {
    if (file.size > MAX_BYTES) throw new Error('Project exceeds the 2 MB import limit.');
    const epoch = editor.epoch, next = parseProject(await file.text());
    if (epoch !== editor.epoch) throw new Error('Draft changed while reading the file. Try importing again.');
    if (!confirm('Replace this draft with the imported project? Export a backup first if needed. You can undo this replacement during this session.')) return;
    generation.cancel(); editor.commit(next); render(); changed(); $('error').hidden = true;
    $('run-status').textContent = 'Project imported. Previous draft is available with Undo.';
  } catch (error) { showError(error); }
};
$('generate').onclick = async () => {
  const operation = generation.begin();
  $('generate').disabled = true; $('stop').disabled = false; $('keep').disabled = true;
  $('proposal').hidden = false; $('preview').textContent = '';
  $('run-status').textContent = 'Streaming offline sample…';
  try {
    for await (const chunk of offlineContinuation()) {
      if (operation.status !== 'running') break;
      operation.text += chunk; $('preview').textContent = operation.text;
    }
    if (generation.finish(operation)) {
      render(); changed(); $('run-status').textContent = 'Sample added. Undo is available.';
    } else {
      $('run-status').textContent = operation.status === 'stale' ? 'Draft changed. Sample kept separately for your review.' : 'Stopped. Partial sample kept separately.';
      $('keep').disabled = !operation.text.trim();
    }
  } catch (error) { operation.status = 'failed'; showError(error); $('keep').disabled = !operation.text.trim(); }
  finally { $('generate').disabled = false; $('stop').disabled = true; }
};
$('stop').onclick = () => generation.cancel();
$('keep').onclick = () => {
  try { editor.append(generation.operation.text); render(); changed(); $('keep').disabled = true; $('run-status').textContent = 'Sample added to current draft.'; }
  catch (error) { showError(error); }
};
$('download-partial').onclick = () => download($('preview').textContent, 'storyflow-sample.txt', 'text/plain');
addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
async function start() {
  let project;
  try { db = await openStorage(); project = await loadProject(db); }
  catch (error) {
    // Never overwrite a stored record that failed validation or could not be read.
    db?.close(); db = null;
    showError(new Error(`Could not restore browser storage: ${error.message} Saving is disabled to protect existing data. Export new work before closing.`));
  }
  editor = new Editor(project || createProject()); generation = new Generation(editor);
  render();
  for (const id of ['title', 'save', 'add', 'generate', 'export', 'import']) $(id).disabled = false;
  changed();
}
start().catch(showError);
