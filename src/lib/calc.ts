// Funciones puras de cálculo. Mismas fórmulas que la vista v_disparo_kpi de Supabase.
import type { CargaZona, ClaseRoca, Disparo, Movimiento, Producto, Receta, Respuesta, Seccion, Zona } from './types';
import { ZONAS } from './types';

const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
export const round = (v: number | null, d = 1) => (v === null || !isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

export function areaSeccion(s: Pick<Seccion, 'ancho' | 'alto' | 'flecha'>) {
  const f = Number(s.flecha ?? 0), a = Number(s.ancho), h = Number(s.alto);
  return a * (h - f) + (2 / 3) * a * f;
}

/** kg de explosivo de un conjunto de líneas (los accesorios sin kg se ignoran) */
export function kgDe(lineas: { producto_id: string; cantidad: number }[], prods: Map<string, Producto>) {
  let kg = 0, unidades = 0;
  for (const l of lineas) {
    const p = prods.get(l.producto_id);
    if (!p || p.kg_unidad == null) continue;
    kg += Number(l.cantidad) * Number(p.kg_unidad);
    unidades += Number(l.cantidad);
  }
  return { kg, unidades };
}

export interface DisenoZona { taladros: number; lineas: { producto_id: string; cantidad: number; atacado?: boolean; cana?: boolean }[]; kg: number; unidades: number }

/** Expande la receta (por taladro) a totales por zona */
export function disenoPorZona(receta: Receta | null | undefined, prods: Map<string, Producto>) {
  const out: Partial<Record<Zona, DisenoZona>> = {};
  if (!receta) return out;
  for (const z of ZONAS) {
    const r = receta[z];
    if (!r || typeof r === 'number') continue;
    const lineas = r.productos.map((p) => ({ producto_id: p.id, cantidad: p.cantidad * r.taladros, atacado: p.atacado, cana: p.cana }));
    out[z] = { taladros: r.taladros, lineas, ...kgDe(lineas, prods) };
  }
  return out;
}

export const desviacion = (real: number, diseno: number) => (diseno > 0 ? ((real - diseno) / diseno) * 100 : null);

export function clasificar(valor: number | null | undefined, clases: ClaseRoca[], sistema = 'RMR') {
  if (valor == null) return null;
  return clases.find((c) => c.sistema === sistema && valor >= c.valor_min && valor <= c.valor_max) ?? null;
}

export interface Kpi {
  kg: number | null; unidades: number | null; fc: number | null; eficiencia: number | null; fcVol: number | null;
  sobreexc: number | null; pctTaco: number | null; desvTotal: number | null; kgDiseno: number | null;
  kgDespachado: number | null; kgDevuelto: number | null; sinConciliar: number | null; checklist: number | null;
}

export function kpiDisparo(
  d: Disparo, s: Seccion | undefined, carga: CargaZona[], movs: Movimiento[], prods: Map<string, Producto>,
  kgDiseno: number | null, resp: Respuesta[] = [],
): Kpi {
  const c = carga.filter((x) => !x.deleted_at);
  const cargado = c.length ? kgDe(c, prods) : null;
  const kg = cargado ? cargado.kg : n(d.kg_declarado);
  const unidades = cargado ? cargado.unidades : n(d.cartuchos_declarados);
  const av = n(d.avance), pe = n(d.perforacion_efectiva);
  const area = s ? areaSeccion(s) : null;
  const areaReal = d.ancho_real && d.alto_real ? Number(d.ancho_real) * Number(d.alto_real) : null;
  const desp = movs.filter((m) => m.tipo === 'despacho' && !m.deleted_at);
  const dev = movs.filter((m) => m.tipo === 'devolucion' && !m.deleted_at);
  const kgDesp = desp.length ? kgDe(desp, prods).kg : null;
  const kgDev = dev.length ? kgDe(dev, prods).kg : null;
  const aplic = resp.filter((r) => r.cumple !== null && r.cumple !== undefined);
  return {
    kg, unidades,
    fc: kg != null && av ? kg / av : null,
    eficiencia: av != null && pe ? (av / pe) * 100 : null,
    fcVol: kg != null && av && (areaReal ?? area) ? kg / ((areaReal ?? area)! * av) : null,
    sobreexc: areaReal && area ? ((areaReal - area) / area) * 100 : n((d.extra as Record<string, unknown>)?.sobreexcavacion_pct),
    pctTaco: d.taladros_cargados ? (Number(d.taladros_con_taco ?? 0) / Number(d.taladros_cargados)) * 100 : null,
    desvTotal: cargado && kgDiseno ? desviacion(cargado.kg, kgDiseno) : null,
    kgDiseno,
    kgDespachado: kgDesp, kgDevuelto: kgDev,
    sinConciliar: kgDesp != null ? kgDesp - (kgDev ?? 0) - (cargado?.kg ?? 0) : null,
    checklist: aplic.length ? (aplic.filter((r) => r.cumple).length / aplic.length) * 100 : null,
  };
}

/** Estado sugerido según lo registrado (nunca cierra solo) */
export function estadoSugerido(d: Disparo, hayCarga: boolean): Disparo['estado'] {
  if (d.estado === 'cerrado') return 'cerrado';
  if (d.avance != null) return 'disparado';
  if (hayCarga) return 'cargado';
  if (d.taladros_perforados || d.perforacion_efectiva) return 'perforado';
  return 'borrador';
}

export function media(v: (number | null)[]) {
  const x = v.filter((a): a is number => a !== null && isFinite(a));
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null;
}

/** Alertas del disparo para el supervisor */
export function alertas(k: Kpi, tol: number, metaFc?: number) {
  const a: { nivel: 'error' | 'aviso'; texto: string }[] = [];
  if (k.desvTotal != null && Math.abs(k.desvTotal) > tol) a.push({ nivel: 'error', texto: `Carga total ${k.desvTotal > 0 ? '+' : ''}${k.desvTotal.toFixed(1)} % frente al estándar (tolerancia ±${tol} %)` });
  if (k.sinConciliar != null && Math.abs(k.sinConciliar) > 0.5) a.push({ nivel: 'error', texto: `Explosivo sin conciliar: ${k.sinConciliar.toFixed(2)} kg (despachado − cargado − devuelto)` });
  if (k.pctTaco != null && k.pctTaco < 100) a.push({ nivel: 'aviso', texto: `Taco de arcilla en ${k.pctTaco.toFixed(0)} % de los taladros` });
  if (k.fc != null && metaFc && k.fc > metaFc) a.push({ nivel: 'aviso', texto: `FC ${k.fc.toFixed(1)} kg/m supera la meta de ${metaFc} kg/m` });
  if (k.eficiencia != null && k.eficiencia < 85) a.push({ nivel: 'aviso', texto: `Eficiencia de avance baja: ${k.eficiencia.toFixed(1)} %` });
  return a;
}
