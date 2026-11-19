// Cursor offsets use the same UTF-16 character positions as textarea selections.
export function storyWords(project) {
  return project.paragraphs.flatMap(paragraph => [...paragraph.text.matchAll(/\S+/gu)].map(match => ({
    paragraphId: paragraph.id, start: match.index, end: match.index + match[0].length, text: match[0]
  })));
}
export function cursorPrefix(project, position) {
  if (!position || position.projectId !== project.id || position.branchId !== project.branchId || position.baseRevisionId !== project.revision) throw new Error('The story changed. Choose the writing cursor again.');
  const words = storyWords(project);
  if (!Number.isSafeInteger(position.wordIndex) || position.wordIndex < 0 || position.wordIndex > words.length) throw new Error('Choose a valid word boundary.');
  if (position.wordIndex === words.length) return { paragraphs: structuredClone(project.paragraphs), atEnd: true };
  if (position.wordIndex === 0) return { paragraphs: [], atEnd: false };
  const word = words[position.wordIndex - 1], index = project.paragraphs.findIndex(p => p.id === word.paragraphId);
  return { paragraphs: project.paragraphs.slice(0, index + 1).map((p, i) => ({ ...p, text: i === index ? p.text.slice(0, word.end) : p.text })), atEnd: false };
}
