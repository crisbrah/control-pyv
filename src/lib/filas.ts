// Construye las filas de análisis a partir de la base local.
import { db } from './db';
import { desviacion, disenoPorZona, kgDe, kpiDisparo } from './calc';
import type { Fila } from './analisis';
import type { Disparo, Estandar, Producto, Seccion } from './types';

export async function filasDe(disparos: Disparo[], secciones: Seccion[], estandares: Estandar[], prods: Map<string, Producto>): Promise<Fila[]> {
  const ids = disparos.map((d) => d.id);
  const [carga, movs, resp] = await Promise.all([
    db.carga_zona.where('disparo_id').anyOf(ids).toArray(),
    db.movimientos_explosivo.where('disparo_id').anyOf(ids).toArray(),
    db.checklist_respuestas.where('disparo_id').anyOf(ids).toArray(),
  ]);
  return disparos.map((d) => {
    const est = estandares.find((e) => e.id === d.estandar_id);
    const c = carga.filter((x) => x.disparo_id === d.id && !x.deleted_at);
    const k = kpiDisparo(d, secciones.find((s) => s.id === d.seccion_id), c, movs.filter((x) => x.disparo_id === d.id), prods, est?.kg_disparo ?? null, resp.filter((x) => x.disparo_id === d.id));
    const dz = disenoPorZona(est?.receta, prods), desvZona: Record<string, number> = {};
    for (const [z, v] of Object.entries(dz)) {
      const real = kgDe(c.filter((x) => x.zona === z), prods).kg;
      if (v && real > 0) desvZona[z] = desviacion(real, v.kg) ?? 0;
    }
    return { id: d.id, numero: d.numero_voladura, fecha: d.fecha, guardia: d.guardia, seccion_id: d.seccion_id, labor_id: d.labor_id, conEstandar: !!est,
      kg: k.kg, avance: d.avance ?? null, perf: d.perforacion_efectiva ?? null, fc: k.fc, eficiencia: k.eficiencia, desv: k.desvTotal, pctTaco: k.pctTaco,
      sobreexc: k.sobreexc, sinConciliar: k.sinConciliar, checklist: k.checklist, tirosFallados: d.tiros_fallados ?? null, desvZona };
  });
}

/** Línea base para comparar: disparos reales cerrados de la misma sección, sin estándar, no seleccionados */
export function baseDe(todos: Disparo[], seccionId: string, excluir: Set<string>) {
  return todos.filter((d) => d.seccion_id === seccionId && d.estado === 'cerrado' && !d.estandar_id && !d.deleted_at
    && (d.origen === 'medido' || d.origen === 'importado') && !excluir.has(d.id));
}
