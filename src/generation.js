export class Generation {
  constructor(editor) { this.editor = editor; this.operation = null; }
  begin() {
    this.cancel();
    const p = this.editor.project;
    return this.operation = { id: crypto.randomUUID(), projectId: p.id, branchId: p.branchId,
      revision: p.revision, epoch: this.editor.epoch, status: 'running', text: '' };
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
    this.editor.append(operation.text, 'offline', operation.id);
    operation.status = 'complete'; return true;
  }
}

export async function* offlineContinuation() {
  const text = 'Mara held her breath. The answering light blinked twice, then once more, tracing the signal her father had taught her years ago. She reached for the brass telescope, but the water had already gone dark.';
  for (const word of text.split(' ')) {
    await new Promise(resolve => setTimeout(resolve, 65));
    yield word + ' ';
  }
}
