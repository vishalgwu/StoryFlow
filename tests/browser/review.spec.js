import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const saved = page => expect(page.locator('#save-status')).toHaveText('Saved in this browser');
const finding = page => page.locator('.review-finding').first();
async function setup(page, target = 'Elara carries the key.') {
  await page.goto('/'); await saved(page);
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).fill('Elara lost the key.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: 'Propose selected evidence', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: 'Approve memory', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: '+ Add paragraph', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 2', exact: true }).fill(target);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
}
async function review(page, status = 'findings_ready') {
  await page.getByRole('button', { name: 'Start continuity review', exact: true }).click();
  await expect(page.locator('#review-status')).toContainText(status); await expect(page.locator('#review-cancel')).toBeDisabled(); await saved(page);
}
async function exported(page) {
  const promise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const file = await promise; return JSON.parse(await readFile(await file.path(), 'utf8'));
}
async function slowReviewer(page) {
  await page.route('**/src/review.js', async route => {
    const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('setTimeout(resolve, 15)', 'setTimeout(resolve, 250)') });
  });
}

test('review cites both passages, waits for approval, applies edited patch, and supports undo', async ({ page }) => {
  await setup(page); await review(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara carries the key.');
  await finding(page).getByRole('button', { name: 'Inspect both passages', exact: true }).click();
  await expect(page.locator('#review-evidence mark')).toHaveText(['Elara lost the key.', 'Elara carries the key.']);
  await finding(page).getByLabel('Proposed replacement', { exact: true }).fill('Elara searched for the missing key.');
  await finding(page).getByRole('button', { name: 'Apply patch', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara searched for the missing key.');
  const workspace = await exported(page); expect(workspace.reviewRuns[0].findings[0].decision).toBe('applied');
  expect(workspace.reviewRuns[0].findings[0].appliedReplacement).toBe('Elara searched for the missing key.');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara carries the key.');
});

test('new prose makes an old patch stale and cannot be overwritten', async ({ page }) => {
  await setup(page); await review(page);
  await page.getByRole('button', { name: 'Edit passage 2', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 2', exact: true }).fill('New writing must stay.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
  await expect(finding(page)).toContainText('STALE');
  await expect(finding(page).getByRole('button', { name: 'Apply patch', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('New writing must stay.');
});

test('intentional exceptions suppress exact repeats and can be reconsidered', async ({ page }) => {
  await setup(page); await review(page);
  await finding(page).getByLabel('Decision reason', { exact: true }).fill('An intentional reveal; Elara recovered it off-page.');
  await finding(page).getByRole('button', { name: 'Mark intentional', exact: true }).click(); await saved(page);
  await review(page, 'resolved'); await expect(page.locator('.review-finding')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reconsider exception', exact: true }).click();
  await review(page); await expect(page.locator('.review-finding')).toHaveCount(1);
});

test('tool budgets preserve partial findings and trace exports omit prose and patches', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: '+ Add paragraph', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 3', exact: true }).fill('Elara has the key.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
  await page.getByLabel('Maximum tool calls', { exact: true }).fill('5'); await review(page, 'budget_exhausted');
  await expect(page.locator('.review-finding')).toHaveCount(1);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export review trace', exact: true }).click();
  const file = await pending, raw = await readFile(await file.path(), 'utf8'), trace = JSON.parse(raw);
  expect(trace.counters.toolCalls).toBeLessThanOrEqual(5); expect(trace.counters.actualCost).toBe(0);
  expect(raw).not.toContain('Elara lost the key.'); expect(raw).not.toContain('replacement');
  await finding(page).getByRole('button', { name: 'Apply patch', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara does not carry the key.');
});

test('cancel remains available while editing and reload interrupts rather than resumes a run', async ({ page }) => {
  await slowReviewer(page); await setup(page);
  await page.getByRole('button', { name: 'Start continuity review', exact: true }).click();
  await page.getByRole('button', { name: 'Edit passage 2', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 2', exact: true }).fill('A recoverable working edit.');
  await expect(page.locator('#review-cancel')).toBeEnabled(); await page.locator('#review-cancel').click();
  await expect(page.locator('#review-status')).toContainText('canceled');
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('A recoverable working edit.');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: 'Start continuity review', exact: true }).click(); await saved(page);
  page.on('dialog', dialog => dialog.accept()); await page.reload();
  await expect(page.locator('#review-status')).toContainText('interrupted');
  await expect(page.locator('#review-cancel')).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara carries the key.');
});

test('reviewer failure is visible and does not block ordinary writing or saving', async ({ page }) => {
  await page.route('**/src/review.js', async route => {
    const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('this.editor.advanceReview(this.runId);', "throw new Error('Injected reviewer failure');") });
  });
  await setup(page); await review(page, 'failed'); await expect(page.getByRole('alert')).toContainText('Injected reviewer failure');
  await page.getByRole('button', { name: 'Edit passage 2', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 2', exact: true }).fill('Writing still works.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Writing still works.');
});

test('explicit recovery and dialogue are abstentions, not false confident repairs', async ({ page }) => {
  await setup(page, 'Elara recovered the key.'); await review(page, 'resolved');
  await expect(page.locator('.review-finding')).toHaveCount(0);
  await page.getByText('Tool trace and abstentions', { exact: true }).click();
  await expect(page.locator('#review-diagnostics')).toContainText('intentional');
  await page.getByRole('button', { name: 'Edit passage 2', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 2', exact: true }).fill('"Elara carries the key."');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await review(page, 'resolved');
  await expect(page.locator('.review-finding')).toHaveCount(0); await expect(page.locator('#review-diagnostics')).toContainText('Dialogue');
});

test('frozen review continues on its original branch and repair changes only that branch', async ({ page }) => {
  await slowReviewer(page); await setup(page);
  await page.getByRole('button', { name: 'Start continuity review', exact: true }).click();
  await page.getByLabel('Branch name', { exact: true }).fill('Other path');
  await page.getByRole('button', { name: 'Fork current draft', exact: true }).click();
  await expect(page.locator('#review-cancel')).toBeDisabled({ timeout: 10000 }); await saved(page);
  await expect(page.locator('#review-status')).toContainText('No reviews');
  await page.locator('#branch-select').selectOption({ label: 'Main' });
  await expect(page.locator('#review-status')).toContainText('findings_ready');
  await finding(page).getByRole('button', { name: 'Apply patch', exact: true }).click(); await saved(page);
  await page.locator('#branch-select').selectOption({ label: 'Other path' });
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara carries the key.');
});

test('reviews and exceptions survive project export/import with validated citations', async ({ page }) => {
  await setup(page); await review(page);
  await finding(page).getByLabel('Decision reason', { exact: true }).fill('Intentional exception.');
  await finding(page).getByRole('button', { name: 'Mark intentional', exact: true }).click(); await saved(page);
  const workspace = await exported(page); expect(workspace.schemaVersion).toBe(4);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'New project', exact: true }).click(); await saved(page);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#file').setInputFiles({ name: 'reviews.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workspace)) }); await saved(page);
  expect(await exported(page)).toEqual(workspace); await expect(page.locator('#review-exceptions')).toContainText('Intentional exception.');
  const invalid = structuredClone(workspace); invalid.reviewRuns[0].findings[0].targetEvidence.quote = 'Invented evidence';
  await page.locator('#file').setInputFiles({ name: 'invalid-review.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole('alert')).toContainText('citation'); expect(await exported(page)).toEqual(workspace);
});
