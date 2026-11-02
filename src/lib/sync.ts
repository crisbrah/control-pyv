// Sincronización: 1) envía la cola local (upsert por id, idempotente)  2) baja cambios por updated_at.
import { db, getMeta, setMeta } from './db';
import { supabase } from './supabase';
import { TABLAS_CATALOGO, TABLAS_DATOS, type Membresia, type Tabla } from './types';

export type SyncEstado = { fase: 'inactivo' | 'enviando' | 'bajando' | 'ok' | 'sin_conexion' | 'error'; pendientes: number; errores: number; mensaje?: string; ultima?: number };
type Listener = (s: SyncEstado) => void;
const listeners = new Set<Listener>();
let estado: SyncEstado = { fase: 'inactivo', pendientes: 0, errores: 0 };
const emit = (p: Partial<SyncEstado>) => { estado = { ...estado, ...p }; listeners.forEach((l) => l(estado)); };
addEventListener('outbox-cambio', () => { contarPendientes(); });
export const onSync = (l: Listener) => { listeners.add(l); l(estado); return () => { listeners.delete(l) } };

// Orden de envío: el padre antes que los hijos
const ORDEN: Tabla[] = ['disparos', 'carga_zona', 'movimientos_explosivo', 'checklist_respuestas'];
const esRed = (e: { message?: string } | null) => !!e && /fetch|network|Failed to fetch|NetworkError|timeout/i.test(e.message ?? '');

export async function contarPendientes() {
  const all = await db.outbox.toArray();
  emit({ pendientes: all.filter((o) => !o.error).length, errores: all.filter((o) => o.error).length });
}

async function enviar(): Promise<'ok' | 'sin_conexion'> {
  emit({ fase: 'enviando' });
  const items = (await db.outbox.orderBy('seq').toArray()).sort((a, b) => ORDEN.indexOf(a.tabla) - ORDEN.indexOf(b.tabla) || a.seq! - b.seq!);
  for (const it of items) {
    const { error } = await supabase.from(it.tabla).upsert(it.row, { onConflict: 'id' });
    if (error && esRed(error)) return 'sin_conexion';
    if (error) await db.outbox.update(it.seq!, { intentos: it.intentos + 1, error: `${error.code ?? ''} ${error.message}`.trim() });
    else await db.outbox.delete(it.seq!);
  }
  return 'ok';
}

async function bajar(unidadId: string) {
  emit({ fase: 'bajando' });
  const pendientes = new Set((await db.outbox.toArray()).map((o) => `${o.tabla}:${o.rowId}`));
  for (const t of [...TABLAS_CATALOGO, ...TABLAS_DATOS] as Tabla[]) {
    const k = `pull:${unidadId}:${t}`;
    const PAGE = 500;
    for (;;) {
      const desde = (await getMeta<string>(k)) ?? '1970-01-01T00:00:00Z';
      const { data, error } = await supabase.from(t).select('*').eq('unidad_id', unidadId)
        .gte('updated_at', desde).order('updated_at').order('id').limit(PAGE);
      if (error) throw error;
      if (!data?.length) break;
      const tabla = db.table(t);
      await db.transaction('rw', tabla, async () => {
        for (const r of data as { id: string; deleted_at?: string | null }[]) {
          if (pendientes.has(`${t}:${r.id}`)) continue;          // lo local pendiente gana hasta enviarse
          if (r.deleted_at) await tabla.delete(r.id); else await tabla.put(r);
        }
      });
      const ultimo = (data[data.length - 1] as { updated_at: string }).updated_at;
      // gte + avance de 1 ms: no se pierden filas con el mismo updated_at en el borde de página
      await setMeta(k, new Date(new Date(ultimo).getTime() + (data.length < PAGE ? 1 : 0)).toISOString());
      if (data.length < PAGE) break;
      if (new Date(ultimo).getTime() <= new Date(desde).getTime()) break; // página llena del mismo instante: evita bucle
    }
  }
}

export async function cargarMembresias(): Promise<Membresia[] | null> {
  const { data, error } = await supabase.from('membresias')
    .select('unidad_id, rol, unidad:unidades(id, nombre, es_demo, sistema_geomecanico, config)').eq('activo', true);
  if (error) { if (esRed(error)) return null; throw error; }
  const m = (data ?? []) as unknown as Membresia[];
  await setMeta('membresias', m);
  return m;
}

let corriendo = false;
export async function sincronizar(unidadId: string) {
  if (corriendo) return;
  corriendo = true;
  try {
    if (!navigator.onLine) { emit({ fase: 'sin_conexion' }); return; }
    const r = await enviar();
    if (r === 'sin_conexion') { emit({ fase: 'sin_conexion' }); return; }
    await bajar(unidadId);
    await contarPendientes();
    emit({ fase: estado.errores ? 'error' : 'ok', ultima: Date.now(), mensaje: estado.errores ? 'Algunos cambios fueron rechazados por el servidor' : undefined });
  } catch (e) {
    const msg = (e as Error).message;
    emit({ fase: esRed(e as Error) ? 'sin_conexion' : 'error', mensaje: msg });
  } finally {
    corriendo = false;
    await contarPendientes();
  }
}

export async function erroresCola() { return (await db.outbox.toArray()).filter((o) => o.error) }
export async function descartarError(seq: number) { await db.outbox.delete(seq); await contarPendientes(); }
export async function reintentarErrores() {
  const e = await erroresCola();
  await Promise.all(e.map((o) => db.outbox.update(o.seq!, { error: null })));
  await contarPendientes();
}
