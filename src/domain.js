export const MAX_BYTES = 2_000_000;
export const MAX_HISTORY_BYTES = 8_000_000;
const MAX_TEXT = 20_000;
const clone = value => structuredClone(value);
const id = () => crypto.randomUUID();
const fail = () => { throw new Error('Invalid project. Import a supported StoryFlow export.'); };
const string = (v, max) => typeof v === 'string' && v.length <= max;

export function validateProject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const keys = ['schemaVersion', 'id', 'branchId', 'title', 'revision', 'paragraphs'];
  if (Object.keys(value).some(key => !keys.includes(key))) fail();
  if (value.schemaVersion !== 1 || !string(value.id, 100) || !value.id ||
      !string(value.branchId, 100) || !value.branchId || !string(value.title, 200) ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Array.isArray(value.paragraphs) || value.paragraphs.length > 200) fail();
  const ids = new Set();
  for (const paragraph of value.paragraphs) {
    if (!paragraph || typeof paragraph !== 'object' || Array.isArray(paragraph) ||
        Object.keys(paragraph).some(key => !['id', 'text'].includes(key)) ||
        !string(paragraph.id, 100) || !paragraph.id || ids.has(paragraph.id) ||
        !string(paragraph.text, MAX_TEXT)) fail();
    ids.add(paragraph.id);
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_BYTES) fail();
  return clone(value);
}

export function parseProject(text) {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Project exceeds the 2 MB import limit.');
  return validateProject(JSON.parse(text));
}

export function createProject() {
  return { schemaVersion: 1, id: id(), branchId: id(), title: 'The last light', revision: 0,
    paragraphs: [{ id: id(), text: 'Every evening, Mara lit the lighthouse for ships that never came. Tonight, a light answered from beneath the water.' }] };
}

export class Editor {
  constructor(project) { this.project = validateProject(project); this.undoStack = []; this.redoStack = []; this.epoch = 0; }
  commit(next) {
    next = validateProject(next);
    if (JSON.stringify(next) === JSON.stringify(this.project)) return;
    const revision = this.project.revision + 1;
    if (!Number.isSafeInteger(revision)) throw new Error('Revision limit reached. Export your project.');
    this.undoStack.push(clone(this.project));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    this.trimHistory();
    this.project = { ...next, revision };
    this.epoch++;
  }
  edit(title, paragraphs) { this.commit({ ...this.project, title, paragraphs }); }
  append(text) { this.edit(this.project.title, [...this.project.paragraphs, { id: id(), text }]); }
  restore(direction) {
    if (!['undo', 'redo'].includes(direction)) throw new Error('Unknown history action.');
    const from = direction === 'undo' ? this.undoStack : this.redoStack;
    const to = direction === 'undo' ? this.redoStack : this.undoStack;
    if (!from.length) return;
    if (!Number.isSafeInteger(this.project.revision + 1)) throw new Error('Revision limit reached. Export your project.');
    to.push(clone(this.project));
    this.project = { ...from.pop(), revision: this.project.revision + 1 };
    this.trimHistory();
    this.epoch++;
  }
  trimHistory() {
    while (new TextEncoder().encode(JSON.stringify([this.undoStack, this.redoStack])).length > MAX_HISTORY_BYTES) {
      if (this.undoStack.length) this.undoStack.shift();
      else this.redoStack.shift();
    }
  }
}
