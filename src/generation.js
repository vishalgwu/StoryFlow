import { validateContext } from './memory.js';

export class Generation {
  constructor(editor) { this.editor = editor; this.operation = null; }
  begin(context = null) {
    if (context) {
      validateContext(context, this.editor.workspace, this.editor.project.branchId);
      if (context.status !== 'ready' || context.baseRevisionId !== this.editor.project.revision) throw new Error('Context is blocked or out of date. Prepare it again before generation.');
    }
    this.cancel();
    const p = this.editor.project;
    return this.operation = { id: crypto.randomUUID(), projectId: p.id, branchId: p.branchId,
      revision: p.revision, epoch: this.editor.epoch, status: 'running', text: '', context: structuredClone(context) };
  }
  cancel() { if (this.operation?.status === 'running') this.operation.status = 'canceled'; }
  finish(operation) {
    const p = this.editor.project;
    if (operation !== this.operation || operation.status !== 'running') return false;
    if (p.id !== operation.projectId || p.branchId !== operation.branchId ||
        p.revision !== operation.revision || this.editor.epoch !== operation.epoch) {
      operation.status = 'stale'; return false;
    }
    if (!operation.text.trim()) { operation.status = 'failed'; return false; }
    this.editor.append(operation.text, 'offline', operation.id, operation.context);
    operation.status = 'complete'; return true;
  }
}

export async function* offlineContinuation(context = null) {
  const text = context?.included.length ? `${context.included[0].claim} A quiet moment followed, leaving space for the next decision.` : 'Mara held her breath. The answering light blinked twice, then once more, tracing the signal her father had taught her years ago. She reached for the brass telescope, but the water had already gone dark.';
  for (const word of text.split(' ')) {
    await new Promise(resolve => setTimeout(resolve, 65));
    yield word + ' ';
  }
}
