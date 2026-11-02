// Base local en el dispositivo (IndexedDB vía Dexie). Todo se lee y escribe aquí primero.
import Dexie, { type Table } from 'dexie';
import type { CargaZona, ClaseRoca, Disparo, Estandar, Labor, Membresia, Movimiento, Plantilla, Producto, Respuesta, Seccion, Tabla } from './types';

export interface OutboxItem { seq?: number; tabla: Tabla; rowId: string; row: Record<string, unknown>; intentos: number; error?: string | null; creado: number }
export interface Meta { key: string; value: unknown }

class LocalDB extends Dexie {
  labores!: Table<Labor, string>;
  secciones!: Table<Seccion, string>;
  productos!: Table<Producto, string>;
  clases_roca!: Table<ClaseRoca, string>;
  plantillas_checklist!: Table<Plantilla, string>;
  estandares!: Table<Estandar, string>;
  disparos!: Table<Disparo, string>;
  carga_zona!: Table<CargaZona, string>;
  movimientos_explosivo!: Table<Movimiento, string>;
  checklist_respuestas!: Table<Respuesta, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<Meta, string>;
  constructor() {
    super('control-pyv');
    this.version(1).stores({
      labores: 'id, unidad_id', secciones: 'id, unidad_id', productos: 'id, unidad_id', clases_roca: 'id, unidad_id',
      plantillas_checklist: 'id, unidad_id', estandares: 'id, unidad_id, seccion_id',
      disparos: 'id, unidad_id, fecha, [unidad_id+numero_voladura]',
      carga_zona: 'id, disparo_id', movimientos_explosivo: 'id, disparo_id', checklist_respuestas: 'id, disparo_id',
      outbox: '++seq, [tabla+rowId]', meta: 'key',
    });
  }
}
export const db = new LocalDB();

export const uuid = () => crypto.randomUUID();

export async function getMeta<T>(key: string): Promise<T | undefined> { return (await db.meta.get(key))?.value as T | undefined }
export async function setMeta(key: string, value: unknown) { await db.meta.put({ key, value }) }

export const getMembresias = () => getMeta<Membresia[]>('membresias');

/** Guarda localmente y deja el cambio en la cola de envío (se reemplaza si ya había uno pendiente) */
export async function guardar<T extends { id: string }>(tabla: Tabla, row: T) {
  await db.transaction('rw', db.table(tabla), db.outbox, async () => {
    await db.table(tabla).put(row);
    await db.outbox.where('[tabla+rowId]').equals([tabla, row.id]).delete();
    await db.outbox.add({ tabla, rowId: row.id, row: { ...row }, intentos: 0, creado: Date.now() });
  });
  dispatchEvent(new Event('outbox-cambio'));
}

/** Pide al navegador que no borre la base local (Android/Chrome) */
export async function pedirPersistencia() {
  try { return await navigator.storage?.persist?.() } catch { return false }
}
