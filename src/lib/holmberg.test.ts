import { describe, expect, it } from 'vitest';
import { ENTRADA_CX400, holmberg, recetaParaEstandar } from './holmberg';

// Caso de prueba obligatorio CX-400 (sección 5.3 del prompt del proyecto), tolerancia ±1 %
const e5 = { id: 'e5', nombre: 'E5000', kg: 0.266, densidad: 1.16, sanfo: 1.05, largo: 0.305 };
const e1 = { id: 'e1', nombre: 'E1000', kg: 0.25, densidad: 1.13, sanfo: 0.85, largo: 0.305 };
const E = ENTRADA_CX400({ e5, e1 });
const r = holmberg(E);
const close = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThanOrEqual(tol);

describe('Holmberg CX-400', () => {
  it('D2, F, L y avance esperado', () => { close(r.D2, 0.204); close(r.F, 0.0606); close(r.L, 5.47); close(r.avance, 3.857); expect(r.limitaArranque).toBe(false); });
  it('concentraciones de carga', () => { close(r.qArranque, 0.872); close(r.qFondo, 1.316); close(r.qColumna, 0.820); close(r.q1Min, 0.721); });
  it('arranque: Bp y Ah por sección', () => {
    [0.286, 0.339, 0.488, 0.636].forEach((b, i) => close(r.secciones[i].Bp, b));
    [0.405, 0.765, 1.232, 1.771].forEach((a, i) => close(r.secciones[i].Ah, a));
  });
  it('arrastres B 1.304, Bp 1.031, N 6', () => { close(r.arrastres.B, 1.304); close(r.arrastres.Bp, 1.031); expect(r.arrastres.N).toBe(6); close(r.arrastres.S, 0.785); });
  it('ayudas B 1.158, Bp 1.097', () => { close(r.ayudas.B, 1.158); close(r.ayudas.Bp, 1.097); });
  it('contorno S 0.675, B 0.844, Bp 0.571, 7 en corona, 4 por hastial', () => {
    close(r.contorno.S, 0.675); close(r.contorno.B, 0.844); close(r.contorno.Bp, 0.571);
    expect(r.contorno.nCorona).toBe(7); expect(r.contorno.hastialesLado).toBe(4);
  });
  it('44 taladros: 16 / 7 / 8 / 7 / 6', () => {
    expect(r.nTaladros).toBe(44);
    expect([r.receta.arranque.taladros, r.receta.ayudas.taladros, r.receta.hastiales.taladros, r.receta.corona.taladros, r.receta.arrastres.taladros]).toEqual([16, 7, 8, 7, 6]);
  });
  it('receta: 11 · 7+7 · 1+2 · 7+7 = 403 cartuchos', () => {
    expect(r.receta.arranque.columna).toBe(11);
    expect([r.receta.ayudas.fondo, r.receta.ayudas.columna]).toEqual([7, 7]);
    expect([r.receta.corona.fondo, r.receta.corona.columna]).toEqual([1, 2]);
    expect(r.cartuchos).toBe(403);
  });
  it('105.3 kg, FC 27.3 kg/m, 2.34 kg/m³', () => { close(r.kgTotal, 105.3); close(r.fcLineal, 27.3); close(r.fcVol, 2.34); close(r.area, 11.67); });
  it('carga máxima por retardo 14.45 kg en LP 11', () => { close(r.qopMax.kg, 14.45); expect(r.qopMax.lp).toBe(11); close(r.qop[15], 14.45); });
  it('receta exportable al estándar', () => { const x = recetaParaEstandar(E, r); expect(x.arranque.taladros).toBe(16); expect(x.taco_m).toBe(0.45); });
});

describe('sensibilidad al rimado', () => {
  it('rimados de 64 mm limitan el avance a 3.68 m', () => {
    const r64 = holmberg({ ...E, dRim: { valor: 0.064, fuente: 'supuesto' } });
    expect(r64.limitaArranque).toBe(true); close(r64.avance, 3.68); expect(r64.avisos.length).toBeGreaterThan(0);
  });
});
