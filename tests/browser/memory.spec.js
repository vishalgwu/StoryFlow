import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const quote = 'Elara cannot hear the forest after sunrise.';
const saved = page => expect(page.locator('#save-status')).toHaveText('Saved in this browser');
const card = page => page.locator('.memory-card').first();
async function ready(page) {
  await page.goto('/'); await saved(page);
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).fill(quote);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
}
async function suggest(page) { await page.getByRole('button', { name: 'Suggest facts from draft', exact: true }).click(); await saved(page); }
async function approve(page) { await card(page).getByRole('button', { name: 'Approve memory', exact: true }).click(); await saved(page); }
async function prepare(page) { await page.getByRole('button', { name: 'Prepare context', exact: true }).click(); }
async function exported(page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export project', exact: true }).click();
  const download = await pending; return JSON.parse(await readFile(await download.path(), 'utf8'));
}

test('propose, inspect evidence, approve, retrieve and consume a fact in an offline continuation', async ({ page }) => {
  await ready(page); await suggest(page);
  await expect(card(page)).toContainText('pending'); await prepare(page);
  await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
  await card(page).getByRole('button', { name: 'Open evidence', exact: true }).click();
  await expect(page.locator('#memory-evidence mark')).toHaveText(quote);
  await approve(page); await prepare(page);
  await expect(page.locator('#memory-included')).toContainText(quote);
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.locator('#run-status')).toContainText('Sample added'); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue(new RegExp(quote.replaceAll('.', '\\.')));
  await page.getByRole('button', { name: 'Inspect sample context', exact: true }).click();
  await expect(page.locator('#memory-context-status')).toContainText('1 approved facts');
  const workspace = await exported(page); expect(workspace.schemaVersion).toBe(4);
  expect(workspace.revisions.at(-1).generation.context.included[0].claim).toBe(quote);
  await page.reload(); await saved(page); await expect(card(page)).toContainText('accepted');
});

test('edited evidence becomes stale and cannot be approved before revalidation', async ({ page }) => {
  await ready(page); await suggest(page); await approve(page);
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).fill(quote + ' Rowan waited.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
  await expect(card(page)).toContainText('STALE EVIDENCE');
  await expect(card(page).getByRole('button', { name: 'Approve memory', exact: true })).toBeDisabled();
  await prepare(page); await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
  await card(page).getByRole('button', { name: 'Revalidate evidence', exact: true }).click(); await saved(page);
  await expect(card(page)).toContainText('pending'); await expect(card(page)).not.toContainText('STALE EVIDENCE');
  await approve(page); await prepare(page); await expect(page.locator('#memory-context-status')).toContainText('1 approved facts');
});

test('branch memory decisions and later parent facts remain isolated', async ({ page }) => {
  await ready(page); await suggest(page); await approve(page);
  await page.getByLabel('Branch name', { exact: true }).fill('Child');
  await page.getByRole('button', { name: 'Fork current draft', exact: true }).click(); await saved(page);
  await card(page).getByRole('button', { name: 'Dismiss memory', exact: true }).click(); await saved(page);
  await page.locator('#branch-select').selectOption({ label: 'Main' }); await prepare(page);
  await expect(page.locator('#memory-context-status')).toContainText('1 approved facts');
  await page.getByRole('button', { name: '+ Add paragraph', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 2', exact: true }).fill('Rowan carries a silver key.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await suggest(page);
  const rowan = page.locator('.memory-card').filter({ hasText: 'Rowan carries a silver key.' });
  await rowan.getByRole('button', { name: 'Approve memory', exact: true }).click(); await saved(page);
  await page.locator('#branch-select').selectOption({ label: 'Child' }); await saved(page);
  await expect(page.locator('#memory-context')).toBeHidden();
  await expect(page.locator('#memory-cards')).not.toContainText('Rowan carries');
  await prepare(page); await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
});

test('writer-assigned time and character knowledge filter context separately from reader knowledge', async ({ page }) => {
  await ready(page); await suggest(page);
  await card(page).getByText('Edit claim, time, and character knowledge', { exact: true }).click();
  await card(page).getByLabel('Valid from time step', { exact: true }).fill('2');
  await card(page).getByLabel('Valid until time step (blank means ongoing)', { exact: true }).fill('4');
  await card(page).getByLabel('Characters who know (comma separated)', { exact: true }).fill('Elara');
  await card(page).getByLabel('Characters who do not know (comma separated)', { exact: true }).fill('Rowan');
  await approve(page); await prepare(page); await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
  await page.getByLabel('Narrative time step', { exact: true }).fill('3'); await prepare(page);
  await expect(page.locator('#memory-context-status')).toContainText('1 approved facts');
  await page.getByLabel('Character viewpoint (blank means reader)', { exact: true }).fill('Rowan'); await prepare(page);
  await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
  await page.getByLabel('Character viewpoint (blank means reader)', { exact: true }).fill('Elara'); await prepare(page);
  await expect(page.locator('#memory-context-status')).toContainText('1 approved facts');
  await page.getByLabel('Narrative time step', { exact: true }).fill('5'); await prepare(page);
  await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
});

test('plans remain non-authoritative and editing accepted memory requires approval again', async ({ page }) => {
  await ready(page); await page.getByRole('button', { name: 'Propose selected evidence', exact: true }).click(); await saved(page);
  await card(page).getByText('Edit claim, time, and character knowledge', { exact: true }).click();
  await card(page).getByLabel('Record type', { exact: true }).selectOption('plan');
  await card(page).getByLabel('Claim', { exact: true }).fill('Elara will leave at dawn.');
  await approve(page); await prepare(page); await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
  await card(page).getByText('Edit claim, time, and character knowledge', { exact: true }).click();
  await card(page).getByLabel('Record type', { exact: true }).selectOption('fact');
  await card(page).getByLabel('Claim', { exact: true }).fill(quote);
  await card(page).getByRole('button', { name: 'Save proposal changes', exact: true }).click(); await saved(page);
  await expect(card(page)).toContainText('pending'); await prepare(page); await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
  await approve(page); await prepare(page); await expect(page.locator('#memory-context-status')).toContainText('1 approved facts');
});

test('locked constraints block an undersized continuation request instead of being silently dropped', async ({ page }) => {
  await ready(page); await suggest(page);
  await card(page).getByText('Edit claim, time, and character knowledge', { exact: true }).click();
  await card(page).getByLabel('Lock as a required fact (facts only)', { exact: true }).check();
  await approve(page); await page.getByLabel('Context budget (estimated input tokens)', { exact: true }).fill('256'); await prepare(page);
  await expect(page.locator('#memory-context-status')).toContainText('Blocked');
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No sample started');
  await expect(page.locator('#paragraphs textarea')).toHaveCount(1); await expect(page.locator('#stop')).toBeDisabled();
  await page.getByLabel('Context budget (estimated input tokens)', { exact: true }).fill('4096'); await prepare(page);
  await expect(page.locator('#memory-context-status')).toContainText('1 approved facts');
});

test('memory exports survive replacement/import; tampered evidence is rejected without changing the project', async ({ page }) => {
  await ready(page); await suggest(page); await approve(page); const workspace = await exported(page);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'New project', exact: true }).click(); await saved(page);
  await expect(page.locator('.memory-card')).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#file').setInputFiles({ name: 'memory.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workspace)) }); await saved(page);
  await expect(card(page)).toContainText('accepted'); expect(await exported(page)).toEqual(workspace);
  const broken = structuredClone(workspace); broken.memoryFacts[0].evidence.quote = 'False support';
  await page.locator('#file').setInputFiles({ name: 'invalid-memory.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) });
  await expect(page.getByRole('alert')).toContainText('evidence must match'); expect(await exported(page)).toEqual(workspace);
});

test('memory decisions during streaming invalidate the old completion while preserving its captured context', async ({ page }) => {
  await ready(page); await suggest(page);
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.locator('#preview')).toContainText('Mara held');
  await approve(page);
  await expect(page.locator('#run-status')).toContainText('Draft changed'); await saved(page);
  await expect(page.locator('#paragraphs textarea')).toHaveCount(1);
  await page.getByRole('button', { name: 'Inspect sample context', exact: true }).click();
  await expect(page.locator('#memory-context-status')).toContainText('0 approved facts');
  await prepare(page); await expect(page.locator('#memory-context-status')).toContainText('1 approved facts');
});

test('unsaved memory form edits survive an unrelated continuation rerender', async ({ page }) => {
  await ready(page); await suggest(page);
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.locator('#preview')).toContainText('Mara held');
  await card(page).getByText('Edit claim, time, and character knowledge', { exact: true }).click();
  await card(page).getByLabel('Claim', { exact: true }).fill('My unapplied memory correction.');
  await expect(page.locator('#run-status')).toContainText('Sample added');
  await expect(card(page).getByLabel('Claim', { exact: true })).toBeVisible();
  await expect(card(page).getByLabel('Claim', { exact: true })).toHaveValue('My unapplied memory correction.');
  await expect(card(page).getByLabel('Claim', { exact: true })).toBeFocused();
  await expect(card(page)).toContainText('pending');
});
