import { validateProject, Editor, MAX_HISTORY_BYTES } from './domain.js';
import { BranchEditor } from './history.js';
import { validateContextRecord } from './memory.js';

// Internal recovery format is separate from the portable project format.
export function validateSession(value) {
  if (value?.formatVersion === 2) {
    if (Object.keys(value).length !== 5 || Object.keys(value).some(k => !['formatVersion', 'workspace', 'importBackup', 'working', 'proposal'].includes(k))) throw new Error('Unsupported recovery record.');
    if (value.importBackup === undefined) throw new Error('Invalid import recovery.');
    const editor = new BranchEditor(value.workspace, value.importBackup);
    validateSession({ formatVersion: 1, project: { ...editor.project, revision: 0 }, undo: [], redo: [], working: value.working, proposal: value.proposal });
    return structuredClone(value);
  }
  if (!value || value.formatVersion !== 1 ||
      Object.keys(value).some(key => !['formatVersion', 'project', 'undo', 'redo', 'working', 'proposal'].includes(key))) {
    throw new Error('Unsupported recovery record. Existing data has been preserved.');
  }
  const project = validateProject(value.project);
  for (const history of [value.undo, value.redo]) {
    if (!Array.isArray(history) || history.length > 50) throw new Error('Invalid recovery history.');
    history.forEach(validateProject);
  }
  if (new TextEncoder().encode(JSON.stringify([value.undo, value.redo])).length > MAX_HISTORY_BYTES) throw new Error('Recovery history exceeds its storage budget.');
  const working = value.working;
  if (working !== null && (!working || Object.keys(working).some(k => !['paragraphId', 'text'].includes(k)) ||
      !project.paragraphs.some(p => p.id === working.paragraphId) || typeof working.text !== 'string' || working.text.length > 20_000)) {
    throw new Error('Invalid paragraph recovery draft.');
  }
  const proposal = value.proposal;
  if (proposal !== null && (!proposal || Object.keys(proposal).some(k => !['id', 'projectId', 'branchId', 'text', 'status', 'context'].includes(k)) ||
      !['id', 'projectId', 'branchId'].every(key => typeof proposal[key] === 'string' && proposal[key].length > 0 && proposal[key].length <= 100) ||
      typeof proposal.text !== 'string' || proposal.text.length > 20_000 ||
      !['running', 'canceled', 'stale', 'failed', 'complete', 'interrupted', 'applied'].includes(proposal.status))) {
    throw new Error('Invalid continuation recovery draft.');
  }
  if (proposal?.context !== undefined) validateContextRecord(proposal.context);
  return structuredClone({ ...value, project });
}

export function snapshot(editor, working = null, proposal = null) {
  if (editor instanceof BranchEditor) return validateSession({ formatVersion: 2, workspace: editor.workspace, importBackup: editor.importBackup, working, proposal });
  return validateSession({ formatVersion: 1, project: editor.project,
    undo: editor.undoStack, redo: editor.redoStack, working, proposal });
}

export function restoreSession(record) {
  if (record?.formatVersion === 2) {
    const session = validateSession(record), proposal = session.proposal;
    if (proposal?.status === 'running') proposal.status = 'interrupted';
    const editor = new BranchEditor(session.workspace, session.importBackup); editor.recoverReviews();
    return { editor, working: session.working, proposal };
  }
  // Migrate the original plain project record without changing portable exports.
  const session = record?.formatVersion === undefined
    ? { formatVersion: 1, project: validateProject(record), undo: [], redo: [], working: null, proposal: null }
    : validateSession(record);
  const editor = new Editor(session.project);
  editor.undoStack = structuredClone(session.undo); editor.redoStack = structuredClone(session.redo);
  const proposal = structuredClone(session.proposal);
  if (proposal?.status === 'running') proposal.status = 'interrupted';
  return { editor, working: session.working, proposal };
}
