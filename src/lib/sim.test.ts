import { describe, expect, it } from 'vitest';
import { ESCENARIOS, baseDesde, fcEsperado, simularBase, simularEscenario } from './sim';

// 9 disparos reales del CX-400: kg, avance, perforación efectiva
const LB = [[175, 3.6, 4.1], [187.5, 3.8, 4.1], [155.32, 3.6, 4.1], [148.44, 3.5, 4.1], [150.46, 3.3, 4.1], [190.13, 3.5, 4.0], [135.21, 2.7, 4.0], [159.95, 3.5, 4.0], [162.5, 4.0, 4.0]]
  .map(([kg, avance, perf]) => ({ kg, avance, perf }));
const b = baseDesde(LB)!;

describe('línea base', () => {
  it('estadísticos del CX-400', () => {
    expect(b.n).toBe(9); expect(b.kgMedia).toBeCloseTo(162.7, 1); expect(b.kgCv).toBeCloseTo(0.113, 2);
    expect(b.avCv).toBeCloseTo(0.103, 2); expect(b.perfMedia).toBeCloseTo(4.056, 2);
  });
  it('correlación carga–avance 0.61', () => expect(b.rho).toBeCloseTo(0.61, 2));
  it('menos de 3 disparos: sin base', () => expect(baseDesde(LB.slice(0, 2))).toBeNull());
  it('la simulación de la base reproduce un FC cercano a 46.6', () => expect(simularBase(b, 40).media).toBeGreaterThan(45.5));
});

describe('escenarios con el estándar Holmberg (105.3 kg)', () => {
  const r = Object.fromEntries(ESCENARIOS.map((e) => [e.id, simularEscenario(e, b, 105.3, 40)]));
  it('pesimista ≈ 43 kg/m y no cumple la meta en promedio', () => { expect(r.pes.media).toBeCloseTo(43.0, 0); expect(r.pes.probMeta).toBeLessThan(0.3); });
  it('normal ≈ 35.4 kg/m, probabilidad alta', () => { expect(r.nor.media).toBeCloseTo(35.4, 0); expect(r.nor.probMeta).toBeGreaterThan(0.95); });
  it('optimista ≈ 30.7 kg/m', () => expect(r.opt.media).toBeCloseTo(30.7, 0));
  it('reproducible con la misma semilla', () => expect(simularEscenario(ESCENARIOS[1], b, 105.3, 40).media).toBe(r.nor.media));
  it('P10 < mediana < P90', () => expect(r.nor.p10 < r.nor.p50 && r.nor.p50 < r.nor.p90).toBe(true));
});

it('FC esperado determinístico: 105.3 kg / (4.06 m × 95 %) = 27.3', () => expect(fcEsperado(105.3, 0, 4.06, 0.95)).toBeCloseTo(27.3, 1));

import { mediaPert, muestraPert, pertPorDefecto, simularPert } from './sim';
describe('tres puntos (Beta-PERT)', () => {
  it('media PERT = (O + 4M + P) / 6', () => expect(mediaPert({ o: 0, m: 0.25, p: 0.55, fuente: '' })).toBeCloseTo(0.2583, 3));
  it('las muestras respetan el rango y la media PERT', () => {
    let s = 0, lo = 1, hi = 0; const t = { o: 0, m: 0.25, p: 0.55, fuente: '' };
    const r = (() => { let x = 1; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
    for (let i = 0; i < 20000; i++) { const v = muestraPert(r, t); s += v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(lo).toBeGreaterThanOrEqual(0); expect(hi).toBeLessThanOrEqual(0.55); expect(s / 20000).toBeCloseTo(0.2583, 2);
  });
  it('pesimista por defecto = la práctica actual (+54 % sobre 105.3 kg, eficiencia 86 %)', () => {
    const P = pertPorDefecto(b, 105.3);
    expect(P.calibracion.p).toBeCloseTo(0.545, 2); expect(P.eficiencia.p).toBeCloseTo(0.863, 2);
  });
  it('con O = M = P = la base, la campaña reproduce la base (~46.6)', () => {
    const cal = b.kgMedia / 105.3 - 1, ef = b.avMedia / b.perfMedia;
    const fijo = (x: number) => ({ o: x, m: x, p: x, fuente: '' });
    const r = simularPert({ calibracion: fijo(cal), eficiencia: fijo(ef), cvCarga: fijo(b.kgCv), cvAvance: fijo(b.avCv) }, b, 105.3, 40);
    expect(r.p50).toBeGreaterThan(45); expect(r.p50).toBeLessThan(48.5);
  });
  it('P10 < P50 < P90 y probabilidad entre 0 y 1', () => {
    const r = simularPert(pertPorDefecto(b, 105.3), b, 105.3, 40);
    expect(r.p10 < r.p50 && r.p50 < r.p90).toBe(true); expect(r.probMeta).toBeGreaterThan(0); expect(r.probMeta).toBeLessThanOrEqual(1);
  });
});
