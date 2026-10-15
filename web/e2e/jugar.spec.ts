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

/**
 * Hace una jugada cualquiera de las que hay y espera a que la mesa la refleje;
 * devuelve false si no había ninguna. Sin esa espera, el sondeo siguiente ve la
 * mano vieja (todavía habilitada) y apunta a una carta que se deshabilita enseguida.
 */
async function playSomething(page: Page): Promise<boolean> {
  const hand = page.getByRole('group', { name: 'Tus cartas' });
  const card = hand.getByRole('button').and(page.locator(':enabled')).first();
  const quiero = page.getByRole('button', { name: 'Quiero', exact: true });
  if (await card.count()) {
    let label: string;
    try {
      label = (await card.getAttribute('aria-label', { timeout: 1_000 }))!;
      await hand.getByRole('button', { name: label, exact: true }).click({ timeout: 2_000 });
    } catch {
      return true; // la mesa cambió entre mirar y hacer clic: se vuelve a mirar
    }
    await expect(hand.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    return true;
  }
  if (await quiero.count()) {
    try {
      await quiero.first().click({ timeout: 2_000 });
    } catch {
      return true;
    }
    await expect(quiero).toHaveCount(0);
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

test('un canto se ve en grande en el paño, sin tapar las bazas ni agrandar la página', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('#/jugar');
  await expect(page.getByRole('group', { name: 'Tus cartas' })).toBeVisible({ timeout: 30_000 });
  const truco = page.getByRole('button', { name: 'Truco', exact: true });
  const title = page.locator('.mesa__news-title', { hasText: '¡TRUCO!' });
  let seen = false;
  for (let i = 0; i < 60 && !seen; i++) {
    if (await truco.count()) {
      await truco.click({ timeout: 2_000 }).catch(() => {});
      // el bot tarda al menos 400 ms en contestar: el cartel "Cantaste ¡TRUCO!" tiene que estar
      seen = await title.waitFor({ state: 'visible', timeout: 1_000 }).then(() => true, () => false);
      continue;
    }
    const nueva = page.getByRole('button', { name: 'Nueva mano' });
    if (await nueva.count()) await nueva.click({ timeout: 2_000 }).catch(() => {});
    else if (!(await playSomething(page))) await page.waitForTimeout(200);
  }
  expect(seen, 'se tiene que haber visto el cartel del truco').toBe(true);

  // todo en una sola medición, antes de que el bot conteste
  const m = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const news = box(document.querySelector('.mesa__news')!);
    const overlaps = [...document.querySelectorAll('.baza')].some((el) => {
      const b = box(el);
      return b.left < news.right && news.left < b.right && b.top < news.bottom && news.top < b.bottom;
    });
    const d = document.documentElement;
    return { overlaps, sw: d.scrollWidth, cw: d.clientWidth, sh: d.scrollHeight, ch: d.clientHeight };
  });
  expect(m.overlaps).toBe(false);
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  if (test.info().project.name === 'escritorio') expect(m.sh).toBeLessThanOrEqual(m.ch);
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

test.describe('con animaciones', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('el puntero en el borde de abajo de una carta no la hace saltar', async ({ page }) => {
    test.skip(test.info().project.name !== 'escritorio', 'el hover es de mouse');
    await page.goto('#/jugar');
    const card = page.getByRole('group', { name: 'Tus cartas' }).getByRole('button').and(page.locator(':enabled')).first();
    await expect(page.getByRole('group', { name: 'Tus cartas' })).toBeVisible({ timeout: 30_000 });
    // si el bot arranca cantando, se contesta hasta que toque jugar una carta
    const quiero = page.getByRole('button', { name: 'Quiero', exact: true });
    for (let i = 0; i < 30 && !(await card.count()); i++) {
      if (await quiero.count()) await quiero.click({ timeout: 2_000 }).catch(() => {});
      else await page.waitForTimeout(200);
    }
    await expect(card).toBeVisible();
    // el punto más bajo de la carta que de verdad toma el puntero (la barra de botones tapa un poco el pie)
    const edge = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      for (let y = Math.floor(r.bottom) - 1; y > r.top; y--) {
        if (el.contains(document.elementFromPoint(x, y))) return { x, y: y - 2 };
      }
      return null;
    });
    expect(edge, 'la carta tiene que tomar el puntero en algún lado').not.toBeNull();
    await page.mouse.move(edge!.x, edge!.y);
    await page.waitForTimeout(250); // que termine de subir (la transición dura 80 ms)
    const samples: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(80);
      samples.push(
        await card.evaluate((el) => `${el.matches(':hover')}|${getComputedStyle(el.querySelector('.pcard__face')!).translate}`),
      );
    }
    // levantada y quieta todo el tiempo: siempre con hover y siempre a la misma altura
    expect(new Set(samples).size, samples.join(' ')).toBe(1);
    expect(samples[0]).toMatch(/^true\|0px -14px$/);
  });
});
