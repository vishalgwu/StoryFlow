import { test, expect } from '@playwright/test';
const ready = async page => { await page.goto('/'); await expect(page.locator('#save-status')).toHaveText('Saved in this browser'); };
async function unobscured(page, selector) {
  await expect.poll(() => page.locator(selector).evaluate(element => {
    const r = element.getBoundingClientRect(), nav = document.querySelector('.studio-nav').getBoundingClientRect(), dock = document.querySelector('.writing-dock').getBoundingClientRect();
    return r.top >= nav.bottom - 1 && r.bottom <= dock.top + 1;
  })).toBe(true);
}
test('section navigation scrolls both ways with sticky context and clear headings', async ({ page }) => {
  await ready(page);
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth');
  for (const [name, section] of [['Continuity', '#continuity'], ['Memory', '#memory'], ['Branches', '#history']]) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'location');
    await unobscured(page, `${section} h2`);
  }
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Write', exact: true })).toHaveAttribute('aria-current', 'location');
  await unobscured(page, '#title');
  // Wait for the anchor destination, not just the title entering the viewport mid-animation.
  await expect.poll(() => page.locator('#draft').evaluate(element => Math.abs(element.getBoundingClientRect().top -
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) - parseFloat(getComputedStyle(element).scrollMarginTop)))).toBeLessThan(2);
  // Native wheel input remains free to move the page in either direction.
  await page.mouse.move(600, 250); await page.mouse.wheel(0, 650);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
  const lower = await page.evaluate(() => scrollY); await page.mouse.wheel(0, -350);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(lower - 150);
});
test('reduced motion removes smooth scrolling and animated cursor travel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ready(page);
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  await expect(page.locator('#story-cursor')).toHaveCSS('transition-duration', '0s');
  await page.getByRole('link', { name: 'Continuity', exact: true }).click();
  await unobscured(page, '#continuity h2');
  await page.setViewportSize({ width: 1000, height: 300 });
  await expect(page.locator('html')).toHaveClass(/flow-controls/);
  await expect(page.locator('.studio-nav')).toHaveCSS('position', 'static');
  await expect(page.locator('.writing-dock')).toHaveCSS('position', 'static');
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator('html')).not.toHaveClass(/flow-controls/);
});
test('long-story keyboard cursor stays visible and narrow dock adapts to its content', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Edit passage 1', exact: true }).click();
  await page.getByRole('textbox', { name: 'PASSAGE 1', exact: true }).fill('Elara followed the quiet river toward the distant lighthouse. '.repeat(60));
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.locator('#story-cursor').press('Home');
  await expect(page.locator('#cursor-position')).toHaveText('At the beginning');
  await unobscured(page, '#story-cursor');
  await page.keyboard.press('End'); await unobscured(page, '#story-cursor');
  await expect(page.locator('#cursor-position')).toContainText('At the end');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('link', { name: 'Help', exact: true }).click();
  await unobscured(page, '#help h2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dock = await page.locator('.writing-dock').boundingBox(), footer = await page.locator('.workspace footer').boundingBox();
  expect(dock.y + dock.height).toBeLessThanOrEqual(footer.y + 1);
  await expect(page.getByRole('button', { name: '⊕ Write here', exact: true })).toBeVisible();
});
