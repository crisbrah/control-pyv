// Prueba el modo demo local (sin red, sin Supabase): login, diseño, simulador y registro offline.
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('  ✔', m); };
try {
  await page.goto('http://localhost:4174/');
  await page.fill('#email', 'yo@pc'); await page.fill('#pass', '1'); await page.click('button[type=submit]');
  await page.getByText('N.° 29').waitFor(); ok(true, 'demo: entra con cualquier usuario y carga los 9 disparos');
  await page.getByRole('button', { name: 'Diseño' }).click(); await page.getByText('Receta por zona').waitFor();
  ok(/Taladros\s*44/i.test(await page.locator('main').innerText()), 'demo: la malla se dibuja (44 taladros)');
  await page.getByRole('button', { name: 'Simulador' }).click(); await page.getByText('FC medio de la campaña').waitFor();
  ok(true, 'demo: el simulador calcula');
  await ctx.setOffline(true);
  await page.getByRole('button', { name: 'Disparos' }).click();
  await page.getByRole('button', { name: 'Nuevo disparo' }).click(); await page.getByRole('button', { name: 'Volver' }).click();
  await page.waitForTimeout(500);
  ok(/pendiente/.test(await page.getByRole('button', { name: 'Sincronizar ahora' }).getAttribute('title')), 'demo: sin red queda pendiente');
  await ctx.setOffline(false); await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await page.getByText('Sincronizado').waitFor({ timeout: 8000 }); ok(true, 'demo: al volver la red sincroniza');

  // --- administración: nueva sección y usuario ---
  await page.getByRole('button', { name: 'Administración' }).click();
  await page.getByRole('button', { name: 'Nueva sección' }).click();
  await page.fill('#s-an', '4'); await page.fill('#s-al', '4'); await page.getByRole('button', { name: 'Horizontal' }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByText('4.00 x 4.00 horizontal').waitFor(); ok(true, 'admin: se crea la sección 4.00 x 4.00 horizontal');
  await page.getByRole('button', { name: 'Usuarios' }).click();
  await page.fill('#u-em', 'cargador1@sotrami.pe'); await page.fill('#u-no', 'Juan Cargador'); await page.selectOption('#u-ro', 'cargador');
  await page.getByRole('button', { name: 'Asignar acceso' }).click();
  await page.getByText('Juan Cargador').waitFor(); ok(true, 'admin: se asigna acceso a un usuario nuevo');
  await page.screenshot({ path: 'e2e/12-usuarios.png', fullPage: true });
  await page.getByRole('button', { name: 'Volver' }).click();

  // --- reporte PDF de una voladura ---
  await page.getByText('N.° 17').click();
  await page.getByRole('button', { name: /Cierre/ }).first().click();
  let dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar reporte PDF' }).click();
  let f = await dl; await f.saveAs('e2e/reporte-17.pdf'); ok(f.suggestedFilename().startsWith('voladura-17'), `reporte PDF: ${f.suggestedFilename()}`);
  await page.getByRole('button', { name: 'Volver' }).click();

  // --- análisis de 3 voladuras ---
  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  for (const nn of ['N.° 21', 'N.° 22', 'N.° 23']) await page.getByText(nn, { exact: true }).click();
  await page.getByRole('button', { name: 'Analizar 3 voladuras' }).click();
  await page.getByText('Conclusiones').waitFor();
  const t = await page.locator('main').innerText();
  ok(/Mann-Whitney/.test(t) && /exploratorios/.test(t), 'análisis: conclusiones con Mann-Whitney y advertencia de muestra');
  await page.screenshot({ path: 'e2e/13-analisis.png', fullPage: true });
  dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar análisis en PDF' }).click();
  f = await dl; await f.saveAs('e2e/analisis.pdf'); ok(true, `análisis PDF: ${f.suggestedFilename()}`);
  console.log(errs.join('\n') || '  sin errores');
} catch (e) { console.log(e.message, errs.join('\n')); }
await b.close(); srv.kill();
