import { createProject, validateProject, MAX_BYTES } from './domain.js';
import { validateMemory, validateContext, addCandidate, extractCandidates, reviseFact, inheritedFactIds } from './memory.js';

export const MAX_WORKSPACE_BYTES = 20_000_000;
const copy = value => structuredClone(value);
const uuid = () => crypto.randomUUID();
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const bad = message => { throw new Error(`Invalid project history: ${message}`); };
const text = (v, max, nonempty = false) => typeof v === 'string' && v.length <= max && (!nonempty || v.trim().length > 0);
const identifier = v => text(v, 100, true);
const shape = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
const index = (items, max) => {
  if (!Array.isArray(items) || !items.length || items.length > max) bad('record count exceeds the supported limit.');
  const result = new Map();
  for (const item of items) {
    if (!item || !identifier(item.id) || result.has(item.id)) bad('missing or duplicate record ID.');
    result.set(item.id, item);
  }
  return result;
};
export function lineage(workspace, revisionId) {
  const revisions = new Map(workspace.revisions.map(r => [r.id, r]));
  const result = [], seen = new Set();
  while (revisionId !== null) {
    const revision = revisions.get(revisionId);
    if (!revision || seen.has(revisionId)) bad('broken or cyclic revision ancestry.');
    seen.add(revisionId); result.push(revision); revisionId = revision.parentId;
  }
  return result;
}
export function revisionContent(workspace, revisionId) {
  const revision = workspace.revisions.find(r => r.id === revisionId);
  if (!revision) bad('revision not found.');
  const versions = new Map(workspace.paragraphVersions.map(p => [p.id, p]));
  return { title: revision.title, paragraphs: revision.paragraphVersionIds.map(id => {
    const version = versions.get(id);
    if (!version) bad('passage version not found.');
    return { id: version.paragraphId, text: version.text };
  }) };
}
export function validateWorkspace(value) {
  if (value?.schemaVersion === 2) {
    if (!shape(value, ['schemaVersion', 'id', 'activeBranchId', 'branches', 'revisions', 'paragraphVersions']) ||
        !Array.isArray(value.branches) || !value.branches.every(b => shape(b, ['id', 'name', 'parentBranchId', 'forkRevisionId', 'headRevisionId', 'archived', 'undo', 'redo'])) ||
        !Array.isArray(value.revisions) || !value.revisions.every(r => r?.generation === null || shape(r?.generation, ['operationId', 'provider', 'model', 'settings', 'steering']))) bad('unsupported legacy workspace.');
    value = { ...copy(value), schemaVersion: 3, memoryFacts: [], branches: value.branches.map(b => ({ ...copy(b), memoryFactIds: [] })),
      revisions: value.revisions.map(r => ({ ...copy(r), generation: r.generation ? { ...copy(r.generation), context: null } : null })) };
  }
  if (!shape(value, ['schemaVersion', 'id', 'activeBranchId', 'branches', 'revisions', 'paragraphVersions', 'memoryFacts']) ||
      value.schemaVersion !== 3 || !identifier(value.id) || !identifier(value.activeBranchId)) bad('unsupported workspace format.');
  if (bytes(value) > MAX_WORKSPACE_BYTES) bad('history exceeds 20 MB. Export this project and start a new one.');
  const branches = index(value.branches, 50), revisions = index(value.revisions, 5000);
  if (!Array.isArray(value.paragraphVersions) || value.paragraphVersions.length > 20000) bad('too many passage versions.');
  const versions = value.paragraphVersions.length ? index(value.paragraphVersions, 20000) : new Map();
  if (!branches.has(value.activeBranchId) || branches.get(value.activeBranchId).archived) bad('active branch is unavailable.');
  const names = new Set(); let roots = 0;
  for (const b of branches.values()) {
    if (!shape(b, ['id', 'name', 'parentBranchId', 'forkRevisionId', 'headRevisionId', 'archived', 'undo', 'redo', 'memoryFactIds']) ||
        !text(b.name, 80, true) || typeof b.archived !== 'boolean' || names.has(b.name.toLowerCase()) || !revisions.has(b.headRevisionId)) bad('invalid branch.');
    names.add(b.name.toLowerCase());
    if (b.parentBranchId === null) { roots++; if (b.forkRevisionId !== null) bad('root branch has a fork.'); }
    else if (!branches.has(b.parentBranchId) || !revisions.has(b.forkRevisionId)) bad('missing branch parent or fork.');
    let cursor = b; const seen = new Set();
    while (cursor) {
      if (seen.has(cursor.id)) bad('cyclic branch ancestry.');
      seen.add(cursor.id); cursor = branches.get(cursor.parentBranchId);
    }
    if (![b.undo, b.redo].every(items => Array.isArray(items) && items.length <= 50 && items.every(id => revisions.has(id))) || b.undo.length + b.redo.length > 50) bad('invalid branch recovery history.');
  }
  if (roots !== 1) bad('expected one root branch.');
  const paragraphSizes = new Map();
  for (const p of versions.values()) {
    if (!shape(p, ['id', 'paragraphId', 'text']) || !identifier(p.paragraphId) || !text(p.text, 20_000)) bad('invalid passage version.');
    paragraphSizes.set(p.id, bytes({ id: p.paragraphId, text: p.text }));
  }
  let revisionRoots = 0;
  for (const r of revisions.values()) {
    if (!shape(r, ['id', 'branchId', 'parentId', 'title', 'paragraphVersionIds', 'createdAt', 'summary', 'source', 'restoredFrom', 'generation']) ||
        !branches.has(r.branchId) || !text(r.title, 200) || !text(r.summary, 240, true) ||
        !['initial', 'manual', 'offline', 'undo', 'redo', 'restore', 'migration'].includes(r.source) ||
        !text(r.createdAt, 30) || !Number.isFinite(Date.parse(r.createdAt)) ||
        !Array.isArray(r.paragraphVersionIds) || r.paragraphVersionIds.length > 200) bad('invalid revision.');
    const owner = branches.get(r.branchId);
    if (r.parentId === null) { revisionRoots++; if (owner.parentBranchId !== null) bad('non-root revision has no parent.'); }
    else {
      const parent = revisions.get(r.parentId);
      if (!parent || (parent.branchId !== r.branchId && r.parentId !== owner.forkRevisionId)) bad('revision crosses a sibling branch.');
    }
    const paragraphIds = new Set();
    let size = bytes({ schemaVersion: 1, id: value.id, branchId: r.branchId, revision: 0, title: r.title, paragraphs: [] });
    for (const id of r.paragraphVersionIds) {
      const p = versions.get(id);
      if (!p || paragraphIds.has(p.paragraphId)) bad('missing or duplicate passage reference.');
      paragraphIds.add(p.paragraphId); size += paragraphSizes.get(id);
    }
    if (size + Math.max(0, paragraphIds.size - 1) > MAX_BYTES) bad('revision prose exceeds the draft budget.');
    if (r.restoredFrom !== null && !revisions.has(r.restoredFrom)) bad('missing restoration source.');
    if (['undo', 'redo', 'restore'].includes(r.source) !== (r.restoredFrom !== null)) bad('invalid restoration provenance.');
    if (r.source === 'offline') {
      const g = r.generation;
      if (!shape(g, ['operationId', 'provider', 'model', 'settings', 'steering', 'context']) || !identifier(g.operationId) ||
          g.provider !== 'offline-template' || g.model !== null || g.steering !== null || !shape(g.settings, [])) bad('invalid generation provenance.');
    } else if (r.generation !== null) bad('unexpected generation provenance.');
  }
  if (revisionRoots !== 1) bad('expected one initial revision.');
  // Check all parent chains once, without recursive traversal or a call-stack limit.
  const done = new Set();
  for (const revision of revisions.values()) {
    const path = new Set(); let cursor = revision;
    while (cursor && !done.has(cursor.id)) {
      if (path.has(cursor.id)) bad('cyclic revision ancestry.');
      path.add(cursor.id); cursor = revisions.get(cursor.parentId);
    }
    for (const id of path) done.add(id);
  }
  const reachable = new Set(), usedVersions = new Set();
  for (const b of branches.values()) {
    const ancestors = new Set(lineage(value, b.headRevisionId).map(r => r.id));
    for (const id of ancestors) reachable.add(id);
    if (b.parentBranchId !== null && (!ancestors.has(b.forkRevisionId) ||
        !lineage(value, branches.get(b.parentBranchId).headRevisionId).some(r => r.id === b.forkRevisionId))) bad('fork does not belong to parent ancestry.');
    const head = revisions.get(b.headRevisionId);
    if (head.branchId !== b.id && head.id !== b.forkRevisionId) bad('branch head points to another branch.');
    if (![...b.undo, ...b.redo].every(id => ancestors.has(id))) bad('recovery pointer is outside branch ancestry.');
  }
  if (reachable.size !== revisions.size) bad('unreachable revisions.');
  for (const r of revisions.values()) {
    r.paragraphVersionIds.forEach(id => usedVersions.add(id));
    if (r.restoredFrom && !lineage(value, r.parentId).some(p => p.id === r.restoredFrom)) bad('restore source is outside ancestry.');
  }
  if (usedVersions.size !== versions.size) bad('unreferenced passage versions.');
  validateMemory(value);
  for (const revision of revisions.values()) if (revision.generation) validateContext(revision.generation.context, value, revision.branchId);
  return copy(value);
}

function addRevision(workspace, content, summary, source, restoredFrom = null, versionIds = null, operationId = null, context = null) {
  const branch = workspace.branches.find(b => b.id === workspace.activeBranchId);
  const prior = workspace.revisions.find(r => r.id === branch.headRevisionId);
  if (!versionIds) {
    const old = new Map((prior?.paragraphVersionIds || []).map(id => {
      const p = workspace.paragraphVersions.find(p => p.id === id); return [p.paragraphId, p];
    }));
    versionIds = content.paragraphs.map(p => {
      const previous = old.get(p.id);
      if (previous?.text === p.text) return previous.id;
      const version = { id: uuid(), paragraphId: p.id, text: p.text };
      workspace.paragraphVersions.push(version); return version.id;
    });
  }
  const revision = { id: uuid(), branchId: branch.id, parentId: prior?.id || null, title: content.title,
    paragraphVersionIds: [...versionIds], createdAt: new Date().toISOString(), summary, source, restoredFrom,
    generation: source === 'offline' ? { operationId: operationId || uuid(), provider: 'offline-template', model: null, settings: {}, steering: null, context: copy(context) } : null };
  workspace.revisions.push(revision); branch.headRevisionId = revision.id;
  return revision.id;
}
export function migrateProject(project) {
  project = validateProject(project);
  const branch = { id: project.branchId, name: 'Main', parentBranchId: null, forkRevisionId: null, headRevisionId: null, archived: false, undo: [], redo: [] };
  const workspace = { schemaVersion: 2, id: project.id, activeBranchId: branch.id, branches: [branch], revisions: [], paragraphVersions: [] };
  addRevision(workspace, project, 'Imported draft', 'migration');
  return validateWorkspace(workspace);
}
export function parseWorkspace(raw) {
  if (new TextEncoder().encode(raw).length > MAX_WORKSPACE_BYTES) bad('import exceeds 20 MB.');
  const value = JSON.parse(raw);
  return value?.schemaVersion === 1 ? migrateProject(value) : validateWorkspace(value);
}
export function createWorkspace() {
  const workspace = migrateProject(createProject());
  workspace.revisions[0].source = 'initial'; workspace.revisions[0].summary = 'Started draft'; return workspace;
}

export class BranchEditor {
  #workspace;
  #importBackup = null;
  constructor(workspace = createWorkspace(), importBackup = null) {
    this.#workspace = validateWorkspace(workspace); this.epoch = 0;
    if (importBackup !== null) {
      if (!shape(importBackup, ['direction', 'workspace']) || !['undo', 'redo'].includes(importBackup.direction)) bad('invalid import recovery.');
      this.#importBackup = { direction: importBackup.direction, workspace: validateWorkspace(importBackup.workspace) };
    }
  }
  get workspace() { return copy(this.#workspace); }
  get importBackup() { return copy(this.#importBackup); }
  get branch() { return copy(this.#workspace.branches.find(b => b.id === this.#workspace.activeBranchId)); }
  get project() {
    const b = this.branch;
    return { schemaVersion: 1, id: this.#workspace.id, branchId: b.id, revision: b.headRevisionId, ...revisionContent(this.#workspace, b.headRevisionId) };
  }
  get undoStack() { return this.#importBackup?.direction === 'undo' ? ['import'] : this.branch.undo; }
  get redoStack() { return this.#importBackup?.direction === 'redo' ? ['import'] : this.branch.redo; }
  #transact(action) {
    const next = copy(this.#workspace); action(next); const validated = validateWorkspace(next);
    if (JSON.stringify(validated) === JSON.stringify(this.#workspace)) return;
    this.#workspace = validated;
    this.#importBackup = null; this.epoch++;
  }
  edit(title, paragraphs, source = 'manual', operationId = null, context = null) {
    const project = this.project;
    const content = validateProject({ ...project, revision: 0, title, paragraphs });
    if (title === project.title && JSON.stringify(paragraphs) === JSON.stringify(project.paragraphs)) return;
    this.#transact(next => {
      const b = next.branches.find(b => b.id === next.activeBranchId);
      b.undo.push(b.headRevisionId); b.undo = b.undo.slice(-50); b.redo = [];
      addRevision(next, content, source === 'offline' ? 'Offline sample continuation' : 'Edited draft', source, null, null, operationId, context);
    });
  }
  append(text, source = 'manual', operationId = null, context = null) { this.edit(this.project.title, [...this.project.paragraphs, { id: uuid(), text }], source, operationId, context); }
  replace(workspace) {
    const next = validateWorkspace(workspace);
    this.#importBackup = { direction: 'undo', workspace: this.workspace }; this.#workspace = next; this.epoch++;
  }
  restore(direction) {
    if (!['undo', 'redo'].includes(direction)) bad('unknown recovery action.');
    if (this.#importBackup?.direction === direction) {
      const prior = this.workspace; this.#workspace = this.#importBackup.workspace;
      this.#importBackup = { direction: direction === 'undo' ? 'redo' : 'undo', workspace: prior }; this.epoch++; return;
    }
    if (!this.branch[direction].length) return;
    this.#transact(next => {
      const b = next.branches.find(b => b.id === next.activeBranchId);
      const targetId = b[direction].pop(); const target = next.revisions.find(r => r.id === targetId);
      b[direction === 'undo' ? 'redo' : 'undo'].push(b.headRevisionId);
      addRevision(next, target, direction === 'undo' ? 'Undo edit' : 'Redo edit', direction, targetId, target.paragraphVersionIds);
    });
  }
  restoreRevision(revisionId) {
    if (!lineage(this.#workspace, this.branch.headRevisionId).some(r => r.id === revisionId)) bad('restore must use an ancestor of this branch.');
    this.#transact(next => {
      const b = next.branches.find(b => b.id === next.activeBranchId), target = next.revisions.find(r => r.id === revisionId);
      b.undo.push(b.headRevisionId); b.undo = b.undo.slice(-50); b.redo = [];
      addRevision(next, target, 'Restored earlier draft', 'restore', revisionId, target.paragraphVersionIds);
    });
  }
  fork(name, revisionId = this.branch.headRevisionId) {
    if (!lineage(this.#workspace, this.branch.headRevisionId).some(r => r.id === revisionId)) bad('fork must use this branch ancestry.');
    const branchId = uuid();
    this.#transact(next => {
      next.branches.push({ id: branchId, name: name.trim(), parentBranchId: next.activeBranchId, forkRevisionId: revisionId,
        headRevisionId: revisionId, archived: false, undo: [], redo: [], memoryFactIds: inheritedFactIds(next, revisionId) }); next.activeBranchId = branchId;
    });
    return branchId;
  }
  switchBranch(branchId) {
    if (branchId === this.branch.id) return;
    this.#transact(next => {
      const b = next.branches.find(b => b.id === branchId);
      if (!b || b.archived) bad('open a non-archived branch.'); next.activeBranchId = branchId;
    });
  }
  rename(name) { this.#transact(next => { next.branches.find(b => b.id === next.activeBranchId).name = name.trim(); }); }
  archive(branchId, archived = true) {
    this.#transact(next => {
      const b = next.branches.find(b => b.id === branchId);
      if (!b || (b.id === next.activeBranchId && archived)) bad('switch away before archiving this branch.'); b.archived = archived;
    });
  }
  proposeFact(input) { let result; this.#transact(next => { result = addCandidate(next, input); }); return result; }
  extractFacts(paragraphVersionId = null, narrativeTime = 0) { let count; this.#transact(next => { count = extractCandidates(next, paragraphVersionId, narrativeTime); }); return count; }
  updateFact(factId, updates = {}, status = 'pending', revalidate = false) { let result; this.#transact(next => { result = reviseFact(next, factId, updates, status, revalidate); }); return result; }
  static fromLegacy(editor) {
    const result = new BranchEditor(migrateProject(editor.project));
    const current = editor.project, states = [...editor.undoStack, current, ...[...editor.redoStack].reverse()];
    const workspace = migrateProject(states[0]); workspace.id = current.id;
    const branch = workspace.branches[0]; branch.id = current.branchId; workspace.activeBranchId = branch.id;
    workspace.revisions[0].branchId = branch.id;
    const ids = [branch.headRevisionId];
    for (const state of states.slice(1)) ids.push(addRevision(workspace, state, 'Recovered earlier editor history', 'migration'));
    branch.undo = ids.slice(0, editor.undoStack.length);
    branch.redo = ids.slice(editor.undoStack.length + 1).reverse();
    if (editor.redoStack.length) addRevision(workspace, current, 'Recovered active draft', 'migration');
    result.#workspace = validateWorkspace(workspace); return result;
  }
}
export function compareRevisions(workspace, leftId, rightId) {
  const left = revisionContent(workspace, leftId), right = revisionContent(workspace, rightId);
  const a = new Map(left.paragraphs.map(p => [p.id, p.text])), b = new Map(right.paragraphs.map(p => [p.id, p.text]));
  return { leftTitle: left.title, rightTitle: right.title, changes: [...new Set([...a.keys(), ...b.keys()])].map(id => ({
    id, before: a.get(id), after: b.get(id), kind: !a.has(id) ? 'added' : !b.has(id) ? 'removed' : a.get(id) !== b.get(id) ? 'changed' : left.paragraphs.findIndex(p => p.id === id) !== right.paragraphs.findIndex(p => p.id === id) ? 'moved' : 'unchanged',
  })) };
}
