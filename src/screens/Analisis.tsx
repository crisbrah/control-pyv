import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, BarChart3, CheckCircle2, FileDown, Info, TriangleAlert } from 'lucide-react';
import { db } from '../lib/db';
import { analizar, type Analisis as A, type Fila } from '../lib/analisis';
import { baseDe, filasDe } from '../lib/filas';
import { guardarPdf, reporteAnalisis } from '../lib/pdf';
import { ZONA_NOMBRE, type Membresia } from '../lib/types';
import { useCatalogo } from '../hooks';
import { Button, Card, Stat, cx, fmt } from '../ui';

export function Analisis({ m, ids, onBack }: { m: Membresia; ids: string[]; onBack: () => void }) {
  const u = m.unidad, meta = u.config?.meta_fc ?? 40, tol = u.config?.tolerancia_carga ?? 5;
  const cat = useCatalogo(u.id);
  const todos = useLiveQuery(() => db.disparos.where('unidad_id').equals(u.id).filter((d) => !d.deleted_at).toArray(), [u.id]);
  const [filas, setFilas] = useState<{ sel: Fila[]; base: Fila[] } | null>(null);

  useEffect(() => {
    if (!todos || !cat.secciones.length) return;
    const sel = todos.filter((d) => ids.includes(d.id)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero_voladura.localeCompare(b.numero_voladura, 'es', { numeric: true }));
    const secPrincipal = sel[0]?.seccion_id;
    const base = secPrincipal ? baseDe(todos, secPrincipal, new Set(ids)) : [];
    Promise.all([filasDe(sel, cat.secciones, cat.estandares, cat.prodMap), filasDe(base, cat.secciones, cat.estandares, cat.prodMap)])
      .then(([s, b]) => setFilas({ sel: s, base: b }));
  }, [todos, ids.join(), cat.secciones, cat.estandares, cat.prodMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const an = useMemo(() => (filas ? analizar(filas.sel, filas.base, meta, tol) : null), [filas, meta, tol]);
  const sec = cat.secciones.find((s) => s.id === filas?.sel[0]?.seccion_id);
  const labores = new Map(cat.labores.map((l) => [l.id, l.codigo]));

  return <div className="min-h-full pb-28">
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line px-3 py-2.5 flex items-center gap-2">
      <button onClick={onBack} aria-label="Volver" className="size-11 grid place-items-center rounded-lg border border-line"><ArrowLeft size={20} /></button>
      <div className="flex-1 min-w-0">
        <div className="font-display text-[24px] leading-tight font-semibold flex items-center gap-2"><BarChart3 size={20} className="text-accent" />Análisis de {ids.length} voladuras</div>
        <div className="text-[12.5px] text-muted truncate">{sec?.nombre ?? ''} · meta ≤ {meta} kg/m</div>
      </div>
    </header>
    {!an ? <p className="p-6 text-muted">Calculando…</p> : <main className="px-4 pt-4 max-w-3xl mx-auto grid gap-4">
      <Card className="grid gap-2">
        <h2 className="font-display text-[22px] font-semibold">Conclusiones</h2>
        {an.conclusiones.map((c, i) => <p key={i} className={cx('flex gap-2 text-[14px]', c.tono === 'bien' ? 'text-good' : c.tono === 'mal' ? 'text-bad' : 'text-ink')}>
          {c.tono === 'bien' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : c.tono === 'mal' ? <TriangleAlert size={18} className="shrink-0 mt-0.5" /> : <Info size={18} className="shrink-0 mt-0.5 text-muted" />}{c.texto}</p>)}
      </Card>

      <Card className="grid gap-3">
        <h2 className="font-display text-[22px] font-semibold">Resumen</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="FC medio" value={fmt(an.s.fc?.media)} unit="kg/m" tone={an.s.fc ? (an.s.fc.media <= meta ? 'good' : 'bad') : undefined} sub={an.b.fc ? `base ${fmt(an.b.fc.media)} · ${an.delta.fc! > 0 ? '+' : ''}${fmt(an.delta.fc)} %` : undefined} />
          <Stat label="Eficiencia" value={fmt(an.s.ef?.media)} unit="%" sub={an.b.ef ? `base ${fmt(an.b.ef.media)} %` : undefined} />
          <Stat label="Explosivo" value={fmt(an.s.kg?.media)} unit="kg" sub={`CV ${fmt(an.s.kg?.cv)} %${an.b.kg ? ` · base ${fmt(an.b.kg.cv)} %` : ''}`} />
          <Stat label="Avance" value={fmt(an.s.av?.media, 2)} unit="m" sub={`CV ${fmt(an.s.av?.cv)} %`} />
          <Stat label="Desv. vs estándar" value={an.s.desv ? `${an.s.desv.media > 0 ? '+' : ''}${fmt(an.s.desv.media)}` : '—'} unit="%" tone={an.s.desv ? (Math.abs(an.s.desv.media) <= tol ? 'good' : 'bad') : undefined} />
          <Stat label="Mann-Whitney" value={an.mw ? `p ${an.mw.p.toFixed(3)}` : '—'} sub={an.mw ? (an.mw.p < 0.05 ? 'diferencia significativa' : 'no significativa') : 'sin base'} />
        </div>
      </Card>

      <Card className="grid gap-2">
        <h2 className="font-display text-[22px] font-semibold">FC por voladura</h2>
        <Control an={an} meta={meta} />
        <p className="text-[12px] text-muted">Límites de control I-MR {an.base.length >= 3 ? `de la línea base (${an.base.length} disparos)` : 'de la selección'}. En rojo, disparos fuera de límites.</p>
      </Card>

      <Card className="grid gap-2">
        <h2 className="font-display text-[22px] font-semibold">Carga frente a avance</h2>
        <Dispersion an={an} meta={meta} />
        <p className="text-[12px] text-muted">Las líneas indican FC constante. Ámbar: selección; gris: línea base.</p>
      </Card>

      <Card className="grid gap-2">
        <h2 className="font-display text-[22px] font-semibold">Detalle</h2>
        <div className="overflow-x-auto"><table className="w-full text-[13px] num whitespace-nowrap">
          <thead><tr className="text-muted text-[11px] uppercase">{['N.°', 'Fecha', 'kg', 'Avance', 'FC', 'Efic.', 'Desv.', 'Taco', 'Concil.'].map((h) => <th key={h} className="text-right first:text-left py-2 px-1 font-medium">{h}</th>)}</tr></thead>
          <tbody>{an.sel.map((x) => <tr key={x.id} className="border-t border-line">
            <td className="py-2 px-1">{x.numero}</td><td className="text-right px-1">{x.fecha.slice(5)}</td><td className="text-right px-1">{fmt(x.kg)}</td><td className="text-right px-1">{fmt(x.avance, 2)}</td>
            <td className={cx('text-right px-1', x.fc != null && (x.fc <= meta ? 'text-good' : 'text-bad'))}>{fmt(x.fc)}</td><td className="text-right px-1">{fmt(x.eficiencia)}</td>
            <td className={cx('text-right px-1', x.desv != null && Math.abs(x.desv) > tol && 'text-bad')}>{x.desv == null ? '—' : fmt(x.desv)}</td><td className="text-right px-1">{fmt(x.pctTaco, 0)}</td>
            <td className={cx('text-right px-1', x.sinConciliar != null && Math.abs(x.sinConciliar) > 0.5 && 'text-bad')}>{fmt(x.sinConciliar, 1)}</td></tr>)}</tbody></table></div>
        {an.zonas.length > 0 && <div className="grid gap-1 pt-2"><div className="text-[13px] text-muted">Desviación media por zona frente a la receta</div>
          {an.zonas.map((z) => <div key={z.zona} className="flex justify-between text-[14px]"><span>{ZONA_NOMBRE[z.zona as keyof typeof ZONA_NOMBRE] ?? z.zona}</span>
            <span className={cx('num', Math.abs(z.media) > tol ? 'text-bad' : 'text-good')}>{z.media > 0 ? '+' : ''}{fmt(z.media)} %</span></div>)}</div>}
      </Card>

      <Button className="h-14 text-[17px]" onClick={() => guardarPdf(reporteAnalisis({ unidad: u.nombre, seccion: sec?.nombre ?? '', meta, tol, A: an, labores }), `analisis-${an.sel.map((x) => x.numero).join('-')}.pdf`)}>
        <FileDown size={20} />Descargar análisis en PDF</Button>
    </main>}
  </div>;
}

function Control({ an, meta }: { an: A; meta: number }) {
  const pts = an.sel.filter((x) => x.fc != null), W = 400, H = 210, m = { l: 30, r: 62, t: 10, b: 26 };
  const vals = [...pts.map((p) => p.fc!), ...an.base.map((b) => b.fc ?? meta), meta, ...(an.control ? [an.control.lcs, an.control.lci] : [])];
  const lo = Math.floor(Math.min(...vals) - 2), hi = Math.ceil(Math.max(...vals) + 2);
  const y = (v: number) => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b), x = (i: number) => m.l + (pts.length === 1 ? (W - m.l - m.r) / 2 : (i / (pts.length - 1)) * (W - m.l - m.r));
  const H_ = ({ v, c, l }: { v: number; c: string; l: string }) => <g><line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={c} strokeDasharray="5 4" /><text x={W - m.r + 3} y={y(v) + 4} fontSize="10" fill={c} fontFamily="var(--font-mono)">{l} {v.toFixed(1)}</text></g>;
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="FC por voladura con límites de control">
    {Array.from({ length: Math.floor((hi - lo) / 5) + 1 }, (_, i) => Math.ceil(lo / 5) * 5 + i * 5).filter((v) => v <= hi).map((v) => <g key={v}><line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" /><text x={m.l - 4} y={y(v) + 4} fontSize="10" textAnchor="end" fill="var(--color-muted)" fontFamily="var(--font-mono)">{v}</text></g>)}
    <H_ v={meta} c="var(--color-good)" l="meta" />
    {an.control && <><H_ v={an.control.lcs} c="var(--color-bad)" l="LCS" /><H_ v={an.control.lci} c="var(--color-bad)" l="LCI" /><H_ v={an.control.media} c="var(--color-muted)" l={an.base.length >= 3 ? 'base' : 'media'} /></>}
    <polyline points={pts.map((p, i) => `${x(i)},${y(p.fc!)}`).join(' ')} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
    {pts.map((p, i) => <g key={p.id}><circle cx={x(i)} cy={y(p.fc!)} r="4.5" fill={an.fuera.includes(p.numero) ? 'var(--color-bad)' : 'var(--color-accent)'} />
      <text x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--color-muted)" fontFamily="var(--font-mono)">{p.numero}</text></g>)}
  </svg>;
}

function Dispersion({ an, meta }: { an: A; meta: number }) {
  const all = [...an.sel, ...an.base].filter((x) => x.kg != null && x.avance != null);
  if (!all.length) return <p className="text-muted text-sm">Sin datos de carga y avance.</p>;
  const W = 400, H = 230, m = { l: 34, r: 12, t: 10, b: 28 };
  const ax = [Math.min(...all.map((p) => p.avance!)) - 0.2, Math.max(...all.map((p) => p.avance!)) + 0.2], ak = [Math.min(...all.map((p) => p.kg!)) * 0.9, Math.max(...all.map((p) => p.kg!)) * 1.05];
  const x = (v: number) => m.l + ((v - ax[0]) / (ax[1] - ax[0])) * (W - m.l - m.r), y = (v: number) => H - m.b - ((v - ak[0]) / (ak[1] - ak[0])) * (H - m.t - m.b);
  const iso = [meta, ...(an.b.fc ? [Math.round(an.b.fc.media * 10) / 10] : [])];
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Carga frente a avance">
    <clipPath id="clipD"><rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} /></clipPath>
    <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="none" stroke="var(--color-line)" />
    <g clipPath="url(#clipD)">{iso.map((f, i) => <g key={f}><line x1={x(ax[0])} y1={y(f * ax[0])} x2={x(ax[1])} y2={y(f * ax[1])} stroke={i === 0 ? 'var(--color-good)' : 'var(--color-muted)'} strokeDasharray="5 4" />
      <text x={x(ax[1]) - 4} y={y(f * ax[1]) + 12} fontSize="10" textAnchor="end" fill={i === 0 ? 'var(--color-good)' : 'var(--color-muted)'} fontFamily="var(--font-mono)">{f} kg/m</text></g>)}</g>
    {an.base.filter((p) => p.kg != null && p.avance != null).map((p) => <circle key={p.id} cx={x(p.avance!)} cy={y(p.kg!)} r="4" fill="var(--color-muted)" opacity=".55" />)}
    {an.sel.filter((p) => p.kg != null && p.avance != null).map((p) => <g key={p.id}><circle cx={x(p.avance!)} cy={y(p.kg!)} r="5" fill="var(--color-accent)" /><text x={x(p.avance!) + 7} y={y(p.kg!) + 4} fontSize="10" fill="var(--color-ink)" fontFamily="var(--font-mono)">{p.numero}</text></g>)}
    <text x={W / 2} y={H - 6} fontSize="10" textAnchor="middle" fill="var(--color-muted)">Avance (m)</text>
    <text x={10} y={H / 2} fontSize="10" textAnchor="middle" fill="var(--color-muted)" transform={`rotate(-90 10 ${H / 2})`}>Explosivo (kg)</text>
    {[ax[0], (ax[0] + ax[1]) / 2, ax[1]].map((v) => <text key={v} x={x(v)} y={H - m.b + 12} fontSize="10" textAnchor="middle" fill="var(--color-muted)" fontFamily="var(--font-mono)">{v.toFixed(1)}</text>)}
    {[ak[0], (ak[0] + ak[1]) / 2, ak[1]].map((v) => <text key={v} x={m.l - 4} y={y(v) + 4} fontSize="10" textAnchor="end" fill="var(--color-muted)" fontFamily="var(--font-mono)">{v.toFixed(0)}</text>)}
  </svg>;
}
