// Simulación Monte Carlo del factor de carga. Todo lo que sale de aquí es PROYECTADO, no medido.

export interface Base { n: number; kgMedia: number; kgCv: number; avMedia: number; avCv: number; perfMedia: number; rho: number; fcMedia: number }
export interface Escenario { id: string; nombre: string; calibracion: number; eficiencia: number; cvCarga: number; cvAvance: number; descripcion: string }
export interface Resultado { fc: Float64Array; media: number; p10: number; p50: number; p90: number; probMeta: number; kg: number; avance: number; eficiencia: number }

export const ESCENARIOS: Escenario[] = [
  { id: 'pes', nombre: 'Pesimista', calibracion: 0.45, eficiencia: 0.88, cvCarga: 0.08, cvAvance: 0.09, descripcion: 'El diseño se calibra +45 %, la carga sigue variable y el avance casi no mejora.' },
  { id: 'nor', nombre: 'Normal', calibracion: 0.25, eficiencia: 0.92, cvCarga: 0.06, cvAvance: 0.07, descripcion: 'Calibración +25 %, carga controlada y mejora moderada del avance.' },
  { id: 'opt', nombre: 'Optimista', calibracion: 0.12, eficiencia: 0.95, cvCarga: 0.04, cvAvance: 0.05, descripcion: 'Calibración +12 %, control dentro de ±4 % y eficiencia de 95 %.' },
];

const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const sd = (x: number[]) => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); };

/** Estadísticos de la línea base a partir de disparos reales (kg, avance, perforación) */
export function baseDesde(rows: { kg: number; avance: number; perf: number }[]): Base | null {
  const r = rows.filter((x) => x.kg > 0 && x.avance > 0 && x.perf > 0);
  if (r.length < 3) return null;
  const k = r.map((x) => x.kg), a = r.map((x) => x.avance), p = r.map((x) => x.perf);
  const mk = mean(k), ma = mean(a), sk = sd(k), sa = sd(a);
  const cov = r.reduce((s, x) => s + (x.kg - mk) * (x.avance - ma), 0) / (r.length - 1);
  return { n: r.length, kgMedia: mk, kgCv: sk / mk, avMedia: ma, avCv: sa / ma, perfMedia: mean(p),
    rho: sk && sa ? Math.max(-0.95, Math.min(0.95, cov / (sk * sa))) : 0, fcMedia: mean(r.map((x) => x.kg / x.avance)) };
}

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Carga y avance ~ normal bivariada con correlación rho; el avance no supera la perforación */
export function simular(kgMedio: number, cvK: number, avMedio: number, cvA: number, perf: number, rho: number, meta: number, n = 20000, seed = 2026): Resultado {
  const r = rng(seed), fc = new Float64Array(n);
  let sk = 0, sa = 0;
  const c = Math.sqrt(1 - rho * rho);
  for (let i = 0; i < n; i++) {
    const R = Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))), th = 2 * Math.PI * r();
    const z1 = R * Math.cos(th), z2 = rho * z1 + c * R * Math.sin(th);
    const k = Math.max(0, kgMedio * (1 + cvK * z1));
    const a = Math.min(Math.max(0.3, avMedio * (1 + cvA * z2)), perf);
    fc[i] = k / a; sk += k; sa += a;
  }
  const s = Float64Array.from(fc).sort();
  const q = (p: number) => s[Math.min(n - 1, Math.floor(n * p))];
  let ok = 0; for (const v of fc) if (v <= meta) ok++;
  return { fc, media: fc.reduce((a, b) => a + b, 0) / n, p10: q(0.1), p50: q(0.5), p90: q(0.9), probMeta: ok / n, kg: sk / n, avance: sa / n, eficiencia: (sa / n / perf) * 100 };
}

export function simularEscenario(e: Escenario, b: Base, kgDiseno: number, meta: number) {
  return simular(kgDiseno * (1 + e.calibracion), e.cvCarga, b.perfMedia * e.eficiencia, e.cvAvance, b.perfMedia, b.rho, meta);
}
export function simularBase(b: Base, meta: number) {
  return simular(b.kgMedia, b.kgCv, b.avMedia, b.avCv, b.perfMedia, b.rho, meta, 20000, 7);
}

/** Histograma normalizado entre lo y hi */
export function histograma(fc: Float64Array, lo: number, hi: number, ancho = 1) {
  const n = Math.round((hi - lo) / ancho), h = new Array(n).fill(0);
  for (const v of fc) { const i = Math.floor((v - lo) / ancho); if (i >= 0 && i < n) h[i]++; }
  return h.map((c) => c / fc.length);
}

/** FC determinístico esperado: kg de diseño calibrado / avance esperado */
export const fcEsperado = (kgDiseno: number, calibracion: number, perf: number, eficiencia: number) =>
  (kgDiseno * (1 + calibracion)) / (perf * eficiencia);

// ===================== Estimación de tres puntos (PMBOK) + Monte Carlo =====================
// Cada variable incierta tiene Optimista / Más probable / Pesimista con distribución Beta-PERT.
// Dos niveles: (1) se sortean los parámetros del proceso (incertidumbre), (2) se simulan los
// disparos de una campaña de validación con su variabilidad disparo a disparo.

export interface TresPuntos { o: number; m: number; p: number; fuente: string }
export interface Pert { calibracion: TresPuntos; eficiencia: TresPuntos; cvCarga: TresPuntos; cvAvance: TresPuntos }

/** Valores por defecto con su origen: el pesimista es "no cambia nada" (la base real) */
export function pertPorDefecto(b: Base, kgDiseno: number): Pert {
  const calBase = Math.max(0.05, b.kgMedia / kgDiseno - 1);
  const efBase = Math.min(0.99, b.avMedia / b.perfMedia);
  return {
    calibracion: { o: 0, m: Math.min(0.25, calBase * 0.6), p: calBase, fuente: `O: carga real ≈ teórica (Chavimochic, UNT); M: juicio del grupo; P: la carga actual (+${(calBase * 100).toFixed(0)} % sobre el diseño)` },
    eficiencia: { o: 0.96, m: Math.min(0.92, Math.max(efBase + 0.02, (efBase + 0.96) / 2)), p: efBase, fuente: `O: 95–97 % logrado con Holmberg en tesis peruanas; M: juicio del grupo; P: base real (${(efBase * 100).toFixed(1)} %)` },
    cvCarga: { o: 0.04, m: 0.06, p: b.kgCv, fuente: `O: control ±5 % (meta); M: juicio; P: base real (${(b.kgCv * 100).toFixed(1)} %)` },
    cvAvance: { o: 0.05, m: 0.07, p: b.avCv, fuente: `O/M: juicio; P: base real (${(b.avCv * 100).toFixed(1)} %)` },
  };
}

function gamma(r: () => number, k: number): number { // Marsaglia–Tsang
  if (k < 1) return gamma(r, k + 1) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { const u1 = Math.max(r(), 1e-12), u2 = r(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; const u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
/** Muestra Beta-PERT entre min y max con moda m */
export function muestraPert(r: () => number, t: TresPuntos) {
  const lo = Math.min(t.o, t.p), hi = Math.max(t.o, t.p);
  if (hi - lo < 1e-9) return t.m;
  const m = Math.min(hi, Math.max(lo, t.m));
  const a = 1 + (4 * (m - lo)) / (hi - lo), b = 1 + (4 * (hi - m)) / (hi - lo);
  const x = gamma(r, a), y = gamma(r, b);
  return lo + (x / (x + y)) * (hi - lo);
}
export const mediaPert = (t: TresPuntos) => (t.o + 4 * t.m + t.p) / 6;

export interface ResultadoPert {
  disparo: Float64Array;   // FC de disparos individuales
  campana: Float64Array;   // FC medio de cada campaña de n disparos
  p10: number; p50: number; p90: number; media: number; probMeta: number; probDisparo: number; n: number;
  tornado: { variable: string; bajo: number; alto: number }[];
}

export function simularPert(P: Pert, b: Base, kgDiseno: number, meta: number, nCampana = 10, campanas = 4000, seed = 2026): ResultadoPert {
  const r = rng(seed), disparo = new Float64Array(campanas * nCampana), campana = new Float64Array(campanas);
  const c = Math.sqrt(1 - b.rho * b.rho);
  let ok = 0, okD = 0, j = 0;
  for (let i = 0; i < campanas; i++) {
    const cal = muestraPert(r, P.calibracion), ef = muestraPert(r, P.eficiencia), cvK = muestraPert(r, P.cvCarga), cvA = muestraPert(r, P.cvAvance);
    const kgM = kgDiseno * (1 + cal), avM = b.perfMedia * ef;
    let s = 0;
    for (let k = 0; k < nCampana; k++) {
      const R = Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))), th = 2 * Math.PI * r();
      const z1 = R * Math.cos(th), z2 = b.rho * z1 + c * R * Math.sin(th);
      const fc = Math.max(0, kgM * (1 + cvK * z1)) / Math.min(Math.max(0.3, avM * (1 + cvA * z2)), b.perfMedia);
      disparo[j++] = fc; s += fc; if (fc <= meta) okD++;
    }
    campana[i] = s / nCampana; if (campana[i] <= meta) ok++;
  }
  const sc = Float64Array.from(campana).sort(), q = (p: number) => sc[Math.floor(campanas * p)];
  // Tornado: FC esperado moviendo una variable de O a P y dejando las demás en su valor más probable
  const fcDet = (cal: number, ef: number) => (kgDiseno * (1 + cal)) / (b.perfMedia * ef);
  const tornado = [
    { variable: 'Calibración de la carga', bajo: fcDet(P.calibracion.o, P.eficiencia.m), alto: fcDet(P.calibracion.p, P.eficiencia.m) },
    { variable: 'Eficiencia de avance', bajo: fcDet(P.calibracion.m, P.eficiencia.o), alto: fcDet(P.calibracion.m, P.eficiencia.p) },
  ];
  return { disparo, campana, p10: q(0.1), p50: q(0.5), p90: q(0.9), media: campana.reduce((a, x) => a + x, 0) / campanas,
    probMeta: ok / campanas, probDisparo: okD / disparo.length, n: nCampana, tornado };
}
