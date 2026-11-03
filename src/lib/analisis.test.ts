import { describe, expect, it } from 'vitest';
import { analizar, imr, mannWhitney, stats, type Fila } from './analisis';

const FC = [48.61, 49.34, 43.14, 42.41, 45.59, 54.32, 50.08, 45.70, 40.63];
const fila = (fc: number, i: number, o: Partial<Fila> = {}): Fila => ({ id: `d${i}`, numero: String(i), fecha: '2026-09-1' + i, seccion_id: 's', labor_id: 'l', conEstandar: false,
  kg: fc * 3.5, avance: 3.5, perf: 4.06, fc, eficiencia: 86, desv: null, pctTaco: 0, sobreexc: null, sinConciliar: null, checklist: null, tirosFallados: null, desvZona: {}, ...o });

describe('estadísticos', () => {
  it('línea base: media 46.65, mediana 45.70', () => { const s = stats(FC)!; expect(s.media).toBeCloseTo(46.65, 2); expect(s.mediana).toBe(45.7); expect(s.de).toBeCloseTo(4.3, 1); });
  it('I-MR: MR̄ 4.16, LCS 57.7, LCI 35.6', () => { const c = imr(FC)!; expect(c.mrBar).toBeCloseTo(4.16, 2); expect(c.lcs).toBeCloseTo(57.7, 1); expect(c.lci).toBeCloseTo(35.6, 1); });
});

describe('Mann-Whitney', () => {
  it('exacta: tres disparos claramente menores frente a la base → p < 0.05', () => {
    const r = mannWhitney([33, 35, 34], FC)!; expect(r.metodo).toBe('exacta'); expect(r.U).toBe(0); expect(r.p).toBeCloseTo(2 / 220, 4);
  });
  it('sin diferencia → p alto', () => { const r = mannWhitney([45, 47, 46], FC)!; expect(r.p).toBeGreaterThan(0.5); });
  it('muestras grandes usan aproximación normal', () => {
    const a = Array.from({ length: 20 }, (_, i) => 30 + i * 0.3), b = Array.from({ length: 20 }, (_, i) => 40 + i * 0.3);
    const r = mannWhitney(a, b)!; expect(r.metodo).toBe('normal'); expect(r.p).toBeLessThan(0.001);
  });
});

describe('análisis completo', () => {
  const base = FC.map((f, i) => fila(f, i + 16));
  const sel = [34, 36, 35].map((f, i) => fila(f, i + 40, { conEstandar: true, kg: f * 3.8, avance: 3.8, desv: 3, pctTaco: 100, desvZona: { arranque: 2, ayudas: 12 } }));
  const A = analizar(sel, base, 40, 5);
  it('delta FC frente a la base', () => expect(A.delta.fc!).toBeCloseTo((35 / 46.65 - 1) * 100, 1));
  it('conclusiones: cumple meta, muestra pequeña, zona fuera de tolerancia', () => {
    const t = A.conclusiones.map((c) => c.texto).join(' | ');
    expect(t).toMatch(/cumple la meta/); expect(t).toMatch(/exploratorios/); expect(t).toMatch(/Zona ayudas/); expect(t).toMatch(/Mann-Whitney/);
  });
  it('detecta secciones mezcladas', () => expect(analizar([...sel, fila(40, 99, { seccion_id: 'otra' })], base, 40, 5).mezclaSecciones).toBe(true));
});
