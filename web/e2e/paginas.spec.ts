import { expect, test } from '@playwright/test';

for (const [route, heading] of [
  ['como-funciona', 'Cómo funciona'],
  ['resultados', 'Resultados'],
  ['manos', 'Manos destacadas'],
  ['playground', 'Banco de pruebas'],
] as const) {
  test(`${route} carga sin errores ni datos de ejemplo`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`#/${route}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    if (route !== 'playground') await expect(page.getByText(/de ejemplo/i)).toHaveCount(0);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
    expect(errors).toEqual([]);
  });
}

test('el crédito del arte y su licencia llegan al sitio', async ({ page, request }) => {
  await page.goto('#/jugar');
  await expect(page.getByText(/Card art by Jose Angel Canabal/)).toBeVisible();
  const lic = await request.get('cards/LICENSE-ART.md');
  expect(lic.ok()).toBe(true);
});

test('una repetición se recorre paso a paso', async ({ page }) => {
  await page.goto('#/manos');
  await expect(page.getByText(/Paso 1 de/)).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText(/Paso 2 de/)).toBeVisible();
});
