import { lineage, revisionContent, compareRevisions } from './history.js';

const $ = id => document.getElementById(id);
const element = (tag, text, className) => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text;
  if (className) node.className = className; return node;
};
export function createExplorer({ getEditor, canMutate, onMutation, onError }) {
  let currentBranch = null, currentHead = null;
  let comparisonChosen = false;
  for (const id of ['compare-left', 'compare-right']) $(id).onchange = () => { comparisonChosen = true; };
  const safe = action => {
    try { if (!canMutate()) return; action(); onMutation(); }
    catch (error) { onError(error); }
  };
  const name = () => {
    if ($('branch-name').value.trim()) return $('branch-name').value.trim();
    const names = getEditor().workspace.branches.map(b => b.name.toLowerCase());
    let count = 1; while (names.includes(`Alternative ${count}`.toLowerCase())) count++;
    return `Alternative ${count}`;
  };
  $('branch-select').onchange = () => safe(() => getEditor().switchBranch($('branch-select').value));
  $('fork').onclick = () => safe(() => { getEditor().fork(name()); $('branch-name').value = ''; });
  $('fork-revision').onclick = () => safe(() => { getEditor().fork(name(), $('revision-select').value); $('branch-name').value = ''; });
  $('rename-branch').onclick = () => safe(() => {
    if (!$('branch-name').value.trim()) throw new Error('Enter a branch name before renaming.');
    getEditor().rename(name()); $('branch-name').value = '';
  });
  $('restore-revision').onclick = () => safe(() => {
    if (confirm('Restore this revision as a new revision? Later writing will remain in history and Undo will be available.')) getEditor().restoreRevision($('revision-select').value);
  });
  const showRevision = () => {
    const workspace = getEditor().workspace, id = $('revision-select').value;
    const revision = workspace.revisions.find(r => r.id === id); if (!revision) return;
    const content = revisionContent(workspace, id);
    $('revision-info').textContent = `${revision.summary} · ${revision.source} · ${new Date(revision.createdAt).toLocaleString()} · ${revision.id.slice(0, 8)}${revision.restoredFrom ? ` · recovered from ${revision.restoredFrom.slice(0, 8)}` : ''}${revision.generation ? ` · ${revision.generation.provider} · no model or steering settings · run ${revision.generation.operationId.slice(0, 8)}` : ''}`;
    $('revision-preview').textContent = [content.title, ...content.paragraphs.map(p => p.text)].join('\n\n');
    updateControls();
  };
  $('revision-select').onchange = showRevision;
  $('compare').onclick = () => {
    try {
      const workspace = getEditor().workspace;
      const diff = compareRevisions(workspace, $('compare-left').value, $('compare-right').value);
      const result = $('comparison-result'); result.replaceChildren();
      result.append(element('p', 'Removed text is struck through; added text is underlined. Unchanged passages are omitted.', 'hint'));
      if (diff.leftTitle !== diff.rightTitle) {
        const title = element('p'); title.append(element('strong', 'Title: '), element('del', diff.leftTitle), element('ins', diff.rightTitle)); result.append(title);
      }
      let count = 0;
      for (const change of diff.changes.filter(c => c.kind !== 'unchanged')) {
        count++;
        const row = element('section', undefined, 'diff-row'); row.append(element('h4', `Passage ${count} · ${change.kind}`));
        if (change.before !== undefined) row.append(element('del', change.before));
        if (change.after !== undefined) row.append(element('ins', change.after));
        result.append(row);
      }
      if (!count && diff.leftTitle === diff.rightTitle) result.append(element('p', 'These revisions have the same title and prose.'));
    } catch (error) { onError(error); }
  };
  function updateControls() {
    const disabled = !canMutate();
    for (const id of ['branch-select', 'branch-name', 'fork', 'rename-branch', 'fork-revision']) $(id).disabled = disabled;
    $('restore-revision').disabled = disabled || $('revision-select').value === getEditor().branch.headRevisionId;
    for (const button of $('branch-tree').querySelectorAll('button')) button.disabled = disabled || button.dataset.active === 'true';
  }
  function render() {
    const editor = getEditor(), workspace = editor.workspace, active = editor.branch;
    const branches = new Map(workspace.branches.map(b => [b.id, b]));
    const option = (value, label) => { const o = element('option', label); o.value = value; return o; };
    $('branch-select').replaceChildren(...workspace.branches.filter(b => !b.archived).map(b => option(b.id, b.name)));
    $('branch-select').value = active.id;
    $('revision-count').textContent = `${workspace.branches.length} path${workspace.branches.length === 1 ? '' : 's'} · ${workspace.revisions.length} revision${workspace.revisions.length === 1 ? '' : 's'}`;
    $('branch-tree').replaceChildren();
    const tree = (parentId, target) => {
      for (const b of workspace.branches.filter(b => b.parentBranchId === parentId)) {
        const row = element('li', undefined, b.id === active.id ? 'branch-node active-branch' : 'branch-node');
        const title = element('strong', `${b.name}${b.archived ? ' (archived)' : b.id === active.id ? ' · active' : ''}`);
        const head = workspace.revisions.find(r => r.id === b.headRevisionId), content = revisionContent(workspace, b.headRevisionId);
        const excerpt = content.paragraphs.map(p => p.text).join(' ');
        row.append(title, element('p', (excerpt.length > 110 ? excerpt.slice(0, 110).trimEnd() + '…' : excerpt) || 'Empty draft', 'hint'));
        row.append(element('small', `${b.parentBranchId ? `Forked from ${branches.get(b.parentBranchId).name} at ${b.forkRevisionId.slice(0, 8)}` : 'Original path'} · ${new Date(head.createdAt).toLocaleString()}`));
        const actions = element('div', undefined, 'history-actions');
        const open = element('button', b.archived ? `Reopen ${b.name}` : `Open ${b.name}`);
        open.dataset.active = String(b.id === active.id);
        open.onclick = () => safe(() => b.archived ? editor.archive(b.id, false) : editor.switchBranch(b.id));
        actions.append(open);
        if (b.id !== active.id && !b.archived) {
          const archive = element('button', `Archive ${b.name}`); archive.onclick = () => safe(() => editor.archive(b.id)); actions.append(archive);
        }
        row.append(actions);
        const children = element('ol'); tree(b.id, children); if (children.children.length) row.append(children);
        target.append(row);
      }
    };
    tree(null, $('branch-tree'));
    const history = lineage(workspace, active.headRevisionId);
    const label = r => `${branches.get(r.branchId).name} · ${r.summary} · ${r.id.slice(0, 8)}`;
    const selected = currentBranch === active.id && currentHead === active.headRevisionId ? $('revision-select').value : active.headRevisionId;
    $('revision-select').replaceChildren(...history.map(r => option(r.id, label(r))));
    $('revision-select').value = selected || active.headRevisionId;
    for (const id of ['compare-left', 'compare-right']) {
      const selectedId = $(id).value;
      $(id).replaceChildren(...[...workspace.revisions].reverse().map(r => option(r.id, label(r))));
      $(id).value = comparisonChosen && workspace.revisions.some(r => r.id === selectedId) ? selectedId : id === 'compare-left' ? history[1]?.id || history[0].id : history[0].id;
    }
    currentBranch = active.id; currentHead = active.headRevisionId;
    showRevision(); updateControls();
  }
  return { render, updateControls };
}
