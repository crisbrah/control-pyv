import { describe, expect, it } from 'vitest';
import { areaSeccion, clasificar, disenoPorZona, kpiDisparo, media, desviacion } from './calc';
import type { ClaseRoca, Disparo, Producto, Receta, Seccion } from './types';

const U = 'u1';
const P = (id: string, kg: number | null): Producto => ({ id, unidad_id: U, nombre: id, categoria: 'emulsion', unidad_medida: 'cartucho', kg_unidad: kg, activo: true });
const prods = new Map([['e1000', P('e1000', 0.25)], ['e3000', P('e3000', 0.26596)], ['e5000', P('e5000', 0.26596)], ['fanel', P('fanel', null)]]);
const sec: Seccion = { id: 's', unidad_id: U, nombre: '3.5x3.5', ancho: 3.5, alto: 3.5, flecha: 0.5, sentido: 'negativo' };
const base = (o: Partial<Disparo>): Disparo => ({ id: 'd', unidad_id: U, labor_id: 'l', seccion_id: 's', numero_voladura: '1', fecha: '2026-09-09', estado: 'cerrado', origen: 'importado', ...o });

// 9 disparos reales del CX-400 (setiembre 2026)
const LB: [number, number, number][] = [[175, 3.6, 4.1], [187.5, 3.8, 4.1], [155.32, 3.6, 4.1], [148.44, 3.5, 4.1], [150.46, 3.3, 4.1], [190.13, 3.5, 4.0], [135.21, 2.7, 4.0], [159.95, 3.5, 4.0], [162.5, 4.0, 4.0]];

describe('indicadores de la línea base', () => {
  const k = LB.map(([kg, av, pe]) => kpiDisparo(base({ kg_declarado: kg, avance: av, perforacion_efectiva: pe }), sec, [], [], prods, null));
  it('FC medio 46.65 kg/m', () => expect(media(k.map((x) => x.fc))!).toBeCloseTo(46.65, 1));
  it('eficiencia media 86.3 %', () => expect(media(k.map((x) => x.eficiencia))!).toBeCloseTo(86.3, 1));
  it('área de la sección 11.67 m²', () => expect(areaSeccion(sec)).toBeCloseTo(11.67, 2));
});

describe('carga registrada', () => {
  it('disparo 17: 150 E1000 + 141 E3000 + 423 E5000 = 187.5 kg; ignora accesorios', () => {
    const carga = [['e1000', 150], ['e3000', 141], ['e5000', 423], ['fanel', 46]].map(([p, c], i) => ({ id: `${i}`, unidad_id: U, disparo_id: 'd', zona: 'sin_zona' as const, producto_id: p as string, cantidad: c as number }));
    const k = kpiDisparo(base({ avance: 3.8, perforacion_efectiva: 4.1 }), sec, carga, [], prods, null);
    expect(k.kg!).toBeCloseTo(187.5, 1);
    expect(k.unidades).toBe(714);
    expect(k.fc!).toBeCloseTo(49.34, 2);
  });
  it('conciliación: despacho − cargado − devuelto', () => {
    const carga = [{ id: 'c', unidad_id: U, disparo_id: 'd', zona: 'arranque' as const, producto_id: 'e5000', cantidad: 176 }];
    const movs = [
      { id: 'm1', unidad_id: U, disparo_id: 'd', tipo: 'despacho' as const, producto_id: 'e5000', cantidad: 188 },
      { id: 'm2', unidad_id: U, disparo_id: 'd', tipo: 'devolucion' as const, producto_id: 'e5000', cantidad: 10 },
    ];
    const k = kpiDisparo(base({}), sec, carga, movs, prods, null);
    expect(k.sinConciliar!).toBeCloseTo(2 * 0.26596, 5);
  });
});

describe('estándar Holmberg (receta del seed)', () => {
  const receta: Receta = {
    arranque: { taladros: 16, productos: [{ id: 'e5000', cantidad: 11 }] },
    ayudas: { taladros: 7, productos: [{ id: 'e5000', cantidad: 7, atacado: true }, { id: 'e1000', cantidad: 7 }] },
    hastiales: { taladros: 8, productos: [{ id: 'e5000', cantidad: 1 }, { id: 'e1000', cantidad: 2, cana: true }] },
    corona: { taladros: 7, productos: [{ id: 'e5000', cantidad: 1 }, { id: 'e1000', cantidad: 2, cana: true }] },
    arrastres: { taladros: 6, productos: [{ id: 'e5000', cantidad: 7, atacado: true }, { id: 'e1000', cantidad: 7 }] },
    taco_m: 0.45,
  };
  const dz = disenoPorZona(receta, prods);
  const tot = Object.values(dz).reduce((a, z) => ({ kg: a.kg + z!.kg, u: a.u + z!.unidades, t: a.t + z!.taladros }), { kg: 0, u: 0, t: 0 });
  it('44 taladros, 403 cartuchos, 105.3 kg', () => {
    expect(tot.t).toBe(44); expect(tot.u).toBe(403); expect(tot.kg).toBeCloseTo(105.3, 1);
  });
  it('arranque 46.8 kg', () => expect(dz.arranque!.kg).toBeCloseTo(46.8, 1));
  it('desviación +5 % detectada', () => expect(desviacion(110.565, 105.3)!).toBeCloseTo(5, 1));
});

describe('clasificación geomecánica por mina', () => {
  const C = (clase: string, a: number, b: number): ClaseRoca => ({ id: clase, unidad_id: U, sistema: 'RMR', clase, valor_min: a, valor_max: b });
  const cl = [C('III A', 51, 60), C('III B', 41, 50)];
  it('RMR 58 → III A', () => expect(clasificar(58, cl)!.clase).toBe('III A'));
  it('RMR 45 → III B', () => expect(clasificar(45, cl)!.clase).toBe('III B'));
  it('fuera de rango → null', () => expect(clasificar(90, cl)).toBeNull());
});
