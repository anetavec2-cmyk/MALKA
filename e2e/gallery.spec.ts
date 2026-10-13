import { test, expect } from '@playwright/test';

// A fresh browser session has no captured photos.
test('empty gallery shows its message and returns home', async ({ page }) => {
  await test.step('Open MALKA and enter the gallery', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'My photos', exact: true }).click();
  });

  await test.step('Check the empty gallery', async () => {
    await expect(page.getByText('Your photos will appear here.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download selected (0)', exact: true })).toBeDisabled();
  });

  await test.step('Return to the home screen', async () => {
    await page.getByRole('button', { name: /Home/ }).click();
    await expect(page.getByRole('button', { name: 'Choose reference photo', exact: true })).toBeVisible();
    await expect(page.getByText('Your photos will appear here.', { exact: true })).not.toBeVisible();
  });
});
