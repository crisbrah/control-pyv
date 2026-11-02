import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { instalar, escrituras } from './mock.mjs';
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await instalar(page);
const shot = (n) => page.screenshot({ path: `e2e/${n}.png` });
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('  ✔', m); };
try {
  await page.goto('http://localhost:4173/');
  await shot('01-login');
  await page.fill('#email', 'crisbrah@gmail.com'); await page.fill('#pass', 'x'); await page.click('button[type=submit]');
  await page.getByText('N.° 29').waitFor(); await page.getByText('Sincronizado').waitFor();
  ok(await page.getByText('46.6').count() > 0, 'inicio muestra FC medio 46.6 de la línea base');
  await shot('02-inicio');

  // --- sin señal ---
  await ctx.setOffline(true);
  await page.getByRole('button', { name: 'Nuevo disparo' }).click();
  await page.selectOption('#est', 'est1');
  await shot('03-datos');
  await page.getByRole('button', { name: /Macizo/ }).first().click();
  await page.fill('#geo', '56'); await page.getByRole('button', { name: 'Goteo' }).click();
  ok(await page.getByText('Clase III A').count() === 1, 'RMR 56 se clasifica como III A');
  await shot('04-macizo');
  await page.getByRole('button', { name: /Perforación/ }).first().click();
  await page.fill('#perf', '48'); await page.fill('#carg', '44'); await page.fill('#pe', '4.06'); await page.fill('#rimn', '4');
  await page.getByRole('button', { name: /Vale/ }).first().click();
  const inputs = page.getByLabel('Cantidad');
  await inputs.nth(0).fill('120'); await inputs.nth(2).fill('300'); await inputs.nth(3).fill('46');
  await page.getByRole('button', { name: /Carguío/ }).first().click();
  await page.getByRole('button', { name: '= diseño' }).click();             // arranque = 176
  await page.getByRole('tab', { name: /Ayudas/ }).click();
  await page.getByLabel('Cantidad').nth(0).fill('60'); await page.getByLabel('Cantidad').nth(1).fill('49');
  await page.waitForTimeout(300);
  ok(await page.getByText('+22 %').count() === 1, 'ayudas con 60 E5000 frente a 49 de diseño marca +22 %');
  await shot('05-carguio');
  await page.getByRole('button', { name: /Resultado/ }).first().click();
  await page.fill('#av', '3.85'); await page.fill('#anr', '3.7'); await page.fill('#alr', '3.6');
  await page.getByRole('button', { name: /Checklist/ }).first().click();
  await page.getByRole('button', { name: 'Cumple' }).first().click();
  await page.getByRole('button', { name: 'No cumple' }).nth(2).click();
  await page.getByRole('button', { name: /Cierre/ }).first().click();
  await page.waitForTimeout(300);
  await shot('06-cierre');
  await page.getByRole('button', { name: 'Cerrar disparo' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.waitForTimeout(500);
  const chip = await page.getByRole('button', { name: 'Sincronizar ahora' }).getAttribute('title');
  ok(/Sin señal · \d+ pendientes/.test(chip), `sin señal los cambios quedan en cola (${chip})`);
  ok(escrituras.length === 0, 'sin señal no se envía nada');
  await shot('07-sin-senal');

  // --- vuelve la señal ---
  await ctx.setOffline(false);
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await page.getByText('Sincronizado').waitFor({ timeout: 8000 });
  const tablas = [...new Set(escrituras.map((e) => e.tabla))];
  ok(escrituras.some((e) => e.tabla === 'disparos' && e.body.estado === 'cerrado'), 'el disparo cerrado se envía a Supabase');
  ok(tablas[0] === 'disparos', `orden de envío: ${tablas.join(' → ')}`);
  const n = escrituras.length;
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click(); await page.waitForTimeout(800);
  ok(escrituras.length === n, `reenvío no duplica (${n} escrituras, una por fila)`);
  await shot('08-sincronizado');
  console.log(errs.filter((e) => !/fonts|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).join('\n') || '  sin errores de consola');
} catch (e) { console.log(e.message); await shot('error'); console.log(errs.join('\n')); }
await b.close(); srv.kill();
