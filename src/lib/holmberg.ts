// Modelo de Holmberg (formulación de López Jimeno et al., 1995) para frentes de avance.
// Traducción fiel de la implementación de referencia en Python del TAM (Anexo A). Unidades: m y kg.

export type Fuente = 'dato' | 'supuesto';
export interface Param<T = number> { valor: T; fuente: Fuente }
export interface ExplosivoDiseno { id: string; nombre: string; kg: number; densidad: number; sanfo: number; largo: number }

export interface Entrada {
  ancho: Param; alto: Param; flecha: Param;
  d1: Param;            // diámetro de perforación (m)
  dRim: Param; nRim: Param;
  H: Param;             // perforación efectiva (m)
  alfa: Param; e: Param; gamma: Param;  // desviación (m/m), emboquille (m), realce (°)
  c: Param; K: Param;   // constante de roca, S = K·d1 en el contorno
  dAtacado: Param;      // diámetro efectivo del cartucho atacado (m)
  yArranque: Param;     // altura del centro del arranque desde el piso (m)
  arranque: ExplosivoDiseno; fondo: ExplosivoDiseno; columna: ExplosivoDiseno;
}

export type ZonaH = 'arranque' | 'ayudas' | 'hastiales' | 'corona' | 'arrastres';
export interface Taladro { zona: ZonaH; x: number; y: number; lp: number }
export interface RecetaZona { taladros: number; fondo: number; columna: number; kgTaladro: number; kgZona: number; cartuchos: number; nota: string }
export interface Seccion { sec: number; B: number; Bp: number; Ah: number }

export interface Resultado {
  D2: number; F: number; L: number; avance: number; taco: number; area: number;
  qArranque: number; qFondo: number; qColumna: number; q1Min: number;
  secciones: Seccion[]; arrastres: { B: number; Bp: number; N: number; S: number }; ayudas: { B: number; Bp: number };
  contorno: { S: number; B: number; Bp: number; qMin: number; nCorona: number; hastialesLado: number };
  taladros: Taladro[]; rimados: { x: number; y: number }[];
  receta: Record<ZonaH, RecetaZona>;
  kgTotal: number; cartuchos: number; nTaladros: number; fcLineal: number; fcVol: number;
  qop: Record<number, number>; qopMax: { lp: number; kg: number };
  limitaArranque: boolean; avisos: string[];
  geom: { R: number; th: number; hWall: number };
}

const v = (p: Param) => p.valor;

export function holmberg(E: Entrada): Resultado {
  const H = v(E.H), d1 = v(E.d1), c = v(E.c), ancho = v(E.ancho), alto = v(E.alto), flecha = v(E.flecha);
  const avisos: string[] = [];
  const D2 = v(E.dRim) * Math.sqrt(v(E.nRim));
  const F = v(E.alfa) * H + v(E.e);
  const sg = Math.sin((v(E.gamma) * Math.PI) / 180);
  const L = 0.15 + 34.1 * D2 - 39.4 * D2 ** 2;
  const avance = 0.95 * Math.min(L, H);
  const taco = 10 * d1;
  if (L < H) avisos.push(`El arranque limita el avance: con los rimados solo se arrancan ${L.toFixed(2)} m de ${H.toFixed(2)} m perforados.`);

  const qLibre = (x: ExplosivoDiseno) => x.kg / x.largo;
  const qAtacado = (x: ExplosivoDiseno) => x.densidad * 1000 * Math.PI * v(E.dAtacado) ** 2 / 4;

  // ---------- Arranque ----------
  const qCut = qLibre(E.arranque), sCut = E.arranque.sanfo;
  const B1 = 1.7 * D2 - F;
  const q1Min = 55 * d1 * (B1 / D2) ** 1.5 * (B1 - D2 / 2) * (c / 0.4) / sCut;
  if (qCut < q1Min) avisos.push(`La carga del arranque (${qCut.toFixed(2)} kg/m) es menor que la mínima de la 1.ª sección (${q1Min.toFixed(2)} kg/m).`);
  let Ah = Math.SQRT2 * B1;
  const secciones: Seccion[] = [{ sec: 1, B: 1.7 * D2, Bp: B1, Ah }];
  for (;;) {
    const B = 0.088 * Math.sqrt((Ah * qCut * sCut) / (d1 * c));
    const Bp = B - F;
    const AhN = Math.SQRT2 * (Bp + Ah / 2);
    if (AhN > Math.sqrt(H) || secciones.length >= 4) break;
    secciones.push({ sec: secciones.length + 1, B, Bp, Ah: AhN });
    Ah = AhN;
  }

  const burden = (q: number, S: number, f: number, SB: number) => {
    let B = 1;
    for (let i = 0; i < 50; i++) { const cp = B >= 1.4 ? c + 0.05 : c + 0.07 / B; B = 0.9 * Math.sqrt((q * S) / (cp * f * SB)); }
    return B;
  };
  const qb = qAtacado(E.fondo), Sb = E.fondo.sanfo, qc = qLibre(E.columna);

  // ---------- Arrastres ----------
  const Ba = burden(qb, Sb, 1.45, 1), Bap = Ba - H * sg - F;
  const Na = Math.ceil((ancho + 2 * H * sg) / Ba + 2);
  // ---------- Contorno (corona y hastiales, voladura controlada) ----------
  const hWall = alto - flecha;
  const Sc = v(E.K) * d1, Bc = Sc / 0.8, Bcp = Bc - H * sg - F, qCorMin = 90 * d1 ** 2;
  const R = (ancho ** 2 / 4 + flecha ** 2) / (2 * flecha), th = Math.asin(ancho / 2 / R), arco = 2 * R * th;
  const Nc = Math.ceil(arco / Sc) + 1;
  const nInt = Math.ceil(hWall / Sc) - 1;
  // ---------- Ayudas ----------
  const By = burden(qb, Sb, 1.45, 1.25), Byp = By - F;

  // ---------- Geometría (x desde el eje, y desde el piso) ----------
  const tal: Taladro[] = [];
  const yc = v(E.yArranque);
  const cutLp = [[1, 2, 3, 4], [5, 5, 6, 6], [7, 7, 8, 8], [9, 9, 10, 10]];
  secciones.forEach((s, i) => {
    let pts: [number, number][];
    if (i === 0) { const a = s.Bp + D2 / 2; pts = [[a, 0], [0, a], [-a, 0], [0, -a]]; }
    else if (i % 2 === 1) { const h = s.Ah / 2; pts = [[h, h], [-h, h], [-h, -h], [h, -h]]; }
    else { const r = s.Ah / Math.SQRT2; pts = [[r, 0], [0, r], [-r, 0], [0, -r]]; }
    pts.forEach(([x, y], k) => tal.push({ zona: 'arranque', x, y: yc + y, lp: cutLp[i][k] }));
  });
  const rimados = [[1, 1], [-1, 1], [-1, -1], [1, -1]].slice(0, Math.max(0, Math.min(4, v(E.nRim))))
    .map(([dx, dy]) => ({ x: dx * 0.08, y: yc + dy * 0.08 }));
  const xw = ancho / 2, xAy = xw - Bcp;
  for (const y of [yc - 0.45, yc + 0.55]) { tal.push({ zona: 'ayudas', x: -xAy, y, lp: 11 }, { zona: 'ayudas', x: xAy, y, lp: 11 }); }
  const yArc = (x: number) => hWall + Math.sqrt(R ** 2 - x ** 2) - (R - flecha);
  for (const x of [-0.95, 0, 0.95]) tal.push({ zona: 'ayudas', x, y: yArc(x) - Bcp, lp: 12 });
  for (let k = 1; k <= nInt; k++) { const y = (hWall * k) / (nInt + 1); tal.push({ zona: 'hastiales', x: -xw, y, lp: 13 }, { zona: 'hastiales', x: xw, y, lp: 13 }); }
  for (let k = 0; k < Nc; k++) { const ang = -th + (2 * th * k) / (Nc - 1); const x = R * Math.sin(ang); tal.push({ zona: 'corona', x, y: yArc(x), lp: 14 }); }
  for (let k = 0; k < Na; k++) { const x = -xw + (ancho * k) / (Na - 1); tal.push({ zona: 'arrastres', x, y: 0, lp: k === 0 || k === Na - 1 ? 16 : 15 }); }

  // ---------- Receta por taladro ----------
  const Lc = H - taco;
  const ncart = (len: number, largo: number) => Math.max(0, Math.floor(len / largo + 1e-9));
  const lAt = E.fondo.kg / qb;
  const fondoCol = (hb: number) => { const nb = Math.ceil(hb / lAt); return { nb, nc: ncart(Lc - nb * lAt, E.columna.largo) }; };
  const nCut = ncart(Lc, E.arranque.largo);
  const ay = fondoCol(1.25 * Byp), ar = fondoCol(1.25 * Bap);
  const nCor = Math.ceil((qCorMin * Lc) / E.columna.kg);
  const cont = { nb: 1, nc: Math.max(nCor - 1, 2) };
  const cnt = (z: ZonaH) => tal.filter((t) => t.zona === z).length;
  const kgFC = (f: { nb: number; nc: number }) => f.nb * E.fondo.kg + f.nc * E.columna.kg;
  const mk = (z: ZonaH, fondo: number, columna: number, kgT: number, nota: string): RecetaZona =>
    ({ taladros: cnt(z), fondo, columna, kgTaladro: kgT, kgZona: kgT * cnt(z), cartuchos: (fondo + columna) * cnt(z), nota });
  const receta: Record<ZonaH, RecetaZona> = {
    arranque: mk('arranque', 0, nCut, nCut * E.arranque.kg, `${nCut} ${E.arranque.nombre} sin atacar`),
    ayudas: mk('ayudas', ay.nb, ay.nc, kgFC(ay), `${ay.nb} ${E.fondo.nombre} atacados + ${ay.nc} ${E.columna.nombre} sin atacar`),
    hastiales: mk('hastiales', cont.nb, cont.nc, kgFC(cont), `1 ${E.fondo.nombre} + ${cont.nc} ${E.columna.nombre} con caña`),
    corona: mk('corona', cont.nb, cont.nc, kgFC(cont), `1 ${E.fondo.nombre} + ${cont.nc} ${E.columna.nombre} con caña`),
    arrastres: mk('arrastres', ar.nb, ar.nc, kgFC(ar), `${ar.nb} ${E.fondo.nombre} atacados + ${ar.nc} ${E.columna.nombre} sin atacar`),
  };
  const zonas = Object.keys(receta) as ZonaH[];
  const kgTotal = zonas.reduce((a, z) => a + receta[z].kgZona, 0);
  const cartuchos = zonas.reduce((a, z) => a + receta[z].cartuchos, 0);
  const qop: Record<number, number> = {};
  for (const t of tal) qop[t.lp] = (qop[t.lp] ?? 0) + receta[t.zona].kgTaladro;
  const [lpMax, kgMax] = Object.entries(qop).reduce((a, [k, x]) => (x > a[1] + 1e-9 ? [Number(k), x] : a), [0, 0] as [number, number]);
  const area = ancho * hWall + (2 / 3) * ancho * flecha;
  if (Bap <= 0 || Byp <= 0 || Bcp <= 0) avisos.push('Algún burden práctico es negativo: revisa la desviación y el ángulo de realce.');

  return {
    D2, F, L, avance, taco, area, qArranque: qCut, qFondo: qb, qColumna: qc, q1Min, secciones,
    arrastres: { B: Ba, Bp: Bap, N: Na, S: (ancho + 2 * H * sg) / (Na - 1) }, ayudas: { B: By, Bp: Byp },
    contorno: { S: Sc, B: Bc, Bp: Bcp, qMin: qCorMin, nCorona: Nc, hastialesLado: nInt },
    taladros: tal, rimados, receta, kgTotal, cartuchos, nTaladros: tal.length,
    fcLineal: kgTotal / avance, fcVol: kgTotal / (area * avance), qop, qopMax: { lp: lpMax, kg: kgMax },
    limitaArranque: L < H, avisos, geom: { R, th, hWall },
  };
}

/** Receta en el formato de la tabla estandares (cantidades por taladro, ids de producto) */
export function recetaParaEstandar(E: Entrada, r: Resultado) {
  const z = r.receta, f = E.fondo.id, co = E.columna.id;
  return {
    arranque: { taladros: z.arranque.taladros, productos: [{ id: E.arranque.id, cantidad: z.arranque.columna, atacado: false }] },
    ayudas: { taladros: z.ayudas.taladros, productos: [{ id: f, cantidad: z.ayudas.fondo, atacado: true }, { id: co, cantidad: z.ayudas.columna, atacado: false }] },
    hastiales: { taladros: z.hastiales.taladros, productos: [{ id: f, cantidad: 1 }, { id: co, cantidad: z.hastiales.columna, cana: true }] },
    corona: { taladros: z.corona.taladros, productos: [{ id: f, cantidad: 1 }, { id: co, cantidad: z.corona.columna, cana: true }] },
    arrastres: { taladros: z.arrastres.taladros, productos: [{ id: f, cantidad: z.arrastres.fondo, atacado: true }, { id: co, cantidad: z.arrastres.columna, atacado: false }] },
    taco_m: Math.round(r.taco * 100) / 100,
  };
}

export const ENTRADA_CX400 = (x: { e5: ExplosivoDiseno; e1: ExplosivoDiseno }): Entrada => ({
  ancho: { valor: 3.5, fuente: 'dato' }, alto: { valor: 3.5, fuente: 'dato' }, flecha: { valor: 0.5, fuente: 'supuesto' },
  d1: { valor: 0.045, fuente: 'supuesto' }, dRim: { valor: 0.102, fuente: 'supuesto' }, nRim: { valor: 4, fuente: 'dato' },
  H: { valor: 4.06, fuente: 'dato' }, alfa: { valor: 0.01, fuente: 'supuesto' }, e: { valor: 0.02, fuente: 'supuesto' },
  gamma: { valor: 3, fuente: 'supuesto' }, c: { valor: 0.4, fuente: 'supuesto' }, K: { valor: 15, fuente: 'supuesto' },
  dAtacado: { valor: 0.038, fuente: 'supuesto' }, yArranque: { valor: 1.4, fuente: 'supuesto' },
  arranque: x.e5, fondo: x.e5, columna: x.e1,
});
