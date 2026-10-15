import { expect, test, type Page } from '@playwright/test';

/** Errores de consola y de la página: tienen que quedar vacíos. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Hace una jugada cualquiera de las que hay; devuelve false si no había ninguna. */
async function playSomething(page: Page): Promise<boolean> {
  const card = page.getByRole('group', { name: 'Tus cartas' }).getByRole('button').and(page.locator(':enabled'));
  if (await card.count()) {
    await card.first().click();
    return true;
  }
  const quiero = page.getByRole('button', { name: 'Quiero', exact: true });
  if (await quiero.count()) {
    await quiero.first().click();
    return true;
  }
  return false;
}

test('se juega una mano entera contra el bot real', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('#/jugar');
  await expect(page.getByRole('group', { name: 'Tus cartas' })).toBeVisible({ timeout: 30_000 });
  const end = page.locator('.mesa__end');
  for (let i = 0; i < 60 && !(await end.isVisible()); i++) {
    if (!(await playSomething(page))) await page.waitForTimeout(300); // el bot está pensando
  }
  await expect(end).toBeVisible();
  await expect(end).toContainText(/Ganaste|Ganó el bot|pareja|partido/);

  // el cartel no tapa ninguna baza
  const endBox = (await end.boundingBox())!;
  for (const baza of await page.locator('.baza').all()) {
    const b = (await baza.boundingBox())!;
    const overlap = b.x < endBox.x + endBox.width && endBox.x < b.x + b.width && b.y < endBox.y + endBox.height && endBox.y < b.y + b.height;
    expect(overlap).toBe(false);
  }

  // sin scroll horizontal; en escritorio, tampoco vertical
  const { sw, cw, sh, ch } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
  }));
  expect(sw).toBeLessThanOrEqual(cw);
  if (test.info().project.name === 'escritorio') expect(sh).toBeLessThanOrEqual(ch);

  await page.getByRole('button', { name: /Nueva mano|Nuevo partido/ }).first().click();
  await expect(end).toBeHidden();
  expect(errors).toEqual([]);
});

test('el bot piensa entre 400 y 900 ms', async ({ page }) => {
  await page.goto('#/jugar');
  await expect(page.getByRole('group', { name: 'Tus cartas' })).toBeVisible({ timeout: 30_000 });
  const waiting = page.getByText('El bot está pensando…');
  const end = page.locator('.mesa__end');
  let measured: number | null = null;
  for (let i = 0; i < 20 && measured === null && !(await end.isVisible()); i++) {
    if (!(await playSomething(page))) {
      await page.waitForTimeout(200);
      continue;
    }
    try {
      await waiting.waitFor({ state: 'visible', timeout: 1_000 });
    } catch {
      continue; // el bot contestó (o no tenía que contestar) antes de verlo
    }
    const t0 = Date.now();
    await waiting.waitFor({ state: 'hidden', timeout: 5_000 });
    measured = Date.now() - t0;
  }
  expect(measured, 'se tiene que haber visto al bot pensando').not.toBeNull();
  // 400-900 ms de pausa; tolerancia por el sondeo de Playwright y la inferencia
  expect(measured!).toBeGreaterThanOrEqual(350);
  expect(measured!).toBeLessThan(1_500);
});
