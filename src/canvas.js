import { storyWords } from './cursor.js';
const $ = id => document.getElementById(id);
export function createCanvas({ getEditor, canWrite, onMutation, onBeginWriting, onError }) {
  let scope = '', index = 0, words = [], spans = [], dragging = null, moved = false, animation = 0, paintedIndex = -1;
  const cursor = $('story-cursor');
  const position = () => { const p = getEditor().project; return { projectId: p.id, branchId: p.branchId, baseRevisionId: p.revision, wordIndex: index }; };
  function paint(reposition = true) {
    if (paintedIndex !== index) {
      spans.forEach((span, i) => { span.classList.toggle('future-word', i >= index); span.classList.toggle('cursor-word', i === index - 1); span.classList.toggle('cursor-start-word', index === 0 && i === 0); });
      paintedIndex = index;
    }
    if (reposition) {
      const host = $('paragraphs').getBoundingClientRect(), target = spans[Math.max(0, index - 1)];
      const rects = target ? [...target.getClientRects()] : [], rect = rects.at(index ? -1 : 0);
      const top = rect ? rect.top - host.top - 8 : 0;
      const left = rect ? (index ? rect.right - host.left - (dragging && moved ? 0 : 44) : rect.left - host.left) : -44;
      cursor.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    }
    cursor.hidden = !!document.querySelector('#paragraphs textarea:not([readonly])');
    const atEnd = index === words.length;
    cursor.setAttribute('aria-label', `Story cursor: after word ${index} of ${words.length}${atEnd ? ', at the end' : ''}`);
    $('cursor-position').textContent = atEnd ? 'At the end · keep writing' : index ? `After “${words[index - 1].text}” · word ${index} / ${words.length}` : 'At the beginning';
    $('cursor-end').hidden = atEnd;
    $('cursor-hint').textContent = atEnd ? 'Drag ⊕ to a word · arrow keys move it · click to write' : 'Writing here creates a new branch. Your original ending stays saved.';
    $('cursor-write').disabled = !canWrite(); cursor.disabled = !canWrite();
    $('cursor-submit').disabled = !canWrite();
  }
  function choose(value, reveal = false) {
    index = Math.max(0, Math.min(words.length, value)); paint();
    if (reveal) (spans[Math.max(0, index - 1)] || cursor).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
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
  cursor.ondblclick = () => { $('cursor-composer').hidden = true; choose(words.length, true); };
  cursor.onkeydown = event => {
    const commands = { ArrowLeft: index - 1, ArrowUp: index - 1, ArrowRight: index + 1, ArrowDown: index + 1, Home: 0, End: words.length };
    if (event.key in commands) { event.preventDefault(); choose(commands[event.key], true); }
    if (event.key === 'Escape') { event.preventDefault(); close(); choose(words.length); }
  };
  $('cursor-end').onclick = () => { choose(words.length, true); cursor.focus({ preventScroll: true }); };
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
    // A native caret hit avoids scanning a whole chapter on every drag frame.
    const caret = document.caretPositionFromPoint?.(x, y);
    const fallback = !caret && document.caretRangeFromPoint?.(x, y);
    const node = caret?.offsetNode || fallback?.startContainer;
    const word = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest('.story-word');
    if (word) {
      const range = document.createRange(); range.selectNodeContents(word);
      const rect = [...range.getClientRects()].find(r => y >= r.top && y <= r.bottom);
      if (rect && x >= rect.left && x <= rect.right) return Number(word.dataset.word) + (x < rect.left + rect.width / 2 ? 0 : 1);
    }
    let best = index, distance = Infinity;
    for (const span of spans) {
      const bounds = span.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) continue;
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
    if (moved && !canceled) index = nearest(dragging.x, dragging.y);
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
    let previousTime = 0;
    const tick = time => {
      if (!dragging) return;
      if (moved) {
        const elapsed = previousTime ? Math.min(32, time - previousTime) : 16;
        const bottom = innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-clearance')) || 140);
        const speed = dragging.y < 90 ? -Math.min(1, (90 - dragging.y) / 90) : dragging.y > bottom ? Math.min(1, (dragging.y - bottom) / 90) : 0;
        if (speed) window.scrollBy({ top: speed * 600 * elapsed / 1000, behavior: 'instant' });
        choose(nearest(dragging.x, dragging.y));
      }
      previousTime = time;
      animation = requestAnimationFrame(tick);
    }; animation = requestAnimationFrame(tick);
  };
  cursor.onpointermove = event => {
    if (!dragging) return;
    dragging.x = event.clientX; dragging.y = event.clientY;
    if (Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) > 5) { moved = true; cursor.classList.add('dragging'); }
  };
  cursor.onpointerup = event => endDrag(event);
  cursor.onpointercancel = event => endDrag(event, true);
  cursor.onlostpointercapture = event => endDrag(event, true);
  addEventListener('resize', () => paint());
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
    spans = [...document.querySelectorAll('.story-word')]; paintedIndex = -1; paint();
  }
  return { render, updateControls: () => paint(false), prepare, atEnd: () => index === words.length };
}
