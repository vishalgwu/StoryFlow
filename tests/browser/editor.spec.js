import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { revisionContent } from '../../src/history.js';

const ready = async page => {
  await page.goto('/');
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
};
const editFirst = async (page, text) => {
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).fill(text);
};
const saveEdit = async page => {
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
};
const readRecord = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('storyflow', 1);
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction('projects');
    const get = tx.objectStore('projects').get('active');
    get.onsuccess = () => { resolve(get.result); db.close(); };
    get.onerror = () => reject(get.error);
  };
}));

test('save/cancel, stable paragraph IDs, undo/redo and reload recovery', async ({ page }) => {
  await ready(page);
  const original = await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).inputValue();
  const paragraphId = await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).getAttribute('id');
  await editFirst(page, 'Draft to cancel');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(original);
  await editFirst(page, 'A saved paragraph.'); await saveEdit(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveAttribute('id', paragraphId);
  await page.reload(); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(original);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('A saved paragraph.');
  await editFirst(page, 'Unapplied recovery text');
  await expect(page.locator('#save-status')).toContainText('Recovery checkpoint saved');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Unapplied recovery text');
  await expect(page.locator('#edit-status')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('A saved paragraph.');
});

test('stream completion, cancellation, stale output and reload recovery', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.locator('#preview')).toContainText('Mara held');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('#run-status')).toContainText('Stopped');
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  const stopped = await page.locator('#preview').textContent();
  await page.reload();
  await expect(page.locator('#preview')).toHaveText(stopped);
  await expect(page.locator('#keep')).toBeEnabled();
  await page.locator('#keep').click();
  await expect(page.locator('#paragraphs textarea')).toHaveCount(2);
  await expect(page.locator('#keep')).toBeDisabled();
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await editFirst(page, 'My manual edit must survive.');
  await saveEdit(page);
  await expect(page.locator('#run-status')).toContainText('Draft changed');
  await expect(page.locator('#paragraphs textarea')).toHaveCount(2);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('My manual edit must survive.');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.locator('#run-status')).toContainText('Sample added');
  await expect(page.locator('#paragraphs textarea')).toHaveCount(3);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#paragraphs textarea')).toHaveCount(2);
});

test('reload during stream restores checkpoint as proposal, never commits automatically', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect.poll(async () => (await readRecord(page)).proposal?.text.length || 0).toBeGreaterThan(10);
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('#run-status')).toContainText('Recovered sample');
  await expect(page.locator('#preview')).not.toBeEmpty();
  await expect(page.locator('#paragraphs textarea')).toHaveCount(1);
  await expect(page.locator('#keep')).toBeEnabled();
});

test('validated import/export, rejection and undoable replacement', async ({ page }) => {
  await ready(page);
  await editFirst(page, '<script>window.bad=true</script> Literal story text'); await saveEdit(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  const head = exported.branches.find(b => b.id === exported.activeBranchId).headRevisionId;
  const exportedText = revisionContent(exported, head).paragraphs[0].text;
  expect(exportedText).toContain('<script>');
  await page.locator('#file').setInputFiles('tests/fixtures/invalid-project.json');
  await expect(page.getByRole('alert')).toContainText('Invalid project');
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(exportedText);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#file').setInputFiles('tests/fixtures/valid-project.json');
  await expect(page.getByRole('textbox', { name: 'Story title', exact: true })).toHaveValue('The paper boat');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(exportedText);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#file').setInputFiles({ name: 'roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(exportedText);
  expect(await page.evaluate(() => window.bad)).toBeUndefined();
});

test('quota failures and aborted saves retain work and can be retried', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (window.storageFault === 'quota') throw new DOMException('Injected quota failure', 'QuotaExceededError');
      const result = put.apply(this, args);
      if (window.storageFault === 'abort') this.transaction.abort();
      return result;
    };
  });
  await ready(page);
  for (const failure of ['quota', 'abort']) {
    await page.evaluate(mode => { window.storageFault = mode; }, failure);
    await editFirst(page, `Survive ${failure}`);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('#save-status')).toContainText('Save failed');
    await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(`Survive ${failure}`);
    await expect(page.locator('#retry')).toBeVisible();
    await page.evaluate(() => { window.storageFault = null; });
    await page.locator('#retry').click();
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    await page.reload(); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(`Survive ${failure}`);
  }
});

test('unreadable stored data is preserved and never replaced by startup autosave', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('storyflow', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put({ schemaVersion: 999, marker: 'preserve me' }, 'active');
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Saving is disabled');
  await page.getByRole('textbox', { name: 'Story title', exact: true }).fill('New temporary draft');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('#save-status')).toContainText('Save failed');
  expect((await readRecord(page)).marker).toBe('preserve me');
});

test('second tab cannot overwrite active draft and gains access after owner closes', async ({ page, context }) => {
  await ready(page);
  const other = await context.newPage(); await other.goto('/');
  await expect(other.locator('#save-status')).toContainText('Read-only');
  await expect(other.locator('#title')).toBeDisabled();
  await expect(other.getByRole('button', { name: 'Edit passage 1', exact: true })).toBeDisabled();
  await page.close(); await other.reload();
  await expect(other.locator('#save-status')).toHaveText('Saved in this browser');
  await expect(other.locator('#title')).toBeEnabled();
});

test('keyboard editing actions and narrow layout remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await editFirst(page, 'Keyboard save');
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).press('Control+Enter');
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await editFirst(page, 'Discard this edit');
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).press('Escape');
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Keyboard save');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('stream failure keeps partial output, remains visible after save, and permits writing', async ({ page }) => {
  await page.route('**/src/generation.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace("yield word + ' ';", "yield word + ' '; if (word === 'breath.') throw new Error('Injected stream disconnect');");
    await route.fulfill({ response, body });
  });
  await ready(page);
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.locator('#run-status')).toContainText('Sample failed');
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await expect(page.getByRole('alert')).toContainText('Injected stream disconnect');
  await expect(page.locator('#keep')).toBeEnabled();
  await expect(page.locator('#paragraphs textarea')).toHaveCount(1);
  await editFirst(page, 'Still able to write.'); await saveEdit(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Still able to write.');
});

test('read transaction failure disables saving and leaves stored project intact', async ({ page }) => {
  await ready(page); const before = await readRecord(page);
  await page.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
      const request = get.apply(this, args);
      if (this.name === 'projects') this.transaction.abort();
      return request;
    };
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Saving is disabled');
  await expect(page.locator('#save-status')).toContainText('Storage unavailable');
  // Remove the injected module by using a fresh page in the same browser context.
  await page.close();
  const recovered = await page.context().newPage(); await ready(recovered);
  expect((await readRecord(recovered)).workspace).toEqual(before.workspace);
});
