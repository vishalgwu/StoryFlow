import { CATEGORIES, visibleFacts, evidenceState, assembleContext } from './memory.js';
const $ = id => document.getElementById(id);
const node = (tag, text) => { const result = document.createElement(tag); if (text !== undefined) result.textContent = text; return result; };
const namedInput = (form, label, value, type = 'text') => {
  const wrapper = node('label', label), input = node(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  if (type === 'checkbox') input.checked = value; else input.value = value;
  wrapper.append(input); form.append(wrapper); return input;
};
const select = (form, label, values, value) => {
  const wrapper = node('label', label), input = node('select');
  input.setAttribute('aria-label', label);
  values.forEach(v => { const option = node('option', v.replaceAll('_', ' ')); option.value = v; input.append(option); });
  input.value = value; wrapper.append(input); form.append(wrapper); return input;
};
const names = raw => raw.split(',').map(v => v.trim()).filter(Boolean);
export function createMemoryUI({ getEditor, canMutate, onMutation, onError }) {
  let page = 0, lastRevision = null, lastProject = null, lastStamp = null, lastBranch = null;
  const formDrafts = new Map();
  const stalePreview = () => { if (!$('memory-context').hidden) $('memory-context-status').textContent = 'Context preview is from an earlier draft, memory decision, or setting. Prepare context again for the next request. Captured sample context remains inspectable separately.'; };
  for (const id of ['memory-query', 'memory-time', 'memory-viewpoint', 'memory-budget']) $(id).addEventListener('input', stalePreview);
  const safe = action => { try { if (!canMutate()) return; const message = action(); onMutation(); if (message) $('memory-status').textContent = message; if (!document.activeElement || document.activeElement === document.body) $('memory-status').focus(); } catch (error) { onError(error); } };
  const options = () => ({ query: $('memory-query').value, narrativeTime: Number($('memory-time').value), viewpoint: $('memory-viewpoint').value.trim(), budget: Number($('memory-budget').value) });
  function showEvidence(fact) {
    const workspace = getEditor().workspace, evidence = fact.evidence;
    const passage = workspace.paragraphVersions.find(p => p.id === evidence.paragraphVersionId);
    $('memory-evidence').hidden = false;
    $('memory-evidence-info').textContent = `Revision ${evidence.revisionId} · passage version ${evidence.paragraphVersionId} · characters ${evidence.start}–${evidence.end}. ${evidenceState(workspace, fact).reason}`;
    const text = $('memory-evidence-text'); text.replaceChildren();
    text.append(document.createTextNode(passage.text.slice(0, evidence.start)), node('mark', evidence.quote), document.createTextNode(passage.text.slice(evidence.end)));
    $('memory-evidence').focus();
  }
  function showContext(context) {
    $('memory-context').hidden = false; $('memory-included').replaceChildren(); $('memory-omitted').replaceChildren();
    $('memory-context-status').textContent = context.status === 'blocked' ? `Blocked: required instructions and locked facts need at least ${context.requiredTokens} estimated input tokens. Increase the budget or explicitly unlock a rule. No request will be made.` : `${context.included.length} approved facts included · ${context.estimatedTokens}/${context.budget} estimated input tokens · time ${context.narrativeTime} · viewpoint ${context.viewpoint || 'reader'} · revision ${context.baseRevisionId.slice(0, 8)}`;
    const workspace = getEditor().workspace;
    const origin = workspace.branches.find(b => b.id === context.branchId);
    $('memory-context-status').textContent += ` · captured for branch ${origin?.name || context.branchId}`;
    for (const item of context.included) {
      const li = node('li', `${item.claim} — ${item.reason}`), fact = workspace.memoryFacts.find(f => f.id === item.factId);
      if (fact) { const button = node('button', 'Inspect included evidence'); button.onclick = () => showEvidence(fact); li.append(button); }
      $('memory-included').append(li);
    }
    if (!context.included.length) $('memory-included').append(node('li', 'No approved facts included.'));
    for (const item of context.omitted) {
      const fact = workspace.memoryFacts.find(f => f.id === item.factId);
      $('memory-omitted').append(node('li', `${fact?.claim || item.factId} — ${item.reason}`));
    }
    $('memory-context-text').textContent = context.prompt || 'No context prepared because required locked constraints exceed the budget.';
  }
  function prepare() { const context = assembleContext(getEditor().workspace, options()); showContext(context); return context; }
  $('memory-prepare').onclick = () => { try { prepare(); } catch (error) { onError(error); } };
  $('memory-extract').onclick = () => safe(() => `${getEditor().extractFacts(null, Number($('memory-time').value))} local candidates proposed. Review the evidence before approval.`);
  $('memory-propose').onclick = () => safe(() => {
    const source = $('memory-source'); let start = source.selectionStart, end = source.selectionEnd;
    if (start === end) { start = 0; end = source.value.length; }
    const quote = source.value.slice(start, end);
    getEditor().proposeFact({ paragraphVersionId: $('memory-passage').value, start, end, claim: quote.slice(0, 1000), validFrom: Number($('memory-time').value) });
    return 'Pending candidate created. Edit its claim and type, then approve or dismiss.';
  });
  $('memory-passage').onchange = () => {
    const passage = getEditor().workspace.paragraphVersions.find(p => p.id === $('memory-passage').value);
    $('memory-source').value = passage?.text || '';
  };
  $('memory-filter').onchange = () => { page = 0; render(); };
  $('memory-prev').onclick = () => { page = Math.max(0, page - 1); render(); };
  $('memory-next').onclick = () => { page++; render(); };
  function card(fact, workspace) {
    const article = node('article'), state = evidenceState(workspace, fact);
    article.className = 'memory-card'; article.dataset.factId = fact.id;
    article.dataset.formKey = `${workspace.id}:${workspace.activeBranchId}:${fact.id}`;
    article.append(node('h4', fact.claim), node('p', `${fact.status} · ${fact.kind} · ${fact.category.replaceAll('_', ' ')}${state.stale ? ' · STALE EVIDENCE' : ''}${fact.locked ? ' · LOCKED' : ''}`));
    article.append(node('blockquote', fact.evidence.quote));
    const evidence = node('button', 'Open evidence'); evidence.onclick = () => showEvidence(fact); article.append(evidence);
    const details = node('details'), summary = node('summary', 'Edit claim, time, and character knowledge'); details.append(summary);
    const form = node('form'); form.onsubmit = event => event.preventDefault();
    const claim = namedInput(form, 'Claim', fact.claim, 'textarea'); claim.maxLength = 1000;
    const category = select(form, 'Category', CATEGORIES, fact.category), kind = select(form, 'Record type', ['fact', 'inference', 'plan'], fact.kind);
    const entities = namedInput(form, 'Entities (comma separated)', fact.entities.join(', ')); entities.maxLength = 1600;
    const from = namedInput(form, 'Valid from time step', fact.validFrom, 'number'); from.min = 0; from.max = 1000000;
    const until = namedInput(form, 'Valid until time step (blank means ongoing)', fact.validUntil ?? '', 'number'); until.min = 0; until.max = 1000000;
    const knows = namedInput(form, 'Characters who know (comma separated)', fact.knowledge.filter(k => k.state === 'knows').map(k => k.character).join(', '));
    const unaware = namedInput(form, 'Characters who do not know (comma separated)', fact.knowledge.filter(k => k.state === 'does_not_know').map(k => k.character).join(', '));
    const unknown = namedInput(form, 'Characters with unknown knowledge (comma separated)', fact.knowledge.filter(k => k.state === 'unknown').map(k => k.character).join(', '));
    for (const input of [knows, unaware, unknown]) input.maxLength = 1600;
    const reader = namedInput(form, 'Established for the reader', fact.readerKnows, 'checkbox');
    const locked = namedInput(form, 'Lock as a required fact (facts only)', fact.locked, 'checkbox');
    const values = () => ({ claim: claim.value.trim(), category: category.value, kind: kind.value, entities: names(entities.value), validFrom: Number(from.value), validUntil: until.value === '' ? null : Number(until.value),
      knowledge: [['knows', knows], ['does_not_know', unaware], ['unknown', unknown]].flatMap(([state, input]) => names(input.value).map(character => ({ character, state }))), readerKnows: reader.checked, locked: locked.checked });
    const save = node('button', 'Save proposal changes'); save.type = 'button'; save.dataset.mutation = 'true';
    save.onclick = () => safe(() => { getEditor().updateFact(fact.id, values()); return 'Changes saved as pending. Approval is required again.'; }); form.append(save);
    details.append(form); article.append(details);
    const actions = node('div'); actions.className = 'history-actions';
    const approve = node('button', 'Approve memory'); approve.dataset.mutation = 'true'; approve.dataset.stale = String(state.stale);
    approve.onclick = () => safe(() => { getEditor().updateFact(fact.id, values(), 'accepted'); return 'Memory accepted on this branch. Plans and inferences remain non-authoritative.'; });
    const dismiss = node('button', 'Dismiss memory'); dismiss.dataset.mutation = 'true';
    dismiss.onclick = () => safe(() => { getEditor().updateFact(fact.id, {}, 'dismissed'); return 'Memory dismissed on this branch.'; });
    actions.append(approve, dismiss);
    if (state.stale) {
      const revalidate = node('button', 'Revalidate evidence'); revalidate.dataset.mutation = 'true';
      revalidate.onclick = () => safe(() => { getEditor().updateFact(fact.id, values(), 'pending', true); return 'Evidence linked to the current passage. Review and approve again.'; }); actions.append(revalidate);
    }
    article.append(actions);
    const draft = formDrafts.get(article.dataset.formKey);
    if (draft) {
      details.open = draft.open;
      [...form.querySelectorAll('input,textarea,select')].forEach((input, i) => { input.value = draft.fields[i].value; if (input.type === 'checkbox') input.checked = draft.fields[i].checked; });
    }
    return article;
  }
  function updateControls() {
    const disabled = !canMutate();
    for (const id of ['memory-extract', 'memory-propose']) $(id).disabled = disabled;
    for (const button of $('memory-cards').querySelectorAll('button[data-mutation]')) button.disabled = disabled || button.dataset.stale === 'true';
    for (const field of $('memory-cards').querySelectorAll('input,textarea,select')) field.disabled = disabled;
  }
  function render() {
    const editor = getEditor(), workspace = editor.workspace, branch = editor.branch;
    const focused = document.activeElement, focusedCard = focused?.closest('.memory-card');
    const focus = focusedCard && focused.closest('form') ? { key: focusedCard.dataset.formKey,
      index: [...focusedCard.querySelectorAll('form input,form textarea,form select')].indexOf(focused), start: focused.selectionStart, end: focused.selectionEnd } : null;
    for (const article of $('memory-cards').querySelectorAll('article')) {
      formDrafts.delete(article.dataset.formKey);
      formDrafts.set(article.dataset.formKey, { open: article.querySelector('details').open,
        fields: [...article.querySelectorAll('form input,form textarea,form select')].map(input => ({ value: input.value, checked: input.checked })) });
    }
    if (lastProject && lastProject !== workspace.id) formDrafts.clear();
    while (formDrafts.size > 100) formDrafts.delete(formDrafts.keys().next().value);
    const stamp = `${workspace.id}:${branch.id}:${branch.headRevisionId}:${branch.memoryFactIds.join(',')}`;
    if (lastStamp !== null && stamp !== lastStamp) stalePreview();
    if (lastBranch !== null && lastBranch !== branch.id) {
      page = 0; $('memory-context').hidden = true; $('memory-evidence').hidden = true;
      $('memory-included').replaceChildren(); $('memory-omitted').replaceChildren(); $('memory-context-text').textContent = '';
    }
    if (lastProject !== workspace.id || lastRevision !== branch.headRevisionId) {
      const selected = $('memory-passage').value, source = $('memory-source');
      const selection = { text: source.value, start: source.selectionStart, end: source.selectionEnd };
      $('memory-passage').replaceChildren();
      const head = workspace.revisions.find(r => r.id === branch.headRevisionId);
      head.paragraphVersionIds.forEach((versionId, index) => { const option = node('option', `Passage ${index + 1}`); option.value = versionId; $('memory-passage').append(option); });
      if (head.paragraphVersionIds.includes(selected)) $('memory-passage').value = selected;
      $('memory-passage').onchange();
      if ($('memory-passage').value === selected && source.value === selection.text) source.setSelectionRange(selection.start, selection.end);
      $('memory-evidence').hidden = true;
      if (lastProject !== workspace.id) { page = 0; $('memory-context').hidden = true; }
    }
    const all = visibleFacts(workspace), filter = $('memory-filter').value;
    const facts = all.filter(f => filter === 'all' ? true : filter === 'stale' ? evidenceState(workspace, f).stale : f.status === filter);
    page = Math.min(page, Math.max(0, Math.ceil(facts.length / 25) - 1));
    $('memory-cards').replaceChildren(...facts.slice(page * 25, page * 25 + 25).map(f => card(f, workspace)));
    $('memory-count').textContent = `${all.length} records on ${branch.name} · ${facts.length} match this filter · page ${page + 1}. Accepted records with stale evidence are excluded until revalidated.`;
    if (!all.length) $('memory-cards').append(node('p', 'No memory yet. Propose facts from saved prose; nothing becomes authoritative automatically.'));
    $('memory-prev').disabled = page === 0; $('memory-next').disabled = (page + 1) * 25 >= facts.length;
    lastRevision = branch.headRevisionId; lastProject = workspace.id; lastStamp = stamp; lastBranch = branch.id; updateControls();
    if (focus) {
      const article = [...$('memory-cards').querySelectorAll('article')].find(article => article.dataset.formKey === focus.key);
      const field = article?.querySelectorAll('form input,form textarea,form select')[focus.index];
      if (field && !field.disabled) { field.focus({ preventScroll: true }); if (typeof focus.start === 'number') field.setSelectionRange(focus.start, focus.end); }
    }
  }
  return { render, updateControls, prepare, showContext };
}
