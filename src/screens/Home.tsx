import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, CloudOff, LogOut, Plus, RefreshCw, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { db, guardar, uuid } from '../lib/db';
import { kpiDisparo, media } from '../lib/calc';
import { descartarError, reintentarErrores, sincronizar } from '../lib/sync';
import { puedeCrear, type Disparo, type Membresia } from '../lib/types';
import { useCatalogo, useOnline, useSync } from '../hooks';
import { Button, Pill, Stat, cx, fmt } from '../ui';

export const ESTADO: Record<Disparo['estado'], { label: string; tone: 'muted' | 'warn' | 'good' | 'accent' }> = {
  borrador: { label: 'Borrador', tone: 'muted' }, perforado: { label: 'Perforado', tone: 'warn' }, cargado: { label: 'Cargado', tone: 'warn' },
  disparado: { label: 'Disparado', tone: 'warn' }, cerrado: { label: 'Cerrado', tone: 'good' },
};

export function SyncChip({ unidadId, compact }: { unidadId: string; compact?: boolean }) {
  const s = useSync(), online = useOnline();
  const busy = s.fase === 'enviando' || s.fase === 'bajando';
  const [txt, tone, Icon] = !online || s.fase === 'sin_conexion'
    ? [s.pendientes ? `Sin señal · ${s.pendientes} pendientes` : 'Sin señal', 'warn', CloudOff] as const
    : s.errores ? [`${s.errores} con error`, 'bad', TriangleAlert] as const
      : busy ? ['Sincronizando…', 'muted', RefreshCw] as const
        : s.pendientes ? [`${s.pendientes} pendientes`, 'warn', RefreshCw] as const
          : ['Sincronizado', 'good', CheckCircle2] as const;
  return <button onClick={() => sincronizar(unidadId)} aria-label="Sincronizar ahora" title={txt}
    className={cx('inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] font-semibold border',
      tone === 'good' && 'border-good/40 text-good', tone === 'warn' && 'border-accent/50 text-accent',
      tone === 'bad' && 'border-bad/50 text-bad', tone === 'muted' && 'border-line text-muted')}>
    <Icon size={15} className={busy ? 'animate-spin' : ''} />{compact ? (s.pendientes || s.errores ? <span className="num">{s.pendientes + s.errores}</span> : null) : txt}
  </button>;
}

export function Home({ m, onOpen, onLogout, onCambiarUnidad, multi }: { m: Membresia; onOpen: (id: string) => void; onLogout: () => void; onCambiarUnidad: () => void; multi: boolean }) {
  const u = m.unidad;
  const cat = useCatalogo(u.id);
  const [filtro, setFiltro] = useState<'abiertos' | 'cerrados' | 'todos'>('todos');
  const disparos = useLiveQuery(() => db.disparos.where('unidad_id').equals(u.id).filter((d) => !d.deleted_at).toArray(), [u.id]) ?? [];
  const ids = disparos.map((d) => d.id);
  const carga = useLiveQuery(() => db.carga_zona.where('disparo_id').anyOf(ids).toArray(), [ids.join()]) ?? [];
  const movs = useLiveQuery(() => db.movimientos_explosivo.where('disparo_id').anyOf(ids).toArray(), [ids.join()]) ?? [];

  const filas = useMemo(() => disparos
    .map((d) => {
      const est = cat.estandares.find((e) => e.id === d.estandar_id);
      return { d, k: kpiDisparo(d, cat.secciones.find((s) => s.id === d.seccion_id), carga.filter((c) => c.disparo_id === d.id), movs.filter((x) => x.disparo_id === d.id), cat.prodMap, est?.kg_disparo ?? null) };
    })
    .sort((a, b) => b.d.fecha.localeCompare(a.d.fecha) || b.d.numero_voladura.localeCompare(a.d.numero_voladura, 'es', { numeric: true })),
  [disparos, carga, movs, cat]);
  const cerrados = filas.filter((f) => f.d.estado === 'cerrado');
  const visibles = filas.filter((f) => filtro === 'todos' || (filtro === 'cerrados' ? f.d.estado === 'cerrado' : f.d.estado !== 'cerrado'));
  const meta = u.config?.meta_fc;
  const fcMedio = media(cerrados.map((f) => f.k.fc)), efMedio = media(cerrados.map((f) => f.k.eficiencia));

  async function nuevo() {
    const labor = cat.labores[0], sec = cat.secciones[0];
    if (!labor || !sec) { alertMsg('Primero el ingeniero debe registrar al menos una labor y una sección.'); return; }
    const est = cat.estandares.filter((e) => e.seccion_id === sec.id).sort((a, b) => Number(b.vigente) - Number(a.vigente) || b.version - a.version)[0];
    const maxN = Math.max(0, ...disparos.map((d) => parseInt(d.numero_voladura)).filter(isFinite));
    const d: Disparo = {
      id: uuid(), unidad_id: u.id, labor_id: labor.id, seccion_id: sec.id, estandar_id: est?.id ?? null,
      numero_voladura: String(maxN + 1), fecha: new Date().toLocaleDateString('en-CA'), estado: 'borrador', origen: 'medido',
      guardia: new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Día' : 'Noche', extra: {}, calidad: [],
    };
    await guardar('disparos', d);
    onOpen(d.id);
  }
  const [msg, alertMsg] = useState<string | null>(null);

  return <div className="min-h-full pb-28">
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-3">
      <button onClick={multi ? onCambiarUnidad : undefined} className="min-w-0 text-left flex-1">
        <div className="font-display text-[24px] leading-tight font-semibold truncate">{u.nombre}</div>
        <div className="text-[12.5px] text-muted capitalize">{m.rol}{u.es_demo && ' · datos simulados'}{multi && ' · cambiar'}</div>
      </button>
      <SyncChip unidadId={u.id} />
      <button aria-label="Cerrar sesión" onClick={onLogout} className="size-10 grid place-items-center rounded-lg border border-line text-muted"><LogOut size={18} /></button>
    </header>

    <main className="px-4 pt-4 grid gap-4 max-w-3xl mx-auto">
      {u.es_demo && <div className="rounded-lg border border-accent/50 bg-accent/10 text-accent text-sm px-3 py-2">Unidad DEMO: todo lo registrado aquí se trata como simulado y no se mezcla con datos reales.</div>}
      <section className="grid grid-cols-3 gap-2" aria-label="Resumen de disparos cerrados">
        <Stat label="Disparos" value={String(cerrados.length)} sub={`${filas.length - cerrados.length} abiertos`} />
        <Stat label="FC medio" value={fmt(fcMedio)} unit="kg/m" tone={fcMedio != null && meta ? (fcMedio <= meta ? 'good' : 'bad') : undefined} sub={meta ? `meta ≤ ${meta}` : undefined} />
        <Stat label="Eficiencia" value={fmt(efMedio)} unit="%" sub={u.config?.meta_eficiencia ? `meta ≥ ${u.config.meta_eficiencia}` : undefined} />
      </section>

      <div className="flex gap-2" role="group" aria-label="Filtro">
        {(['todos', 'abiertos', 'cerrados'] as const).map((f) => <button key={f} aria-pressed={filtro === f} onClick={() => setFiltro(f)}
          className={cx('h-10 px-4 rounded-full text-[14px] font-medium border capitalize', filtro === f ? 'bg-ink text-bg border-ink' : 'border-line text-muted')}>{f}</button>)}
      </div>

      {msg && <div role="alert" className="text-bad text-sm">{msg}</div>}
      <ErroresSync unidadId={u.id} />
      {!visibles.length && <p className="text-muted text-center py-10">No hay disparos. {puedeCrear(m.rol) ? 'Registra el primero con el botón de abajo.' : ''}</p>}

      <ul className="grid gap-2">
        {visibles.map(({ d, k }) => {
          const lab = cat.labores.find((l) => l.id === d.labor_id);
          const okFc = k.fc != null && meta ? k.fc <= meta : null;
          return <li key={d.id}>
            <button onClick={() => onOpen(d.id)} className="w-full text-left bg-surface border border-line rounded-xl px-4 py-3 flex items-center gap-3 active:bg-raise">
              <div className={cx('w-1 self-stretch rounded-full', okFc === null ? 'bg-line' : okFc ? 'bg-good' : 'bg-bad')} />
              <div className="flex-1 min-w-0 grid gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-[22px] leading-none font-semibold">N.° {d.numero_voladura}</span>
                  <Pill tone={ESTADO[d.estado].tone}>{ESTADO[d.estado].label}</Pill>
                  {d.origen !== 'medido' && <Pill>{d.origen}</Pill>}
                </div>
                <div className="text-[13px] text-muted">{lab?.codigo ?? '—'} · {d.fecha} · {d.guardia ?? '—'}</div>
              </div>
              <div className="text-right">
                <div className="num text-[19px]">{fmt(k.fc)}<span className="text-[12px] text-muted"> kg/m</span></div>
                <div className="num text-[12.5px] text-muted">{fmt(k.eficiencia)} % · {fmt(k.kg, 0)} kg</div>
              </div>
              <ChevronRight size={18} className="text-muted" />
            </button>
          </li>;
        })}
      </ul>
    </main>

    {puedeCrear(m.rol) && <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-bg via-bg/90 to-transparent">
      <Button onClick={nuevo} className="w-full max-w-3xl mx-auto flex h-14 text-[17px]"><Plus size={22} />Nuevo disparo</Button>
    </div>}
  </div>;
}

function ErroresSync({ unidadId }: { unidadId: string }) {
  const errs = useLiveQuery(() => db.outbox.filter((o) => !!o.error).toArray(), []) ?? [];
  if (!errs.length) return null;
  return <div className="rounded-xl border border-bad/50 bg-bad/10 p-3 grid gap-2" role="alert">
    <div className="font-semibold text-bad">El servidor rechazó {errs.length} cambio(s)</div>
    <ul className="grid gap-1 text-[13px]">{errs.slice(0, 5).map((e) => <li key={e.seq} className="flex justify-between gap-2">
      <span className="min-w-0 break-words">{e.tabla}: {e.error}</span>
      <button className="text-muted underline shrink-0" onClick={() => descartarError(e.seq!)}>Descartar</button></li>)}</ul>
    <Button variant="ghost" onClick={async () => { await reintentarErrores(); sincronizar(unidadId); }}>Reintentar</Button>
  </div>;
}
