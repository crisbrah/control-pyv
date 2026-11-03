// Análisis de un conjunto de voladuras: estadísticos, comparación con la línea base,
// descomposición carga/avance, control I-MR y prueba U de Mann-Whitney. Funciones puras.

export interface Fila {
  id: string; numero: string; fecha: string; guardia?: string | null; seccion_id: string; labor_id: string;
  conEstandar: boolean; kg: number | null; avance: number | null; perf: number | null; fc: number | null; eficiencia: number | null;
  desv: number | null; pctTaco: number | null; sobreexc: number | null; sinConciliar: number | null; checklist: number | null;
  tirosFallados: number | null; desvZona: Partial<Record<string, number>>;
}
export interface Stats { n: number; media: number; mediana: number; de: number; cv: number; min: number; max: number }

const nums = (x: (number | null | undefined)[]) => x.filter((v): v is number => v != null && isFinite(v));
export function stats(x0: (number | null | undefined)[]): Stats | null {
  const x = nums(x0).sort((a, b) => a - b); const n = x.length;
  if (!n) return null;
  const media = x.reduce((a, b) => a + b, 0) / n;
  const de = n > 1 ? Math.sqrt(x.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : 0;
  const mediana = n % 2 ? x[(n - 1) / 2] : (x[n / 2 - 1] + x[n / 2]) / 2;
  return { n, media, mediana, de, cv: media ? (de / media) * 100 : 0, min: x[0], max: x[n - 1] };
}

/** Límites I-MR (Montgomery): media ± 2.66 · rango móvil medio */
export function imr(x0: (number | null)[]) {
  const x = nums(x0);
  if (x.length < 2) return null;
  const mr = x.slice(1).map((v, i) => Math.abs(v - x[i]));
  const mrBar = mr.reduce((a, b) => a + b, 0) / mr.length, media = x.reduce((a, b) => a + b, 0) / x.length;
  return { media, mrBar, lcs: media + 2.66 * mrBar, lci: Math.max(0, media - 2.66 * mrBar) };
}

export function correlacion(a0: (number | null)[], b0: (number | null)[]) {
  const p = a0.map((a, i) => [a, b0[i]] as const).filter(([a, b]) => a != null && b != null) as [number, number][];
  if (p.length < 3) return null;
  const ma = p.reduce((s, [a]) => s + a, 0) / p.length, mb = p.reduce((s, [, b]) => s + b, 0) / p.length;
  let sab = 0, saa = 0, sbb = 0;
  for (const [a, b] of p) { sab += (a - ma) * (b - mb); saa += (a - ma) ** 2; sbb += (b - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
}

function combinaciones(n: number, k: number) { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }

/** U de Mann-Whitney, bilateral. Exacta por enumeración si es pequeña; si no, aproximación normal con corrección por empates */
export function mannWhitney(a0: (number | null)[], b0: (number | null)[]) {
  const a = nums(a0), b = nums(b0), n1 = a.length, n2 = b.length;
  if (n1 < 2 || n2 < 2) return null;
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  const rk = new Array(all.length); let tie = 0;
  for (let i = 0; i < all.length;) { let j = i; while (j + 1 < all.length && all[j + 1].v === all[i].v) j++; const r = (i + j + 2) / 2; for (let k = i; k <= j; k++) rk[k] = r; const t = j - i + 1; tie += t ** 3 - t; i = j + 1; }
  const R1 = all.reduce((s, x, i) => s + (x.g === 0 ? rk[i] : 0), 0);
  const U1 = R1 - (n1 * (n1 + 1)) / 2, U = Math.min(U1, n1 * n2 - U1), mu = (n1 * n2) / 2;
  let p: number, metodo: 'exacta' | 'normal';
  if (combinaciones(n1 + n2, n1) <= 200000) {
    metodo = 'exacta';
    const ranks = rk.slice(), N = ranks.length; let cnt = 0, tot = 0; const obs = Math.abs(U1 - mu) - 1e-9;
    const rec = (start: number, left: number, sum: number) => {
      if (left === 0) { tot++; if (Math.abs(sum - (n1 * (n1 + 1)) / 2 - mu) >= obs) cnt++; return; }
      for (let i = start; i <= N - left; i++) rec(i + 1, left - 1, sum + ranks[i]);
    };
    rec(0, n1, 0); p = cnt / tot;
  } else {
    metodo = 'normal';
    const N = n1 + n2, sd = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tie / (N * (N - 1))));
    const z = (Math.abs(U1 - mu) - 0.5) / sd;
    p = 2 * (1 - normCdf(z));
  }
  return { U, n1, n2, p: Math.min(1, p), metodo };
}
function normCdf(z: number) { const t = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp((-z * z) / 2); return 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); }

export interface Analisis {
  sel: Fila[]; base: Fila[]; mezclaSecciones: boolean;
  s: { fc: Stats | null; ef: Stats | null; kg: Stats | null; av: Stats | null; desv: Stats | null; taco: Stats | null; check: Stats | null };
  b: { fc: Stats | null; ef: Stats | null; kg: Stats | null; av: Stats | null };
  delta: { fc: number | null; kg: number | null; av: number | null };   // % frente a la base
  control: ReturnType<typeof imr>; fuera: string[];
  rho: number | null; mw: ReturnType<typeof mannWhitney>;
  zonas: { zona: string; media: number; n: number }[];
  conclusiones: { tono: 'bien' | 'mal' | 'neutro'; texto: string }[];
}

const pct = (a?: number | null, b?: number | null) => (a != null && b ? ((a - b) / b) * 100 : null);
const f1 = (v: number) => v.toFixed(1);

export function analizar(sel: Fila[], base: Fila[], meta: number, tol: number): Analisis {
  const s = { fc: stats(sel.map((x) => x.fc)), ef: stats(sel.map((x) => x.eficiencia)), kg: stats(sel.map((x) => x.kg)), av: stats(sel.map((x) => x.avance)),
    desv: stats(sel.map((x) => x.desv)), taco: stats(sel.map((x) => x.pctTaco)), check: stats(sel.map((x) => x.checklist)) };
  const b = { fc: stats(base.map((x) => x.fc)), ef: stats(base.map((x) => x.eficiencia)), kg: stats(base.map((x) => x.kg)), av: stats(base.map((x) => x.avance)) };
  const delta = { fc: pct(s.fc?.media, b.fc?.media), kg: pct(s.kg?.media, b.kg?.media), av: pct(s.av?.media, b.av?.media) };
  const control = base.length >= 3 ? imr(base.map((x) => x.fc)) : imr(sel.map((x) => x.fc));
  const fuera = control ? sel.filter((x) => x.fc != null && (x.fc > control.lcs || x.fc < control.lci)).map((x) => x.numero) : [];
  const rho = correlacion(sel.map((x) => x.kg), sel.map((x) => x.avance));
  const mw = base.length >= 2 ? mannWhitney(sel.map((x) => x.fc), base.map((x) => x.fc)) : null;
  const zmap: Record<string, number[]> = {};
  for (const x of sel) for (const [z, d] of Object.entries(x.desvZona)) if (d != null) (zmap[z] ??= []).push(d);
  const zonas = Object.entries(zmap).map(([zona, v]) => ({ zona, media: v.reduce((a, c) => a + c, 0) / v.length, n: v.length }));
  const mezclaSecciones = new Set(sel.map((x) => x.seccion_id)).size > 1;

  const C: Analisis['conclusiones'] = [];
  if (mezclaSecciones) C.push({ tono: 'mal', texto: 'La selección mezcla secciones distintas: el FC lineal depende del área y no es comparable. Analiza cada sección por separado.' });
  if (sel.length < 10) C.push({ tono: 'neutro', texto: `Muestra de ${sel.length} disparos: los resultados son exploratorios. El protocolo de validación pide al menos 10 disparos consecutivos.` });
  if (s.fc) {
    const ok = s.fc.media <= meta;
    C.push({ tono: ok ? 'bien' : 'mal', texto: `FC medio ${f1(s.fc.media)} kg/m (${f1(s.fc.min)}–${f1(s.fc.max)}): ${ok ? 'cumple' : 'no cumple'} la meta de ${meta} kg/m.` });
  }
  if (delta.fc != null && b.fc) {
    C.push({ tono: delta.fc < 0 ? 'bien' : 'mal', texto: `Frente a la línea base (${f1(b.fc.media)} kg/m, ${b.fc.n} disparos) el FC ${delta.fc < 0 ? 'baja' : 'sube'} ${f1(Math.abs(delta.fc))} %.` });
    if (delta.kg != null && delta.av != null) {
      const carga = -delta.kg, avance = delta.av;
      const palanca = Math.abs(carga) >= Math.abs(avance) ? 'la carga' : 'el avance';
      C.push({ tono: 'neutro', texto: `Descomposición (ΔFC % ≈ Δcarga % − Δavance %): carga ${delta.kg > 0 ? '+' : ''}${f1(delta.kg)} %, avance ${delta.av > 0 ? '+' : ''}${f1(delta.av)} %. La palanca principal fue ${palanca}.` });
    }
  }
  if (mw) C.push({ tono: mw.p < 0.05 ? 'bien' : 'neutro', texto: `Prueba U de Mann-Whitney frente a la base: U = ${mw.U.toFixed(1)}, p = ${mw.p.toFixed(3)} (${mw.metodo}). ${mw.p < 0.05 ? 'La diferencia es estadísticamente significativa (α = 0.05).' : 'No hay evidencia estadística suficiente de diferencia (α = 0.05); puede deberse al tamaño de muestra.'}` });
  if (fuera.length && control) C.push({ tono: 'mal', texto: `Disparos fuera de los límites de control (${f1(control.lci)}–${f1(control.lcs)} kg/m): N.° ${fuera.join(', ')}. Buscar causa especial.` });
  if (s.ef) C.push({ tono: s.ef.media >= 95 ? 'bien' : s.ef.media < 85 ? 'mal' : 'neutro', texto: `Eficiencia media ${f1(s.ef.media)} % (CV del avance ${f1(s.av?.cv ?? 0)} %).` });
  if (s.kg) C.push({ tono: s.kg.cv <= 5 ? 'bien' : 'neutro', texto: `Variabilidad de la carga: CV ${f1(s.kg.cv)} %${b.kg ? ` frente a ${f1(b.kg.cv)} % en la base` : ''}.` });
  if (s.desv) C.push({ tono: Math.abs(s.desv.media) <= tol ? 'bien' : 'mal', texto: `Carga real frente al estándar: ${s.desv.media > 0 ? '+' : ''}${f1(s.desv.media)} % en promedio (tolerancia ±${tol} %).` });
  for (const z of zonas.filter((z) => Math.abs(z.media) > tol)) C.push({ tono: 'mal', texto: `Zona ${z.zona}: desviación media ${z.media > 0 ? '+' : ''}${f1(z.media)} % frente a la receta.` });
  if (s.taco && s.taco.media < 100) C.push({ tono: 'mal', texto: `Taco de arcilla en ${f1(s.taco.media)} % de los taladros en promedio (meta 100 %).` });
  const sinConc = sel.filter((x) => x.sinConciliar != null && Math.abs(x.sinConciliar) > 0.5);
  if (sinConc.length) C.push({ tono: 'mal', texto: `Explosivo sin conciliar en ${sinConc.length} disparo(s): N.° ${sinConc.map((x) => x.numero).join(', ')}.` });
  if (rho != null && sel.length >= 5) C.push({ tono: 'neutro', texto: `Correlación carga–avance en la selección: ${rho.toFixed(2)}.` });
  if (sel.some((x) => !x.conEstandar)) C.push({ tono: 'neutro', texto: `${sel.filter((x) => !x.conEstandar).length} de los disparos seleccionados no tienen estándar asignado (no se mide su cumplimiento de carga).` });
  return { sel, base, mezclaSecciones, s, b, delta, control, fuera, rho, mw, zonas, conclusiones: C };
}
