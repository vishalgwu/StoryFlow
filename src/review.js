import { visibleFacts, evidenceState } from './memory.js';
const clone = value => structuredClone(value);
const uid = () => crypto.randomUUID();
const bytes = value => new TextEncoder().encode(value).length;
const fail = message => { throw new Error(`Continuity review: ${message}`); };
const str = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || !!value.trim());
const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const terminal = new Set(['findings_ready', 'resolved', 'budget_exhausted', 'canceled', 'failed', 'interrupted']);
const applicable = new Set(['findings_ready', 'resolved', 'budget_exhausted']);
const toolNames = ['read_revision', 'read_accepted_facts', 'retrieve_passages', 'propose_patch'];
function ancestors(workspace, revisionId) {
  const revisions = new Map(workspace.revisions.map(r => [r.id, r])), result = new Set();
  while (revisionId !== null) { if (!revisions.has(revisionId) || result.has(revisionId)) fail('invalid revision scope.'); result.add(revisionId); revisionId = revisions.get(revisionId).parentId; }
  return result;
}
function decisions(workspace, branchId) {
  const facts = new Map(workspace.memoryFacts.map(f => [f.id, f])), result = new Set();
  const branch = workspace.branches.find(b => b.id === branchId);
  for (const factId of branch.memoryFactIds) {
    let fact = facts.get(factId); while (fact && !result.has(fact.id)) { result.add(fact.id); fact = facts.get(fact.previousId); }
  }
  return result;
}
function historicalFacts(workspace, branch, revisionId) {
  const allowed = ancestors(workspace, revisionId), facts = new Map(workspace.memoryFacts.map(f => [f.id, f])), result = [];
  for (let fact of visibleFacts(workspace, branch.id)) {
    while (fact && !allowed.has(fact.createdAtRevisionId)) fact = facts.get(fact.previousId);
    if (fact) result.push(fact);
  }
  return result;
}
function eligible(workspace, fact, revisionId, settings) {
  return fact.status === 'accepted' && fact.kind === 'fact' && !evidenceState(workspace, fact, revisionId).stale &&
    settings.narrativeTime >= fact.validFrom && (fact.validUntil === null || settings.narrativeTime <= fact.validUntil) &&
    (settings.viewpoint ? fact.knowledge.some(k => k.character.toLowerCase() === settings.viewpoint.toLowerCase() && k.state === 'knows') : fact.readerKnows);
}
export function reviewSettings(workspace, options = {}) {
  const branch = workspace.branches.find(b => b.id === workspace.activeBranchId);
  const baseRevisionId = options.baseRevisionId || branch.headRevisionId;
  if (!ancestors(workspace, branch.headRevisionId).has(baseRevisionId)) fail('review only revisions on the active branch.');
  const revision = workspace.revisions.find(r => r.id === baseRevisionId), count = revision.paragraphVersionIds.length;
  if (!count) fail('save at least one passage before reviewing.');
  const settings = { start: 1, end: count, narrativeTime: 0, viewpoint: '', maxCalls: 80, maxTokens: 24000, maxMs: 5000, maxFindings: 20, maxCost: 0, ...options };
  delete settings.baseRevisionId;
  validateSettings(settings, count); return { baseRevisionId, settings };
}
function validateSettings(s, count) {
  if (!shape(s, ['start', 'end', 'narrativeTime', 'viewpoint', 'maxCalls', 'maxTokens', 'maxMs', 'maxFindings', 'maxCost']) ||
      !Number.isSafeInteger(s.start) || !Number.isSafeInteger(s.end) || s.start < 1 || s.end < s.start || s.end > count ||
      !Number.isSafeInteger(s.narrativeTime) || s.narrativeTime < 0 || s.narrativeTime > 1_000_000 || !str(s.viewpoint, 80) ||
      !Number.isSafeInteger(s.maxCalls) || s.maxCalls < 1 || s.maxCalls > 500 || !Number.isSafeInteger(s.maxTokens) || s.maxTokens < 256 || s.maxTokens > 1_000_000 ||
      !Number.isSafeInteger(s.maxMs) || s.maxMs < 50 || s.maxMs > 15000 || !Number.isSafeInteger(s.maxFindings) || s.maxFindings < 1 || s.maxFindings > 20 || s.maxCost !== 0) fail('invalid review range or budgets.');
}
export function startReview(workspace, options = {}, now = Date.now()) {
  if (workspace.reviewRuns.some(r => r.status === 'running')) fail('cancel the running review before starting another.');
  const branch = workspace.branches.find(b => b.id === workspace.activeBranchId), { baseRevisionId, settings } = reviewSettings(workspace, options);
  const all = historicalFacts(workspace, branch, baseRevisionId), factIds = all.filter(f => eligible(workspace, f, baseRevisionId, settings)).map(f => f.id);
  const exceptionIds = workspace.reviewExceptions.filter(e => e.active && e.branchId === branch.id).map(e => e.id);
  const run = { id: uid(), projectId: workspace.id, branchId: branch.id, baseRevisionId, settings, factIds, exceptionIds, startedAt: now,
    phase: 'read_revision', status: 'running', cursor: 0, checkedPairs: 0, findings: [], trace: [], abstentions: [],
    counters: { toolCalls: 0, estimatedTokens: 0, elapsedMs: 0, actualCost: 0 }, message: `${factIds.length} approved facts selected; ${all.length - factIds.length} excluded by approval, evidence, time, or knowledge.` };
  workspace.reviewRuns.push(run); return run.id;
}
function updateTime(run, now) { run.counters.elapsedMs = Math.max(run.counters.elapsedMs, Math.max(0, now - run.startedAt)); }
function exhausted(run, reason) { run.status = 'budget_exhausted'; run.phase = 'done'; run.message = reason + ' Partial findings are preserved.'; return false; }
function charge(run, tool, refs, amount, now) {
  updateTime(run, now);
  if (run.counters.elapsedMs >= run.settings.maxMs) return exhausted(run, 'Wall-time budget reached.');
  if (run.counters.toolCalls + 1 > run.settings.maxCalls) return exhausted(run, 'Tool-call budget reached.');
  if (run.counters.estimatedTokens + amount > run.settings.maxTokens) return exhausted(run, 'Estimated input-token budget reached.');
  run.counters.toolCalls++; run.counters.estimatedTokens += amount;
  run.trace.push({ tool, refs, estimatedTokens: amount, atMs: run.counters.elapsedMs, note: 'Scoped local operation; no model call or monetary charge.' }); return true;
}
function abstain(run, reason) {
  const item = run.abstentions.find(a => a.reason === reason); if (item) item.count++; else run.abstentions.push({ reason, count: 1 });
}
const normalize = value => value.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
const caution = text => /["“”]|\b(said|asked|whispered|claimed|believed|thought|dreamed|imagined|perhaps|maybe|rumou?r|apparently|pretended|lied|flashback|yesterday|tomorrow|earlier|later|now|then|years ago)\b/i.test(text);
function sentences(text) {
  return [...text.matchAll(/[^.!?\n]+[.!?]?/g)].map(match => {
    const value = match[0].trim(), start = match.index + match[0].indexOf(value); return { text: value, start, end: start + value.length };
  }).filter(s => s.text && s.text.length <= 2000);
}
export function parseStatement(text) {
  const value = text.trim().replace(/[.!?]+$/, '');
  let match = value.match(/^([\p{Lu}][\p{L}' -]{0,60}?)\s+(cannot|can't|can not|can)\s+(hear|see|touch|enter|leave|use|open|remember)\s+(.+)$/u);
  if (match) return { subject: normalize(match[1]), relation: 'ability', object: normalize(`${match[3]} ${match[4]}`), positive: match[2] === 'can',
    start: match[1].length + 1, end: match[1].length + 1 + match[2].length, opposite: match[2] === 'can' ? 'cannot' : 'can', transition: false };
  match = value.match(/^([\p{Lu}][\p{L}' -]{0,60}?)\s+(does not have|did not have|has|had|holds|held|carries|carried|owns|owned|lost|dropped|recovered|found|regained)\s+(the\s+.+)$/u);
  if (!match) return null;
  const verb = match[2], negative = ['does not have', 'did not have', 'lost', 'dropped'].includes(verb);
  const opposites = { has: 'does not have', had: 'did not have', holds: 'does not hold', held: 'did not hold', carries: 'does not carry', carried: 'did not carry', owns: 'does not own', owned: 'did not own', 'does not have': 'has', 'did not have': 'had' };
  return { subject: normalize(match[1]), relation: 'possession', object: normalize(match[3]), positive: !negative,
    start: match[1].length + 1, end: match[1].length + 1 + verb.length, opposite: opposites[verb] || null,
    transition: ['lost', 'dropped', 'recovered', 'found', 'regained'].includes(verb) };
}
const same = (a, b) => a && b && a.subject === b.subject && a.relation === b.relation && a.object === b.object;
function supportedFact(fact) {
  const claim = parseStatement(fact.claim), evidence = parseStatement(fact.evidence.quote);
  return same(claim, evidence) && claim.positive === evidence.positive && !caution(fact.claim) && !caution(fact.evidence.quote) ? claim : null;
}
function candidate(workspace, run, fact, target) {
  const reference = supportedFact(fact);
  if (!reference) return { reason: 'Unsupported or uncertain approved proposition; local rules abstain.' };
  if (target.id === fact.evidence.paragraphVersionId) return { reason: 'Source passage is not a new conflict.' };
  const frozen = workspace.revisions.find(r => r.id === run.baseRevisionId);
  const sourceIndex = frozen.paragraphVersionIds.indexOf(fact.evidence.paragraphVersionId), targetIndex = frozen.paragraphVersionIds.indexOf(target.id);
  if (targetIndex <= sourceIndex) return { reason: 'Passage precedes supporting evidence; chronology is uncertain.' };
  if (caution(target.text)) return { reason: 'Dialogue, uncertain narration, or time/viewpoint cues may explain the change.' };
  for (const sentence of sentences(target.text)) {
    const statement = parseStatement(sentence.text);
    if (!same(reference, statement) || statement.positive === reference.positive) continue;
    if (statement.transition || !statement.opposite) return { reason: 'Explicit state-changing event may be intentional.' };
    return { sentence, statement, reference };
  }
  return { reason: 'No supported direct contradiction in this passage.' };
}
const signature = (factId, evidence, type) => `${factId}:${evidence.paragraphVersionId}:${evidence.start}:${evidence.end}:${type}`;
export function advanceReview(workspace, runId, now = Date.now()) {
  const invokedAt = Date.now(), tick = () => now + Math.max(0, Date.now() - invokedAt);
  const run = workspace.reviewRuns.find(r => r.id === runId);
  if (!run || run.projectId !== workspace.id) fail('run does not belong to this project.');
  if (run.status !== 'running') return;
  updateTime(run, now);
  if (run.counters.elapsedMs >= run.settings.maxMs) { exhausted(run, 'Wall-time budget reached.'); return; }
  const revision = workspace.revisions.find(r => r.id === run.baseRevisionId), versions = new Map(workspace.paragraphVersions.map(p => [p.id, p]));
  const selected = revision.paragraphVersionIds.slice(run.settings.start - 1, run.settings.end);
  if (run.phase === 'read_revision') {
    if (!charge(run, 'read_revision', [revision.id], selected.reduce((sum, id) => sum + bytes(versions.get(id).text), 0), tick())) return;
    run.phase = 'read_accepted_facts'; return;
  }
  if (run.phase === 'read_accepted_facts') {
    const amount = run.factIds.reduce((sum, id) => { const fact = workspace.memoryFacts.find(f => f.id === id); return sum + bytes(fact.claim) + bytes(fact.evidence.quote); }, 0);
    if (!charge(run, 'read_accepted_facts', [run.branchId], amount, tick())) return;
    run.phase = 'checking'; return;
  }
  const total = selected.length * run.factIds.length;
  for (let work = 0; work < 20 && run.cursor < total; work++) {
    updateTime(run, tick()); if (run.counters.elapsedMs >= run.settings.maxMs) { exhausted(run, 'Wall-time budget reached.'); return; }
    const cursor = run.cursor++, target = versions.get(selected[Math.floor(cursor / run.factIds.length)]), fact = workspace.memoryFacts.find(f => f.id === run.factIds[cursor % run.factIds.length]);
    run.checkedPairs++;
    const result = candidate(workspace, run, fact, target);
    if (result.reason) { abstain(run, result.reason); continue; }
    const targetEvidence = { revisionId: revision.id, paragraphVersionId: target.id, start: result.sentence.start, end: result.sentence.end, quote: result.sentence.text };
    const type = result.reference.relation === 'possession' ? 'possession' : 'direct_negation', key = signature(fact.id, targetEvidence, type);
    if (workspace.reviewExceptions.some(e => run.exceptionIds.includes(e.id) && e.signature === key)) { abstain(run, 'Writer marked this exact conflict intentional on this branch.'); continue; }
    const sourceIndex = revision.paragraphVersionIds.indexOf(fact.evidence.paragraphVersionId), targetIndex = revision.paragraphVersionIds.indexOf(target.id);
    const relevant = revision.paragraphVersionIds.slice(sourceIndex + 1, targetIndex).map(id => versions.get(id)).filter(p => normalize(p.text).includes(result.reference.subject) && normalize(p.text).includes(result.reference.object));
    const context = relevant.slice(0, 5);
    if (!charge(run, 'retrieve_passages', [fact.evidence.revisionId, fact.evidence.paragraphVersionId, target.id, ...context.map(p => p.id)], bytes(fact.evidence.quote) + bytes(target.text) + context.reduce((sum, p) => sum + bytes(p.text), 0), tick())) return;
    if (relevant.length > 5) { abstain(run, 'Relevant context exceeds the five-passage checking window.'); continue; }
    if (context.some(p => caution(p.text) || sentences(p.text).some(s => { const statement = parseStatement(s.text); return same(result.reference, statement) && statement.transition; }))) { abstain(run, 'An intervening loss/recovery event or uncertain passage may explain the change.'); continue; }
    const replacementSentence = result.sentence.text.slice(0, result.statement.start) + result.statement.opposite + result.sentence.text.slice(result.statement.end);
    const replacement = target.text.slice(0, result.sentence.start) + replacementSentence + target.text.slice(result.sentence.end);
    if (!charge(run, 'propose_patch', [target.id], bytes(replacement), tick())) return;
    run.findings.push({ id: uid(), signature: key, type, factId: fact.id, sourceEvidence: clone(fact.evidence), targetEvidence,
      explanation: type === 'possession' ? 'The passage states the opposite possession state from an approved fact, with no supported intervening change found.' : 'The passage directly reverses an approved can/cannot statement with the same subject and condition.',
      uncertainty: 'Possible conflict. Artistic intent, chronology, or context may justify the difference; review both passages.',
      patch: { baseRevisionId: revision.id, paragraphId: target.paragraphId, paragraphVersionId: target.id, expectedText: target.text, replacement },
      decision: 'pending', reason: '', appliedRevisionId: null, appliedReplacement: null });
    if (run.findings.length >= run.settings.maxFindings && run.cursor < total) { exhausted(run, 'Finding limit reached.'); return; }
    return;
  }
  if (run.cursor >= total) {
    run.phase = 'done'; run.status = run.findings.length ? 'findings_ready' : 'resolved';
    run.message = run.findings.length ? 'Review finished. No prose was changed; inspect findings before applying a patch.' : 'No supported conflict found. This is not proof that the story is consistent.';
  }
}
export function cancelReview(workspace, runId, status = 'canceled', message = 'Review canceled; no further tools or patches will run.') {
  const run = workspace.reviewRuns.find(r => r.id === runId); if (!run || run.status !== 'running') return;
  if (!['canceled', 'failed', 'interrupted'].includes(status)) fail('invalid stop status.');
  run.status = status; run.phase = 'done'; run.message = String(message).slice(0, 500);
}
export function interruptReviews(workspace) {
  for (const run of workspace.reviewRuns) if (run.status === 'running') cancelReview(workspace, run.id, 'interrupted', 'Review interrupted by reload/import. Partial findings are inspectable; start a fresh review to apply repairs.');
}
export function findingStaleReason(workspace, run, finding) {
  if (workspace.id !== run.projectId || workspace.activeBranchId !== run.branchId) return 'Switch to the reviewed branch before applying a patch.';
  const branch = workspace.branches.find(b => b.id === run.branchId);
  if (branch.headRevisionId !== run.baseRevisionId) return 'Draft changed after review. Run a fresh review; this patch cannot overwrite newer writing.';
  if (!branch.memoryFactIds.includes(finding.factId)) return 'The approved memory decision changed. Review again.';
  const fact = workspace.memoryFacts.find(f => f.id === finding.factId);
  if (!eligible(workspace, fact, run.baseRevisionId, run.settings)) return 'Supporting memory is no longer eligible. Review again.';
  const revision = workspace.revisions.find(r => r.id === branch.headRevisionId), p = workspace.paragraphVersions.find(p => p.id === finding.patch.paragraphVersionId);
  if (!p || !revision.paragraphVersionIds.includes(p.id) || p.paragraphId !== finding.patch.paragraphId || p.text !== finding.patch.expectedText) return 'Target passage changed. Review again.';
  return null;
}
export function patchForApproval(workspace, runId, findingId, replacement) {
  const run = workspace.reviewRuns.find(r => r.id === runId), finding = run?.findings.find(f => f.id === findingId);
  if (!run || !finding || !applicable.has(run.status) || finding.decision !== 'pending') fail('only a pending finding from a completed review can be applied.');
  const stale = findingStaleReason(workspace, run, finding); if (stale) fail(stale);
  if (!str(replacement, 20_000) || replacement === finding.patch.expectedText) fail('replacement must change the passage and fit its text limit.');
  return { run, finding, replacement };
}
export function decideFinding(workspace, runId, findingId, decision, reason = '') {
  const run = workspace.reviewRuns.find(r => r.id === runId), finding = run?.findings.find(f => f.id === findingId);
  if (!run || run.branchId !== workspace.activeBranchId || !finding || !applicable.has(run.status) || finding.decision !== 'pending' || !['dismissed', 'intentional'].includes(decision) || !str(reason, 500)) fail('invalid finding decision or branch scope.');
  if (decision === 'intentional' && !reason.trim()) fail('add a reason before marking a finding intentional.');
  finding.decision = decision; finding.reason = reason.trim() || 'Dismissed by writer.';
  if (decision === 'intentional') workspace.reviewExceptions.push({ id: uid(), branchId: run.branchId, signature: finding.signature, reason: finding.reason, active: true, runId: run.id, findingId: finding.id });
  if (run.status === 'findings_ready' && run.findings.every(f => f.decision !== 'pending')) run.status = 'resolved';
}
export function reviewTrace(run) {
  return clone({ id: run.id, projectId: run.projectId, branchId: run.branchId, baseRevisionId: run.baseRevisionId, settings: run.settings, exceptionIds: run.exceptionIds,
    status: run.status, counters: run.counters, trace: run.trace, abstentions: run.abstentions, message: run.message });
}
function validateEvidence(workspace, evidence) {
  if (!shape(evidence, ['revisionId', 'paragraphVersionId', 'start', 'end', 'quote'])) fail('invalid citation.');
  const revision = workspace.revisions.find(r => r.id === evidence.revisionId), passage = workspace.paragraphVersions.find(p => p.id === evidence.paragraphVersionId);
  if (!revision || !passage || !revision.paragraphVersionIds.includes(passage.id) || !Number.isSafeInteger(evidence.start) || !Number.isSafeInteger(evidence.end) || evidence.start < 0 || evidence.end <= evidence.start || evidence.end > passage.text.length || !str(evidence.quote, 2000, true) || passage.text.slice(evidence.start, evidence.end) !== evidence.quote) fail('citation does not match immutable evidence.');
}
export function validateReviews(workspace) {
  if (!Array.isArray(workspace.reviewRuns) || workspace.reviewRuns.length > 100 || !Array.isArray(workspace.reviewExceptions) || workspace.reviewExceptions.length > 200) fail('review history or exception limit reached. Export before starting another project.');
  const ids = new Set(), findingIds = new Set(), applied = new Set();
  for (const run of workspace.reviewRuns) {
    const keys = ['id', 'projectId', 'branchId', 'baseRevisionId', 'settings', 'factIds', 'exceptionIds', 'startedAt', 'phase', 'status', 'cursor', 'checkedPairs', 'findings', 'trace', 'abstentions', 'counters', 'message'];
    const branch = workspace.branches.find(b => b.id === run?.branchId), revision = workspace.revisions.find(r => r.id === run?.baseRevisionId);
    if (!shape(run, keys) || !str(run.id, 100, true) || ids.has(run.id) || run.projectId !== workspace.id || !branch || !revision || !ancestors(workspace, branch.headRevisionId).has(revision.id) ||
        !Number.isSafeInteger(run.startedAt) || run.startedAt < 0 || !['read_revision', 'read_accepted_facts', 'checking', 'done'].includes(run.phase) ||
        !(run.status === 'running' || terminal.has(run.status)) || !str(run.message, 500) || !Array.isArray(run.factIds) || run.factIds.length > 500 || new Set(run.factIds).size !== run.factIds.length) fail('invalid run record.');
    ids.add(run.id); validateSettings(run.settings, revision.paragraphVersionIds.length);
    if ((run.status === 'running') === (run.phase === 'done') || !Array.isArray(run.exceptionIds) || run.exceptionIds.length > 200 || new Set(run.exceptionIds).size !== run.exceptionIds.length ||
        !run.exceptionIds.every(id => workspace.reviewExceptions.some(e => e?.id === id && e.branchId === run.branchId))) fail('invalid frozen exception scope or run phase.');
    const allowed = decisions(workspace, branch.id), past = ancestors(workspace, revision.id);
    for (const factId of run.factIds) {
      const fact = workspace.memoryFacts.find(f => f.id === factId);
      if (!fact || !allowed.has(factId) || !past.has(fact.createdAtRevisionId) || !eligible(workspace, fact, revision.id, run.settings)) fail('review memory is outside frozen scope.');
    }
    const total = (run.settings.end - run.settings.start + 1) * run.factIds.length;
    if (!Number.isSafeInteger(run.cursor) || run.cursor < 0 || run.cursor > total || run.checkedPairs !== run.cursor ||
        !shape(run.counters, ['toolCalls', 'estimatedTokens', 'elapsedMs', 'actualCost']) || !Number.isSafeInteger(run.counters.elapsedMs) || run.counters.elapsedMs < 0 || run.counters.actualCost !== 0 ||
        !Array.isArray(run.trace) || run.trace.length > run.settings.maxCalls || run.counters.toolCalls !== run.trace.length || !Number.isSafeInteger(run.counters.estimatedTokens) || run.counters.estimatedTokens < 0 || run.counters.estimatedTokens > run.settings.maxTokens ||
        !Array.isArray(run.abstentions) || run.abstentions.length > 10 || !run.abstentions.every(a => shape(a, ['reason', 'count']) && str(a.reason, 200, true) && Number.isSafeInteger(a.count) && a.count > 0)) fail('invalid run counters.');
    let estimated = 0;
    for (const entry of run.trace) {
      if (!shape(entry, ['tool', 'refs', 'estimatedTokens', 'atMs', 'note']) || !toolNames.includes(entry.tool) || !Array.isArray(entry.refs) || entry.refs.length > 10 || !entry.refs.every(v => str(v, 100, true)) || !Number.isSafeInteger(entry.estimatedTokens) || entry.estimatedTokens < 0 || !Number.isSafeInteger(entry.atMs) || entry.atMs < 0 || entry.atMs >= run.settings.maxMs || entry.atMs > run.counters.elapsedMs || !str(entry.note, 200)) fail('invalid tool trace.');
      estimated += entry.estimatedTokens;
    }
    if (estimated !== run.counters.estimatedTokens || !Array.isArray(run.findings) || run.findings.length > run.settings.maxFindings) fail('invalid review findings or usage.');
    const signatures = new Set();
    for (const f of run.findings) {
      if (!shape(f, ['id', 'signature', 'type', 'factId', 'sourceEvidence', 'targetEvidence', 'explanation', 'uncertainty', 'patch', 'decision', 'reason', 'appliedRevisionId', 'appliedReplacement']) || !str(f.id, 100, true) || findingIds.has(f.id) || !['possession', 'direct_negation'].includes(f.type) || !run.factIds.includes(f.factId) ||
          !str(f.explanation, 1000, true) || !str(f.uncertainty, 500, true) || !['pending', 'applied', 'dismissed', 'intentional'].includes(f.decision) || !str(f.reason, 500)) fail('invalid finding record.');
      findingIds.add(f.id); validateEvidence(workspace, f.sourceEvidence); validateEvidence(workspace, f.targetEvidence);
      const fact = workspace.memoryFacts.find(fact => fact.id === f.factId), target = workspace.paragraphVersions.find(p => p.id === f.targetEvidence.paragraphVersionId);
      if (JSON.stringify(f.sourceEvidence) !== JSON.stringify(fact.evidence) || f.targetEvidence.revisionId !== run.baseRevisionId || !revision.paragraphVersionIds.slice(run.settings.start - 1, run.settings.end).includes(target.id) || f.signature !== signature(f.factId, f.targetEvidence, f.type) || signatures.has(f.signature)) fail('finding evidence is outside review scope.');
      signatures.add(f.signature);
      if (!shape(f.patch, ['baseRevisionId', 'paragraphId', 'paragraphVersionId', 'expectedText', 'replacement']) || f.patch.baseRevisionId !== run.baseRevisionId || f.patch.paragraphId !== target.paragraphId || f.patch.paragraphVersionId !== target.id || f.patch.expectedText !== target.text || !str(f.patch.replacement, 20_000) || f.patch.replacement === target.text) fail('invalid patch preconditions.');
      if (f.decision === 'applied') {
        const appliedRevision = workspace.revisions.find(r => r.id === f.appliedRevisionId);
        const newVersion = appliedRevision && workspace.paragraphVersions.find(p => appliedRevision.paragraphVersionIds.includes(p.id) && p.paragraphId === target.paragraphId);
        if (!appliedRevision || appliedRevision.branchId !== run.branchId || appliedRevision.parentId !== run.baseRevisionId || appliedRevision.source !== 'review' || applied.has(appliedRevision.id) || !str(f.appliedReplacement, 20_000) || f.appliedReplacement === target.text || newVersion?.text !== f.appliedReplacement ||
            appliedRevision.title !== revision.title || appliedRevision.paragraphVersionIds.length !== revision.paragraphVersionIds.length ||
            revision.paragraphVersionIds.some((id, index) => id !== target.id && appliedRevision.paragraphVersionIds[index] !== id)) fail('invalid applied-patch audit.');
        applied.add(appliedRevision.id);
      } else if (f.appliedRevisionId !== null || f.appliedReplacement !== null) fail('unexpected applied patch data.');
    }
  }
  for (const revision of workspace.revisions) if (revision.source === 'review' && !applied.has(revision.id)) fail('review revision has no writer approval record.');
  if (workspace.reviewRuns.filter(r => r.status === 'running').length > 1) fail('only one review may run at a time.');
  const exceptionIds = new Set();
  for (const exception of workspace.reviewExceptions) {
    const run = workspace.reviewRuns.find(r => r.id === exception?.runId), finding = run?.findings.find(f => f.id === exception?.findingId);
    if (!shape(exception, ['id', 'branchId', 'signature', 'reason', 'active', 'runId', 'findingId']) || !str(exception.id, 100, true) || exceptionIds.has(exception.id) || !run || !finding || finding.decision !== 'intentional' || exception.branchId !== run.branchId || exception.signature !== finding.signature || exception.reason !== finding.reason || typeof exception.active !== 'boolean' || !str(exception.reason, 500, true)) fail('invalid intentional exception.');
    exceptionIds.add(exception.id);
  }
}

export class ReviewController {
  constructor(editor, { onChange = () => {}, persist = async () => {}, onError = () => {} } = {}) { this.editor = editor; this.onChange = onChange; this.persist = persist; this.onError = onError; this.active = false; this.runId = null; }
  async start(options = {}) {
    if (this.active) fail('a review is already running.');
    const projectId = this.editor.project.id;
    this.runId = this.editor.startReview(options); this.active = true;
    try {
      this.onChange(); await this.persist();
      while (this.editor.project.id === projectId && this.editor.workspace.reviewRuns.find(r => r.id === this.runId)?.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, 15));
        if (this.editor.project.id !== projectId || this.editor.workspace.reviewRuns.find(r => r.id === this.runId)?.status !== 'running') break;
        this.editor.advanceReview(this.runId); this.onChange(); await this.persist();
      }
    } catch (error) {
      if (this.editor.project.id === projectId) this.editor.stopReview(this.runId, 'failed', error.message || 'Review failed.');
      this.onError(error);
    } finally { this.active = false; this.onChange(); await this.persist(); }
    return this.runId;
  }
  cancel() { if (this.active) { this.editor.stopReview(this.runId); this.onChange(); } }
}
