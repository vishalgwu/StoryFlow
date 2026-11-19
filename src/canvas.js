import { storyWords } from './cursor.js';
const $ = id => document.getElementById(id);
export function createCanvas({ getEditor, canWrite, onMutation, onBeginWriting, onError }) {
  let scope = '', index = 0, words = [], dragging = null, moved = false, animation = 0;
  const cursor = $('story-cursor');
  const position = () => { const p = getEditor().project; return { projectId: p.id, branchId: p.branchId, baseRevisionId: p.revision, wordIndex: index }; };
  function paint() {
    const spans = [...document.querySelectorAll('.story-word')];
    spans.forEach((span, i) => { span.classList.toggle('future-word', i >= index); span.classList.toggle('cursor-word', i === index - 1); span.classList.toggle('cursor-start-word', index === 0 && i === 0); });
    const host = $('paragraphs').getBoundingClientRect(), target = spans[Math.max(0, index - 1)];
    const rects = target ? [...target.getClientRects()] : [], rect = rects.at(index ? -1 : 0);
    // The selected span reserves an inline slot, so the circle follows the word without covering prose.
    cursor.style.top = `${rect ? rect.top - host.top - 8 : 0}px`;
    cursor.style.left = `${rect ? (index ? rect.right - host.left - (dragging && moved ? 0 : 44) : rect.left - host.left) : -44}px`;
    cursor.hidden = !!document.querySelector('#paragraphs textarea:not([readonly])');
    const atEnd = index === words.length;
    cursor.setAttribute('aria-label', `Story cursor: after word ${index} of ${words.length}${atEnd ? ', at the end' : ''}`);
    $('cursor-position').textContent = atEnd ? 'At the end · keep writing' : index ? `After “${words[index - 1].text}” · word ${index} / ${words.length}` : 'At the beginning';
    $('cursor-end').hidden = atEnd;
    $('cursor-hint').textContent = atEnd ? 'Drag ⊕ to a word · arrow keys move it · click to write' : 'Writing here creates a new branch. Your original ending stays saved.';
    $('cursor-write').disabled = !canWrite(); cursor.disabled = !canWrite();
    $('cursor-submit').disabled = !canWrite();
  }
  function choose(value) { index = Math.max(0, Math.min(words.length, value)); paint(); }
  function close() { $('cursor-composer').hidden = true; cursor.focus({ preventScroll: true }); }
  function open() {
    if (!canWrite()) return;
    $('cursor-composer').hidden = false;
    $('cursor-submit').focus();
  }
  function prepare(writing = null) {
    if (!canWrite()) throw new Error('Save or cancel the active passage edit before using the story cursor.');
    const branched = getEditor().continueAt(position(), writing);
    $('cursor-composer').hidden = true;
    onMutation();
    $('cursor-feedback').textContent = branched ? 'New path created. The original ending is preserved in Branches.' : 'Your next passage is saved.';
    return branched;
  }
  cursor.onclick = () => { if (!moved) open(); };
  cursor.ondblclick = () => { $('cursor-composer').hidden = true; choose(words.length); };
  cursor.onkeydown = event => {
    const commands = { ArrowLeft: index - 1, ArrowUp: index - 1, ArrowRight: index + 1, ArrowDown: index + 1, Home: 0, End: words.length };
    if (event.key in commands) { event.preventDefault(); choose(commands[event.key]); }
    if (event.key === 'Escape') { event.preventDefault(); close(); choose(words.length); }
  };
  $('cursor-end').onclick = () => { choose(words.length); cursor.focus(); };
  const startWriting = () => {
    if (!canWrite()) return;
    try { const branched = getEditor().continueAt(position(), ''); $('cursor-composer').hidden = true; onBeginWriting();
      $('cursor-feedback').textContent = branched ? 'New path created. The original ending is preserved in Branches.' : 'Write your next passage, then Save changes.';
    } catch (error) { onError(error); }
  };
  $('cursor-write').onclick = startWriting;
  $('cursor-close').onclick = close;
  $('cursor-submit').onclick = startWriting;
  $('cursor-composer').onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
  $('paragraphs').addEventListener('click', event => {
    const word = event.target.closest('.story-word');
    if (!word || !canWrite() || window.getSelection()?.toString()) return;
    choose(Number(word.dataset.word) + 1);
  });
  function nearest(x, y) {
    let best = index, distance = Infinity;
    for (const span of document.querySelectorAll('.story-word')) {
      const range = document.createRange(); range.selectNodeContents(span);
      for (const rect of range.getClientRects()) {
        const delta = Math.max(rect.left - x, 0, x - rect.right) ** 2 + (rect.top + rect.height / 2 - y) ** 2 * 4;
        if (delta < distance) { distance = delta; best = Number(span.dataset.word) + (x < rect.left + rect.width / 2 ? 0 : 1); }
      }
    }
    return best;
  }
  function endDrag(event, canceled = false) {
    if (!dragging || event.pointerId !== dragging.id) return;
    const original = dragging.original; dragging = null; cancelAnimationFrame(animation);
    cursor.classList.remove('dragging'); if (canceled) choose(original); else paint();
    if (cursor.hasPointerCapture(event.pointerId)) cursor.releasePointerCapture(event.pointerId);
    // Suppress the click synthesized after a drag, but allow the next real click.
    setTimeout(() => { moved = false; }, 0);
  }
  cursor.onpointerdown = event => {
    if (event.button !== 0 || !canWrite()) return;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, original: index };
    moved = false; cursor.setPointerCapture(event.pointerId);
    const tick = () => {
      if (!dragging) return;
      if (moved) {
        if (dragging.y < 90) window.scrollBy(0, -12);
        if (dragging.y > innerHeight - 100) window.scrollBy(0, 12);
        choose(nearest(dragging.x, dragging.y));
      }
      animation = requestAnimationFrame(tick);
    }; animation = requestAnimationFrame(tick);
  };
  cursor.onpointermove = event => {
    if (!dragging) return;
    dragging.x = event.clientX; dragging.y = event.clientY;
    if (Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) > 5) { moved = true; cursor.classList.add('dragging'); choose(nearest(event.clientX, event.clientY)); }
  };
  cursor.onpointerup = event => endDrag(event);
  cursor.onpointercancel = event => endDrag(event, true);
  cursor.onlostpointercapture = event => endDrag(event, true);
  addEventListener('resize', paint);
  function render() {
    const project = getEditor().project, nextScope = `${project.id}:${project.branchId}:${project.revision}`;
    words = storyWords(project);
    if (scope !== nextScope) { scope = nextScope; index = words.length; $('cursor-composer').hidden = true; }
    let count = 0;
    for (const prose of document.querySelectorAll('.canvas-prose')) {
      prose.replaceChildren();
      const paragraph = project.paragraphs.find(p => p.id === prose.dataset.paragraphId);
      for (const part of paragraph.text.split(/(\s+)/u)) {
        if (!part || /^\s+$/u.test(part)) { prose.append(document.createTextNode(part)); continue; }
        const span = document.createElement('span'); span.className = 'story-word'; span.dataset.word = count++; span.textContent = part; prose.append(span);
      }
    }
    paint();
  }
  return { render, updateControls: paint, prepare, atEnd: () => index === words.length };
}
