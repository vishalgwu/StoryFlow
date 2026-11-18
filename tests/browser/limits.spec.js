import { test, expect } from '@playwright/test';
import { createWorkspace } from '../../src/history.js';
import { readFile } from 'node:fs/promises';

test('full history refuses an edit but still exports committed history and pending words', async ({ page }) => {
  const workspace = createWorkspace(), initial = workspace.revisions[0];
  workspace.revisions = Array.from({ length: 5000 }, (_, i) => ({ ...initial, id: `r-${i}`, parentId: i ? `r-${i - 1}` : null, source: i ? 'manual' : initial.source }));
  workspace.branches[0].headRevisionId = 'r-4999';
  await page.goto('/'); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#file').setInputFiles({ name: 'full-history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workspace)) });
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).fill('Keep these pending words.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('record count');
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Keep these pending words.');
  const projectPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const project = await projectPromise;
  expect(JSON.parse(await readFile(await project.path(), 'utf8')).revisions.length).toBe(5000);
  await expect(page.getByRole('alert')).toContainText('without the unapplied edit');
  const editPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export edit text', exact: true }).click();
  const edit = await editPromise;
  expect(await readFile(await edit.path(), 'utf8')).toBe('Keep these pending words.');
});
