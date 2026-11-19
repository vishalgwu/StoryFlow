import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const saved = page => expect(page.locator('#save-status')).toHaveText('Saved in this browser');
async function edit(page, number, text) {
  await page.getByRole('button', { name: `Edit passage ${number}`, exact: true }).click();
  await page.getByRole('textbox', { name: `PASSAGE ${number}`, exact: true }).fill(text);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
}
async function source(page) {
  await edit(page, 1, 'Elara lost the key.');
  await page.getByRole('button', { name: 'Propose selected evidence', exact: true }).click();
  await page.getByRole('button', { name: 'Approve memory', exact: true }).click(); await saved(page);
}
async function conflict(page) {
  await page.getByRole('button', { name: '+ Add paragraph', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 2', exact: true }).fill('Elara carries the key.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: 'Start continuity review', exact: true }).click();
  await expect(page.locator('#review-status')).toContainText('findings_ready'); await saved(page);
}
async function audit(page, testInfo, name) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  await testInfo.attach(`accessibility-${name}`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
}

test('accessibility audit covers initial editor, memory forms, findings and evidence', async ({ page }, testInfo) => {
  await page.goto('/'); await saved(page); await audit(page, testInfo, 'initial');
  await source(page);
  await page.locator('.memory-card summary').click();
  await audit(page, testInfo, 'memory');
  await conflict(page);
  await page.getByRole('button', { name: 'Inspect both passages', exact: true }).click();
  await expect(page.locator('#review-evidence')).toBeFocused();
  await audit(page, testInfo, 'review');
  await testInfo.attach('continuity-desktop', { body: await page.locator('#continuity').screenshot(), contentType: 'image/png' });
});

test('keyboard skips panels, saves and cancels prose, and retains focus after decisions', async ({ page }) => {
  await page.goto('/'); await saved(page);
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to story editor' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('#draft')).toBeFocused();
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toBeFocused();
  await page.keyboard.insertText('Elara lost the key.'); await page.keyboard.press('ControlOrMeta+Enter'); await saved(page);
  await expect(page.getByRole('button', { name: 'Edit passage 1', exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); await page.keyboard.insertText('Discard me'); await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).not.toHaveValue(/Discard me/);
  await source(page); await expect(page.locator('#memory-status')).toBeFocused();
  await conflict(page);
  await page.getByRole('button', { name: 'Dismiss finding', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#review-status')).toBeFocused();
  await expect(page.locator('#review-status')).toContainText('resolved');
});

test('320px reflow and enlarged text retain usable controls and pass accessibility audit', async ({ page }, testInfo) => {
  await page.route('**/styles.css', async route => {
    const response = await route.fetch();
    const css = (await response.text()).replace(/(font(?:-size)?:)(\d+(?:\.\d+)?)px/g, (_, property, size) => `${property}${Number(size) * 2}px`);
    await route.fulfill({ response, body: css });
  });
  await page.setViewportSize({ width: 320, height: 740 }); await page.goto('/'); await saved(page);
  await source(page); await conflict(page);
  const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => {
    const rect = e.getBoundingClientRect(); return rect.width && rect.right > innerWidth + 1;
  }).map(e => ({ tag: e.tagName, id: e.id, className: e.className, width: e.getBoundingClientRect().width })));
  expect(overflow).toEqual([]);
  const reflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('body *')].filter(e => e.clientWidth && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible').map(e => ({ tag: e.tagName, id: e.id, className: e.className, client: e.clientWidth, scroll: e.scrollWidth })) }));
  expect(reflow.scrollWidth, JSON.stringify(reflow)).toBeLessThanOrEqual(reflow.width);
  await audit(page, testInfo, 'narrow');
  await page.getByRole('button', { name: 'Apply patch', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara does not carry the key.');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara carries the key.');
  await testInfo.attach('continuity-narrow', { body: await page.locator('#continuity').screenshot(), contentType: 'image/png' });
});

test('release journey preserves original branch, approved memory, repairs and portable recovery without external calls', async ({ page }) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) external.push(request.url()); });
  await page.goto('/'); await saved(page); await source(page);
  await page.getByLabel('Branch name', { exact: true }).fill('Release alternative');
  await page.getByRole('button', { name: 'Fork current draft', exact: true }).click(); await saved(page);
  await page.getByRole('button', { name: 'Prepare context', exact: true }).click();
  await expect(page.locator('#memory-included')).toContainText('Elara lost the key.');
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.locator('#run-status')).toContainText('added'); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue(/Elara lost the key\./);
  await edit(page, 2, 'Elara carries the key.');
  await page.getByRole('button', { name: 'Start continuity review', exact: true }).click();
  await expect(page.locator('#review-status')).toContainText('findings_ready');
  await page.getByLabel('Proposed replacement', { exact: true }).fill('Elara searched for the missing key.');
  await page.getByRole('button', { name: 'Apply patch', exact: true }).click(); await saved(page);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const backup = await download, bytes = await readFile(await backup.path());
  const workspace = JSON.parse(bytes); expect(workspace.schemaVersion).toBe(4); expect(workspace.reviewRuns[0].findings[0].decision).toBe('applied');
  await page.reload(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara searched for the missing key.');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'New project', exact: true }).click(); await saved(page);
  await page.locator('#file').setInputFiles({ name: 'release.json', mimeType: 'application/json', buffer: bytes }); await saved(page);
  await expect(page.locator('#branch-select')).toHaveValue(workspace.activeBranchId);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('Elara searched for the missing key.');
  const main = workspace.branches.find(b => b.parentBranchId === null);
  await page.locator('#branch-select').selectOption(main.id); await saved(page);
  await expect(page.locator('#paragraphs textarea')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Elara lost the key.');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
