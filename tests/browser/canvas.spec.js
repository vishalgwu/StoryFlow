import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const saved = page => expect(page.locator('#save-status')).toHaveText('Saved in this browser');
async function ready(page) {
  await page.goto('/'); await saved(page);
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).fill('Elara found the moonlit gate. The original ending remains.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
}
const cursor = page => page.locator('#story-cursor');
test('word cursor moves both ways without editing and returns to the end', async ({ page }) => {
  await ready(page);
  await cursor(page).focus(); await page.keyboard.press('Home');
  await expect(page.locator('#cursor-position')).toHaveText('At the beginning');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await expect(page.locator('#cursor-position')).toContainText('After “found”');
  await page.keyboard.press('ArrowLeft'); await expect(page.locator('#cursor-position')).toContainText('After “Elara”');
  await expect(page.locator('.future-word')).toHaveCount(8);
  await expect(page.locator('#branch-select option')).toHaveCount(1);
  await cursor(page).dblclick(); await expect(page.locator('#cursor-position')).toContainText('At the end');
  await expect(page.locator('#cursor-composer')).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Elara found the moonlit gate. The original ending remains.');
});
test('pointer drag selects an earlier word and retains the existing story', async ({ page }) => {
  await ready(page);
  const start = await cursor(page).boundingBox(), target = await page.locator('.story-word').nth(2).boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(target.x + target.width - 1, target.y + target.height / 2, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('#cursor-position')).toContainText('After “the”');
  await expect(page.locator('#cursor-composer')).toBeHidden();
  await expect(page.locator('#branch-select option')).toHaveCount(1);
});
test('write from the circle forks safely and unapplied new writing recovers after reload', async ({ page }) => {
  await ready(page); const main = await page.locator('#branch-select').inputValue();
  await cursor(page).focus(); await page.keyboard.press('Home');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: '⊕ Write here', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toBeFocused();
  await page.keyboard.insertText('A different ending begins.');
  await expect(page.locator('#save-status')).toContainText('Recovery checkpoint saved');
  await page.reload(); await expect(page.locator('#save-status')).toContainText('Recovery checkpoint saved');
  await expect(page.getByRole('textbox', { name: 'PASSAGE 2', exact: true })).toHaveValue('A different ending begins.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Elara found the');
  await page.locator('#branch-select').selectOption(main); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Elara found the moonlit gate. The original ending remains.');
  await expect(page.locator('#paragraphs textarea')).toHaveCount(1);
});
test('generating at an earlier cursor preserves the original branch and supports undo', async ({ page }) => {
  await ready(page); const main = await page.locator('#branch-select').inputValue();
  await cursor(page).focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Generate next ↗ (offline sample)', exact: true }).click();
  await expect(page.locator('#run-status')).toContainText('Sample added'); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Elara');
  await expect(page.locator('#paragraphs textarea')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved(page);
  await expect(page.locator('#paragraphs textarea')).toHaveCount(1);
  await page.locator('#branch-select').selectOption(main); await saved(page);
  await expect(page.getByRole('textbox', { name: 'PASSAGE 1', exact: true })).toHaveValue('Elara found the moonlit gate. The original ending remains.');
});
test('cursor menu is keyboard accessible and cursor actions block during an unapplied edit', async ({ page }) => {
  await ready(page); await cursor(page).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Write a passage here', exact: true })).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map(v => v.id)).toEqual([]);
  await page.keyboard.press('Escape'); await expect(cursor(page)).toBeFocused();
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await expect(cursor(page)).toBeDisabled(); await expect(page.locator('#cursor-write')).toBeDisabled();
});
