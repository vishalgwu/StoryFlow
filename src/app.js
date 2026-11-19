import { BranchEditor, parseWorkspace, MAX_WORKSPACE_BYTES } from './history.js';
import { createExplorer } from './explorer.js';
import { createMemoryUI } from './memoryui.js';
import { createReviewUI } from './reviewui.js';
import { createCanvas } from './canvas.js';
import { openStorage, loadSession, saveSession } from './storage.js';
import { snapshot } from './session.js';
import { Generation, offlineContinuation } from './generation.js';

const $ = id => document.getElementById(id);
let editor, generation, db, working = null, proposal = null;
let dirty = false, timer, sequence = 0, saveQueue = Promise.resolve(), writable = false, running = false;
let errorSource = null;
let explorer;
let memory;
let review;
let canvas;
const showError = (error, source = 'action') => { errorSource = source; $('error').textContent = error.message; $('error').hidden = false; };
const clearError = () => { errorSource = null; $('error').hidden = true; };
const savedText = () => working ? 'Recovery checkpoint saved — paragraph not applied' : 'Saved in this browser';
function updateControls() {
  for (const id of ['title', 'save', 'add', 'generate', 'import', 'new-project']) $(id).disabled = !writable;
  $('title').disabled ||= !!working;
  $('add').disabled ||= !!working || editor.project.paragraphs.length >= 200;
  $('generate').disabled ||= !!working || running;
  $('import').disabled ||= !!working || running || !!review?.controller.active;
  $('new-project').disabled ||= !!working || running || !!review?.controller.active;
  $('undo').disabled = !writable || !!working || !editor.undoStack.length;
  $('redo').disabled = !writable || !!working || !editor.redoStack.length;
  $('stop').disabled = !running;
  $('keep').disabled = !writable || running || !!working || !proposal?.text.trim() ||
    ['complete', 'applied'].includes(proposal.status) || proposal.projectId !== editor.project.id || proposal.branchId !== editor.project.branchId;
  $('export').disabled = false;
  $('edit-status').hidden = !working;
  $('export-edit').hidden = !working;
  $('edit-status').textContent = 'Unapplied paragraph edit. Save changes to apply it, or Cancel edit to restore the original. Changes are checkpointed for recovery.';
  $('words').textContent = `${editor.project.paragraphs.map(p => p.text).join(' ').trim().split(/\s+/).filter(Boolean).length} words`;
  explorer?.updateControls();
  memory?.updateControls();
  review?.updateControls();
  canvas?.updateControls();
}
function changed() {
  dirty = true; sequence++;
  $('save-status').textContent = working ? 'Unapplied edit — checkpoint pending' : 'Unsaved changes';
  updateControls();
  clearTimeout(timer); timer = setTimeout(persist, 250);
}
async function persist() {
  clearTimeout(timer);
  if (!writable) return;
  const version = sequence;
  let record;
  try { record = snapshot(editor, working, proposal); }
  catch (error) { showError(error); return; }
  $('save-status').textContent = 'Saving…';
  // A failed transaction does not poison later retries. Only the latest checkpoint reports success.
  const task = saveQueue.catch(() => {}).then(async () => {
    if (!db) throw new Error('Saving disabled to protect existing data. Export a backup; reload to retry opening storage.');
    await saveSession(db, record);
    if (version === sequence) {
      dirty = false; $('save-status').textContent = savedText(); $('retry').hidden = true;
      if (errorSource === 'storage') clearError();
    }
  });
  saveQueue = task;
  try { await task; }
  catch (error) {
    if (version !== sequence) return;
    $('save-status').textContent = 'Save failed — export a backup'; $('retry').hidden = !db;
    showError(new Error(error.name === 'QuotaExceededError' ? 'Browser storage is full. Your draft is still open. Export a backup, free storage, then Retry saving.' : error.message), 'storage');
  }
}
function focusEdit() { document.querySelector('textarea:not([readonly])')?.focus(); }
function beginEdit(paragraph) {
  if (!writable || working) return;
  working = { paragraphId: paragraph.id, text: paragraph.text };
  editor.epoch++; render(); changed(); focusEdit();
}
function applyEdit() {
  if (!working) return true;
  try {
    const id = working.paragraphId;
    editor.edit(editor.project.title, editor.project.paragraphs.map(p => p.id === id ? { ...p, text: working.text } : p));
    working = null; render(); changed();
    document.querySelector(`[data-edit-id="${CSS.escape(id)}"]`)?.focus();
    return true;
  } catch (error) { showError(error); return false; }
}
function cancelEdit() {
  const id = working?.paragraphId; working = null; editor.epoch++; render(); changed();
  document.querySelector(`[data-edit-id="${CSS.escape(id)}"]`)?.focus();
}
function button(text, action) {
  const element = document.createElement('button'); element.textContent = text; element.onclick = action; return element;
}
function render() {
  $('title').value = editor.project.title; $('paragraphs').replaceChildren();
  editor.project.paragraphs.forEach((paragraph, index) => {
    const section = document.createElement('section'); section.className = 'passage';
    const label = document.createElement('label'); label.className = 'paragraph-label';
    label.htmlFor = `p-${paragraph.id}`; label.textContent = `PASSAGE ${index + 1}`;
    const input = document.createElement('textarea'); input.className = 'paragraph'; input.id = label.htmlFor;
    input.maxLength = 20_000; input.readOnly = working?.paragraphId !== paragraph.id || !writable;
    input.value = working?.paragraphId === paragraph.id ? working.text : paragraph.text;
    input.rows = Math.max(3, Math.min(16, Math.ceil(input.value.length / 65)));
    input.addEventListener('input', () => { working.text = input.value; editor.epoch++; changed(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape' && working) { event.preventDefault(); cancelEdit(); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && working) { event.preventDefault(); if (applyEdit()) persist(); }
    });
    const actions = document.createElement('div'); actions.className = 'passage-actions';
    if (!input.readOnly) {
      actions.append(button('Save changes', () => { if (applyEdit()) persist(); }), button('Cancel edit', cancelEdit));
    } else {
      const edit = button(`Edit passage ${index + 1}`, () => beginEdit(paragraph));
      edit.dataset.editId = paragraph.id; edit.disabled = !writable || !!working; actions.append(edit);
    }
    const prose = document.createElement('div'); prose.className = 'canvas-prose'; prose.dataset.paragraphId = paragraph.id;
    // The native read-only field supplies accessible prose; spans are its visual presentation.
    prose.setAttribute('aria-hidden', 'true'); prose.hidden = !input.readOnly;
    prose.ondblclick = () => beginEdit(paragraph);
    input.tabIndex = input.readOnly ? -1 : 0;
    section.append(label, prose, input, actions); $('paragraphs').append(section);
  });
  renderProposal(); updateControls(); explorer?.render(); memory?.render(); review?.render(); canvas?.render();
}
function renderProposal() {
  $('proposal').hidden = !proposal; $('preview').textContent = proposal?.text || '';
  $('sample-context').hidden = !proposal?.context;
  if (proposal) {
    const branch = editor.workspace.branches.find(b => b.id === proposal.branchId);
    $('proposal-origin').textContent = `From ${branch?.name || 'another project'}${proposal.branchId !== editor.project.branchId ? ' — switch to that branch to add it' : ''}`;
  }
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('title').addEventListener('input', () => {
  try { editor.edit($('title').value, editor.project.paragraphs); changed(); explorer.render(); memory.render(); review.render(); canvas.render(); }
  catch (error) { $('title').value = editor.project.title; showError(error); }
});
$('save').onclick = () => { if (applyEdit()) persist(); };
$('retry').onclick = persist;
for (const direction of ['undo', 'redo']) $(direction).onclick = () => {
  try { editor.restore(direction); render(); changed(); $('run-status').textContent = 'Draft history restored.'; }
  catch (error) { showError(error); }
};
$('add').onclick = () => {
  try { editor.append(''); const paragraph = editor.project.paragraphs.at(-1); beginEdit(paragraph); }
  catch (error) { showError(error); }
};
$('export').onclick = () => {
  try {
    // Preserve the full tree; a visible working edit becomes an export-only revision.
    const exported = new BranchEditor(editor.workspace);
    if (working) {
      try { exported.edit(editor.project.title, editor.project.paragraphs.map(p => p.id === working.paragraphId ? { ...p, text: working.text } : p)); }
      catch (error) {
        download(JSON.stringify(editor.workspace), 'storyflow-project.json', 'application/json');
        showError(new Error(`Committed history was exported without the unapplied edit: ${error.message} Use Export edit text to keep those new words separately.`)); return;
      }
    }
    download(JSON.stringify(exported.workspace), 'storyflow-project.json', 'application/json');
  } catch (error) { showError(error); }
};
$('export-edit').onclick = () => { if (working) download(working.text, 'storyflow-paragraph-edit.txt', 'text/plain'); };
$('import').onclick = () => { $('file').value = ''; $('file').click(); };
$('new-project').onclick = () => {
  if (!writable || working || running || review.controller.active || !confirm('Start a new project? Export the current project first to keep an independent backup. Undo can restore it until your next edit or branch change.')) return;
  editor.replace(new BranchEditor().workspace); render(); changed();
  $('run-status').textContent = 'New project started. Undo restores the previous project until your next change.';
};
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file || !writable || working || running || review.controller.active) return;
  try {
    if (file.size > MAX_WORKSPACE_BYTES) throw new Error('Project exceeds the 20 MB history import limit.');
    const epoch = editor.epoch, next = parseWorkspace(await file.text());
    if (epoch !== editor.epoch || working || running || review.controller.active) throw new Error('Draft changed while reading the file. Try importing again.');
    if (!confirm('Replace this project with the import? Export a backup first. Undo can restore the previous project until your next edit or branch change.')) return;
    generation.cancel(); editor.replace(next); render(); changed(); clearError();
    $('run-status').textContent = 'Project imported. Undo restores the previous project until your next edit or branch change.';
  } catch (error) { showError(error); }
};
$('generate').onclick = async () => {
  if (!writable || working || running) return;
  if (proposal && !['complete', 'applied'].includes(proposal.status) && proposal.text.trim() &&
      !confirm('Replace the recoverable sample with a new run? Export its text first if you want to keep it.')) return;
  let operation;
  try {
    if (!canvas.atEnd()) canvas.prepare();
    const context = memory.prepare();
    if (context.status === 'blocked') throw new Error(`Required instructions and locked facts need ${context.requiredTokens} estimated input tokens. Increase the memory context budget or explicitly unlock a rule. No sample started.`);
    operation = generation.begin(context);
  } catch (error) { showError(error); return; }
  proposal = { id: operation.id, projectId: operation.projectId, branchId: operation.branchId, text: '', status: 'running', context: operation.context };
  running = true; renderProposal(); changed();
  $('run-status').textContent = 'Streaming offline sample…';
  await persist();
  let chunks = 0;
  try {
    for await (const chunk of offlineContinuation(operation.context)) {
      if (operation.status !== 'running') break;
      operation.text += chunk; proposal.text = operation.text; renderProposal();
      dirty = true; sequence++;
      if (++chunks % 4 === 0) { changed(); await persist(); }
    }
    if (generation.finish(operation)) {
      proposal.status = 'complete'; render(); $('run-status').textContent = 'Sample added. Undo is available.';
    } else {
      proposal.status = operation.status;
      $('run-status').textContent = operation.status === 'stale' ? 'Draft changed. Sample kept separately for your review.' : 'Stopped. Partial sample kept separately.';
    }
  } catch (error) {
    operation.status = proposal.status = 'failed'; showError(error);
    $('run-status').textContent = 'Sample failed. Partial output is kept separately; export it or start a new run.';
  }
  finally { running = false; renderProposal(); changed(); await persist(); }
};
$('stop').onclick = () => { generation.cancel(); if (proposal) proposal.status = 'canceled'; changed(); };
$('keep').onclick = () => {
  if ($('keep').disabled) return;
  try { editor.append(proposal.text, 'offline', proposal.id, proposal.context || null); proposal.status = 'applied'; render(); changed(); $('run-status').textContent = 'Sample added to current draft.'; }
  catch (error) { showError(error); }
};
$('download-partial').onclick = () => download(proposal?.text || '', 'storyflow-sample.txt', 'text/plain');
$('sample-context').onclick = () => { if (proposal?.context) memory.showContext(proposal.context); };
addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === 's' && writable) { event.preventDefault(); if (applyEdit()) persist(); }
  const textEditing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName) && !event.target.readOnly;
  if (event.key.toLowerCase() === 'z' && !working && !textEditing && event.target.tagName !== 'SELECT') {
    event.preventDefault(); (event.shiftKey ? $('redo') : $('undo')).click();
  }
});
async function openEditor(hasLock) {
  writable = hasLock;
  let restored;
  try {
    db = await openStorage(); restored = await loadSession(db);
    if (restored?.editor && !(restored.editor instanceof BranchEditor)) restored.editor = BranchEditor.fromLegacy(restored.editor);
  }
  catch (error) {
    db?.close(); db = null; restored = null;
    showError(new Error(`Could not restore browser storage: ${error.message} Saving is disabled to protect existing data. Export new work before closing.`));
  }
  editor = restored?.editor || new BranchEditor();
  working = restored?.working || null; proposal = restored?.proposal || null;
  generation = new Generation(editor);
  explorer = createExplorer({ getEditor: () => editor, canMutate: () => writable && !working,
    onMutation: () => { render(); changed(); $('run-status').textContent = running ? 'Path changed. Running output remains owned by its original branch.' : 'Branch history updated.'; }, onError: showError });
  memory = createMemoryUI({ getEditor: () => editor, canMutate: () => writable && !working, onMutation: () => { render(); changed(); }, onError: showError });
  review = createReviewUI({ getEditor: () => editor, canMutate: () => writable && !working, onMutation: () => { render(); changed(); }, onStateChange: changed, persist, onError: showError, download });
  canvas = createCanvas({ getEditor: () => editor, canWrite: () => writable && !working && !running,
    onMutation: () => { render(); changed(); }, onBeginWriting: () => beginEdit(editor.project.paragraphs.at(-1)), onError: showError });
  render();
  if (!hasLock) {
    $('save-status').textContent = 'Read-only — another tab is editing';
    showError(new Error('Another StoryFlow tab owns this draft, or editing locks are unavailable. Close the editing tab and reload to edit here.'));
    return;
  }
  if (proposal && !['complete', 'applied'].includes(proposal.status)) $('run-status').textContent = 'Recovered sample. Review it before adding to your draft.';
  if (working) $('run-status').textContent = 'Recovered an unapplied paragraph edit. Save or cancel it to continue.';
  if (db) { changed(); await persist(); }
  else $('save-status').textContent = 'Storage unavailable — export a backup';
}
async function start() {
  if (!navigator.locks) return openEditor(false);
  await navigator.locks.request('storyflow-active-editor', { ifAvailable: true }, async lock => {
    await openEditor(!!lock);
    if (lock) await new Promise(resolve => addEventListener('pagehide', resolve, { once: true }));
  });
}
addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
start().catch(showError);
