import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { onSync, type SyncEstado } from './lib/sync';
import type { Producto } from './lib/types';

export function useCatalogo(unidadId: string) {
  const labores = useLiveQuery(() => db.labores.where('unidad_id').equals(unidadId).filter((x) => !x.deleted_at).toArray(), [unidadId]) ?? [];
  const secciones = useLiveQuery(() => db.secciones.where('unidad_id').equals(unidadId).filter((x) => !x.deleted_at).toArray(), [unidadId]) ?? [];
  const productos = useLiveQuery(() => db.productos.where('unidad_id').equals(unidadId).filter((x) => !x.deleted_at).toArray(), [unidadId]) ?? [];
  const clases = useLiveQuery(() => db.clases_roca.where('unidad_id').equals(unidadId).toArray(), [unidadId]) ?? [];
  const estandares = useLiveQuery(() => db.estandares.where('unidad_id').equals(unidadId).filter((x) => !x.deleted_at).toArray(), [unidadId]) ?? [];
  const plantillas = useLiveQuery(() => db.plantillas_checklist.where('unidad_id').equals(unidadId).filter((x) => x.vigente && !x.deleted_at).toArray(), [unidadId]) ?? [];
  const prodMap = useMemo(() => new Map<string, Producto>(productos.map((p) => [p.id, p])), [productos]);
  return { labores, secciones, productos, clases, estandares, plantillas, prodMap };
}
export type Catalogo = ReturnType<typeof useCatalogo>;

export function useSync() {
  const [s, setS] = useState<SyncEstado>({ fase: 'inactivo', pendientes: 0, errores: 0 });
  useEffect(() => onSync(setS), []);
  return s;
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    addEventListener('online', a); addEventListener('offline', b);
    return () => { removeEventListener('online', a); removeEventListener('offline', b); };
  }, []);
  return on;
}
