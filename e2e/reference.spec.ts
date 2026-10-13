import { test, expect } from '@playwright/test';

// Synthetic camera + fixture image keep this test independent of personal photos.
test('dragging and resizing the reference keeps the page stationary', async ({ page }) => {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose reference photo', exact: true }).click();
  await (await chooser).setFiles('e2e/fixtures/reference.png');
  await page.getByRole('button', { name: /☷.*Reference/ }).click();
  const surface = page.getByLabel('Drag reference with one finger or pinch with two fingers to resize', { exact: true });
  const reference = page.getByTestId('reference-photo');
  await expect(surface).toBeVisible();
  const pageState = () => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, scale: window.visualViewport?.scale ?? 1 }));
  const initialPage = await pageState();
  const initialFrame = await surface.boundingBox();
  const initialPhoto = await reference.boundingBox();
  if (!initialFrame || !initialPhoto) throw new Error('Reference must have visible bounds');

  await test.step('Drag the picture and verify only the picture moves', async () => {
    const x = initialFrame.x + initialFrame.width / 2;
    const y = initialFrame.y + initialFrame.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 50, y + 40, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await reference.boundingBox())?.x).toBeCloseTo(initialPhoto.x + 50, 0);
    await expect.poll(async () => (await reference.boundingBox())?.y).toBeCloseTo(initialPhoto.y + 40, 0);
    expect(await surface.boundingBox()).toEqual(initialFrame);
    expect(await pageState()).toEqual(initialPage);
  });

  await test.step('Pinch with two touch points without zooming the page', async () => {
    const session = await page.context().newCDPSession(page);
    const x = initialFrame.x + initialFrame.width / 2;
    const y = initialFrame.y + initialFrame.height / 2;
    const points = (distance: number) => [
      { x: x - distance, y, id: 1 }, { x: x + distance, y, id: 2 },
    ];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(40) });
    for (let distance = 44; distance <= 60; distance += 4) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    await expect.poll(async () => (await reference.boundingBox())?.width).toBeCloseTo(initialPhoto.width * 1.5, 0);
    expect(await surface.boundingBox()).toEqual(initialFrame);
    expect(await pageState()).toEqual(initialPage);
    await page.getByRole('button', { name: 'Reset reference size and position', exact: true }).click();
    await expect.poll(async () => await reference.boundingBox()).toEqual(initialPhoto);
  });

  await test.step('Resize using the control and verify the page does not zoom', async () => {
    await page.getByRole('button', { name: 'Make reference larger', exact: true }).click();
    await expect.poll(async () => (await reference.boundingBox())?.width).toBeCloseTo(initialPhoto.width * 1.1, 0);
    expect(await surface.boundingBox()).toEqual(initialFrame);
    expect(await pageState()).toEqual(initialPage);
  });

  await test.step('Reset restores the original picture position and size', async () => {
    await page.getByRole('button', { name: 'Reset reference size and position', exact: true }).click();
    await expect.poll(async () => await reference.boundingBox()).toEqual(initialPhoto);
  });
});
