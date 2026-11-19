import { ReviewController, findingStaleReason, reviewTrace } from './review.js';
import { lineage } from './history.js';
const $ = id => document.getElementById(id);
const node = (tag, text) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
export function createReviewUI({ getEditor, canMutate, onMutation, onStateChange, persist, onError, download }) {
  let selectedRun = '', lastBranch = null, lastProject = null, lastCount = 0, chosenRevision = false;
  const drafts = new Map();
  const controller = new ReviewController(getEditor(), { onChange: () => { render(); onStateChange(); }, persist, onError });
  const safe = action => { try { if (!canMutate()) return; action(); onMutation(); } catch (error) { onError(error); } };
  const options = () => ({ baseRevisionId: $('review-revision').value, start: Number($('review-from').value), end: Number($('review-to').value), narrativeTime: Number($('review-time').value), viewpoint: $('review-viewpoint').value.trim(),
    maxCalls: Number($('review-calls').value), maxTokens: Number($('review-tokens').value), maxMs: Number($('review-ms').value), maxFindings: Number($('review-findings-limit').value), maxCost: 0 });
  $('review-revision').onchange = () => { chosenRevision = true; updateRange(); };
  $('review-current').onclick = () => { chosenRevision = false; $('review-revision').value = getEditor().branch.headRevisionId; updateRange(); };
  $('review-run').onchange = () => { selectedRun = $('review-run').value; render(); };
  $('review-start').onclick = async () => {
    if (!canMutate()) return;
    try { const pending = controller.start(options()); selectedRun = controller.runId; render(); await pending; }
    catch (error) { onError(error); }
  };
  $('review-cancel').onclick = () => { try { controller.cancel(); } catch (error) { onError(error); } };
  $('review-trace').onclick = () => { const run = getEditor().workspace.reviewRuns.find(r => r.id === selectedRun); if (run) download(JSON.stringify(reviewTrace(run), null, 2), 'storyflow-review-trace.json', 'application/json'); };
  function updateRange() {
    const revision = getEditor().workspace.revisions.find(r => r.id === $('review-revision').value); if (!revision) return;
    const count = revision.paragraphVersionIds.length;
    for (const name of ['review-from', 'review-to']) $(name).max = Math.max(1, count);
    if (!lastCount || !$('review-to').value || Number($('review-to').value) === lastCount || Number($('review-to').value) > count) $('review-to').value = Math.max(1, count);
    if (Number($('review-from').value) > count) $('review-from').value = 1;
    lastCount = count;
  }
  function showEvidence(run, finding) {
    const workspace = getEditor().workspace; $('review-evidence').hidden = false; $('review-evidence-content').replaceChildren();
    for (const [name, evidence] of [['Approved memory source', finding.sourceEvidence], ['Reviewed passage', finding.targetEvidence]]) {
      const passage = workspace.paragraphVersions.find(p => p.id === evidence.paragraphVersionId), section = node('section');
      section.append(node('h4', name), node('p', `Revision ${evidence.revisionId} · passage version ${evidence.paragraphVersionId} · characters ${evidence.start}–${evidence.end}`));
      const prose = node('p'); prose.className = 'review-quote'; prose.append(document.createTextNode(passage.text.slice(0, evidence.start)), node('mark', evidence.quote), document.createTextNode(passage.text.slice(evidence.end))); section.append(prose); $('review-evidence-content').append(section);
    }
    $('review-evidence').focus();
  }
  function card(workspace, run, finding) {
    const article = node('article'); article.className = 'review-finding'; article.dataset.findingId = finding.id;
    article.append(node('h3', finding.type === 'possession' ? 'Possible possession conflict' : 'Possible direct negation conflict'), node('p', finding.explanation), node('p', finding.uncertainty), node('blockquote', `Approved: ${finding.sourceEvidence.quote}`), node('blockquote', `Draft: ${finding.targetEvidence.quote}`));
    const evidence = node('button', 'Inspect both passages'); evidence.onclick = () => showEvidence(run, finding); article.append(evidence);
    const stale = findingStaleReason(workspace, run, finding), actionable = ['findings_ready', 'resolved', 'budget_exhausted'].includes(run.status) && finding.decision === 'pending';
    article.append(node('p', `Decision: ${finding.decision}${stale && finding.decision === 'pending' ? ` · STALE: ${stale}` : ''}`));
    const label = node('label', 'Proposed replacement'), replacement = node('textarea'); replacement.setAttribute('aria-label', 'Proposed replacement'); replacement.maxLength = 20_000; replacement.rows = 4;
    replacement.value = finding.appliedReplacement ?? drafts.get(finding.id)?.text ?? finding.patch.replacement; replacement.readOnly = !canMutate() || finding.decision !== 'pending'; label.append(replacement); article.append(label);
    const reasonLabel = node('label', 'Decision reason'), reason = node('input'); reason.setAttribute('aria-label', 'Decision reason'); reason.maxLength = 500; reason.value = drafts.get(finding.id)?.reason ?? finding.reason; reason.disabled = !canMutate() || !actionable; reasonLabel.append(reason); article.append(reasonLabel);
    const actions = node('div'); actions.className = 'history-actions';
    const apply = node('button', 'Apply patch'); apply.disabled = !canMutate() || !actionable || !!stale;
    apply.onclick = () => safe(() => getEditor().applyReviewPatch(run.id, finding.id, replacement.value));
    const dismiss = node('button', 'Dismiss finding'); dismiss.disabled = !canMutate() || !actionable;
    dismiss.onclick = () => safe(() => getEditor().decideFinding(run.id, finding.id, 'dismissed', reason.value));
    const intentional = node('button', 'Mark intentional'); intentional.disabled = !canMutate() || !actionable;
    intentional.onclick = () => safe(() => getEditor().decideFinding(run.id, finding.id, 'intentional', reason.value));
    actions.append(apply, dismiss, intentional); article.append(actions); return article;
  }
  function updateControls() {
    $('review-start').disabled = !canMutate() || controller.active || !getEditor().project.paragraphs.length;
    // Cancellation is read-only with respect to prose and remains available during an unapplied edit.
    $('review-cancel').disabled = !controller.active;
  }
  function render() {
    const editor = getEditor(), workspace = editor.workspace, branch = editor.branch;
    const active = document.activeElement, activeCard = active?.closest('.review-finding');
    const focus = activeCard && ['TEXTAREA', 'INPUT'].includes(active.tagName) ? { id: activeCard.dataset.findingId, kind: active.tagName, start: active.selectionStart, end: active.selectionEnd } : null;
    for (const article of $('review-findings').querySelectorAll('article')) {
      drafts.delete(article.dataset.findingId); drafts.set(article.dataset.findingId, { text: article.querySelector('textarea').value, reason: article.querySelector('input').value });
    }
    if (lastProject && lastProject !== workspace.id) drafts.clear(); while (drafts.size > 100) drafts.delete(drafts.keys().next().value);
    if (lastBranch !== branch.id || lastProject !== workspace.id) { selectedRun = ''; chosenRevision = false; $('review-evidence').hidden = true; }
    const selectedRevision = chosenRevision ? $('review-revision').value : branch.headRevisionId;
    $('review-revision').replaceChildren(...lineage(workspace, branch.headRevisionId).map(r => { const option = node('option', `${r.summary} · ${r.id.slice(0, 8)}`); option.value = r.id; return option; }));
    $('review-revision').value = workspace.revisions.some(r => r.id === selectedRevision) ? selectedRevision : branch.headRevisionId; updateRange();
    const runs = workspace.reviewRuns.filter(r => r.branchId === branch.id).reverse();
    if (!runs.some(r => r.id === selectedRun)) selectedRun = runs[0]?.id || '';
    $('review-run').replaceChildren(...runs.map(r => { const option = node('option', `${r.status} · ${r.findings.length} findings · ${r.id.slice(0, 8)}`); option.value = r.id; return option; })); $('review-run').value = selectedRun;
    const run = runs.find(r => r.id === selectedRun), activeRun = workspace.reviewRuns.find(r => r.id === controller.runId);
    $('review-active-status').textContent = controller.active && activeRun ? `Review running on ${workspace.branches.find(b => b.id === activeRun.branchId).name}; writing and saving remain available.` : 'Local review · no AI calls · cost $0.';
    $('review-findings').replaceChildren(...(run ? run.findings.map(f => card(workspace, run, f)) : []));
    $('review-status').textContent = run ? `${run.status} · ${run.findings.length} findings · ${run.counters.toolCalls}/${run.settings.maxCalls} calls · ${run.counters.estimatedTokens}/${run.settings.maxTokens} estimated input tokens · ${run.counters.elapsedMs} ms · ${run.message}` : 'No reviews on this branch yet.';
    $('review-diagnostics').textContent = run ? JSON.stringify(reviewTrace(run), null, 2) : 'No trace yet.'; $('review-trace').disabled = !run;
    $('review-exceptions').replaceChildren(...workspace.reviewExceptions.filter(e => e.active && e.branchId === branch.id).map(e => { const section = node('p', e.reason), button = node('button', 'Reconsider exception'); button.disabled = !canMutate(); button.onclick = () => safe(() => editor.reconsiderException(e.id)); section.append(button); return section; }));
    if (!$('review-exceptions').children.length) $('review-exceptions').append(node('p', 'No active intentional exceptions.'));
    lastBranch = branch.id; lastProject = workspace.id; updateControls();
    if (focus) {
      const article = [...$('review-findings').querySelectorAll('article')].find(a => a.dataset.findingId === focus.id), field = article?.querySelector(focus.kind.toLowerCase());
      if (field && !field.disabled) { field.focus({ preventScroll: true }); if (typeof focus.start === 'number') field.setSelectionRange(focus.start, focus.end); }
    }
  }
  return { controller, render, updateControls };
}
