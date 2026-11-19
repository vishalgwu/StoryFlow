import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const ready = async page => { await page.goto('/'); await expect(page.locator('#save-status')).toHaveText('Saved in this browser'); };
const saved = page => expect(page.locator('#save-status')).toHaveText('Saved in this browser');
const edit = async (page, text) => {
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
};
const fork = async (page, name) => {
  await page.getByLabel('Branch name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Fork current draft', exact: true }).click(); await saved(page);
};
const exported = async page => {
  const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const download = await promise; return JSON.parse(await readFile(await download.path(), 'utf8'));
};

test('fork, edit, compare, restore and reload preserve independent branches and immutable history', async ({ page }) => {
  await ready(page);
  const initial = await page.locator('#revision-select').inputValue();
  const original = await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).inputValue();
  await fork(page, 'Underwater path'); await edit(page, 'Mara followed the light below the waves.');
  const alternativeHead = await page.locator('#revision-select').inputValue();
  await page.locator('#branch-select').selectOption({ label: 'Main' });
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(original);
  await page.locator('#compare-left').selectOption(initial); await page.locator('#compare-right').selectOption(alternativeHead);
  await page.getByRole('button', { name: 'Compare revisions', exact: true }).click();
  await expect(page.locator('#comparison-result del')).toContainText(original);
  await expect(page.locator('#comparison-result ins')).toContainText('Mara followed the light below the waves.');
  await page.locator('#branch-select').selectOption({ label: 'Underwater path' });
  await page.locator('#revision-select').selectOption(initial);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Restore selected revision', exact: true }).click(); await saved(page);
  const restoredHead = await page.locator('#revision-select').inputValue(); expect(restoredHead).not.toBe(initial);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(original);
  await page.locator('#revision-select').selectOption(alternativeHead);
  await expect(page.locator('#revision-preview')).toContainText('Mara followed the light below the waves.');
  await page.reload(); await saved(page);
  await expect(page.locator('#branch-select')).toHaveValue((await exported(page)).activeBranchId);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Mara followed the light below the waves.');
  await page.locator('#branch-select').selectOption({ label: 'Main' });
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue(original);
});

test('fork earlier revision, rename, archive/reopen and export/import preserve tree links', async ({ page }) => {
  await ready(page); const initial = await page.locator('#revision-select').inputValue();
  await edit(page, 'Only in the future of Main.');
  await page.locator('#revision-select').selectOption(initial);
  await page.getByLabel('Branch name', { exact: true }).fill('Earlier path');
  await page.getByRole('button', { name: 'Fork selected revision', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).not.toHaveValue('Only in the future of Main.');
  await page.getByLabel('Branch name', { exact: true }).fill('Dawn path');
  await page.getByRole('button', { name: 'Rename active branch', exact: true }).click();
  await page.locator('#branch-select').selectOption({ label: 'Main' });
  await page.getByRole('button', { name: 'Archive Dawn path', exact: true }).click(); await saved(page);
  const workspace = await exported(page);
  expect(workspace.branches.find(b => b.name === 'Dawn path').archived).toBe(true);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#file').setInputFiles({ name: 'branches.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workspace)) });
  await saved(page); expect(await exported(page)).toEqual(workspace);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'New project', exact: true }).click(); await saved(page);
  expect((await exported(page)).branches.length).toBe(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved(page);
  expect(await exported(page)).toEqual(workspace);
  await page.getByRole('button', { name: 'Reopen Dawn path', exact: true }).click();
  await page.getByRole('button', { name: 'Open Dawn path', exact: true }).click(); await saved(page);
  await expect(page.locator('#branch-tree')).toContainText('Dawn path · active');
});

test('late completion after switch-away-and-back cannot overwrite either branch', async ({ page }) => {
  await ready(page); await fork(page, 'Second path');
  await page.locator('#branch-select').selectOption({ label: 'Main' }); await saved(page);
  const before = await exported(page);
  await page.getByRole('button', { name: 'Try sample continuation', exact: true }).click();
  await expect(page.locator('#preview')).toContainText('Mara held');
  await page.locator('#branch-select').selectOption({ label: 'Second path' });
  await expect(page.locator('#keep')).toBeDisabled();
  await expect(page.locator('#proposal-origin')).toContainText('From Main');
  await page.locator('#branch-select').selectOption({ label: 'Main' });
  await expect(page.locator('#run-status')).toContainText('Draft changed'); await saved(page);
  const after = await exported(page);
  expect(after.revisions).toEqual(before.revisions);
  expect(after.branches.map(b => b.headRevisionId)).toEqual(before.branches.map(b => b.headRevisionId));
  await expect(page.locator('#paragraphs textarea')).toHaveCount(1);
});

test('migrates Phase 1 recovery with unapplied text and stopped sample', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => new Promise(resolve => {
    const project = { schemaVersion: 1, id: 'old-project', branchId: 'old-branch', title: 'Legacy draft', revision: 1, paragraphs: [{ id: 'old-passage', text: 'Saved Phase 1 prose.' }] };
    const record = { formatVersion: 1, project, undo: [{ ...project, revision: 0, title: 'Earlier title' }], redo: [],
      working: { paragraphId: 'old-passage', text: 'Unapplied Phase 1 words.' },
      proposal: { id: 'old-run', projectId: 'old-project', branchId: 'old-branch', text: 'Partial old sample.', status: 'running' } };
    const request = indexedDB.open('storyflow', 1);
    request.onsuccess = () => { const db = request.result, tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(record, 'active'); tx.oncomplete = () => { db.close(); resolve(); }; };
  }));
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Unapplied Phase 1 words.');
  await expect(page.locator('#preview')).toHaveText('Partial old sample.');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Saved Phase 1 prose.');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved(page);
  await expect(page.locator('#title')).toHaveValue('Earlier title');
  const workspace = await exported(page); expect(workspace.schemaVersion).toBe(4); expect(workspace.id).toBe('old-project');
});

test('malformed graph import preserves the active tree and branch actions block unapplied edits', async ({ page }) => {
  await ready(page); await fork(page, 'Alternative'); const workspace = await exported(page);
  const broken = structuredClone(workspace); broken.branches[1].headRevisionId = 'missing';
  await page.locator('#file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) });
  await expect(page.getByRole('alert')).toContainText('Invalid project history');
  expect(await exported(page)).toEqual(workspace);
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await expect(page.locator('#branch-select')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Fork current draft', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).press('Escape');
  await expect(page.locator('#branch-select')).toBeEnabled();
});
