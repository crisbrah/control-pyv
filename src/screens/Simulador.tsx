import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FlaskConical, Info } from 'lucide-react';
import { db } from '../lib/db';
import { kpiDisparo } from '../lib/calc';
import { baseDesde, fcEsperado, histograma, mediaPert, pertPorDefecto, simularBase, simularPert, type Pert, type TresPuntos } from '../lib/sim';
import type { Membresia } from '../lib/types';
import { useCatalogo } from '../hooks';
import { Card, Pill, SelectField, Stat, fmt } from '../ui';
import { SyncChip } from './Home';


export function Simulador({ m }: { m: Membresia }) {
  const u = m.unidad, meta = u.config?.meta_fc ?? 40, costo = u.config?.costo_kg ?? null;
  const cat = useCatalogo(u.id);
  const disparos = useLiveQuery(() => db.disparos.where('unidad_id').equals(u.id)
    .filter((d) => !d.deleted_at && d.estado === 'cerrado' && (d.origen === 'medido' || d.origen === 'importado')).toArray(), [u.id]) ?? [];
  const ids = disparos.map((d) => d.id);
  const carga = useLiveQuery(() => db.carga_zona.where('disparo_id').anyOf(ids).toArray(), [ids.join()]) ?? [];

  const [secId, setSecId] = useState<string>('');
  const sec = cat.secciones.find((s) => s.id === secId) ?? cat.secciones[0];
  const ests = cat.estandares.filter((e) => e.seccion_id === sec?.id && e.kg_disparo).sort((a, b) => b.version - a.version);
  const [estId, setEstId] = useState<string>('');
  const est = ests.find((e) => e.id === estId) ?? ests.find((e) => e.vigente) ?? ests[0];
  const kgDis = Number(est?.kg_disparo ?? 0);

  // Línea base: disparos reales cerrados de la sección, SIN estándar aplicado
  const base = useMemo(() => {
    if (!sec) return null;
    const rows = disparos.filter((d) => d.seccion_id === sec.id && !d.estandar_id).map((d) => {
      const k = kpiDisparo(d, sec, carga.filter((c) => c.disparo_id === d.id), [], cat.prodMap, null);
      return { kg: k.kg ?? 0, avance: Number(d.avance ?? 0), perf: Number(d.perforacion_efectiva ?? 0) };
    });
    return baseDesde(rows);
  }, [disparos, carga, sec, cat.prodMap]);

  const defecto = useMemo(() => (base && kgDis ? pertPorDefecto(base, kgDis) : null), [base, kgDis]);
  const [P, setP] = useState<Pert | null>(null);
  useEffect(() => { setP(defecto); }, [defecto]);
  const [nCamp, setNCamp] = useState(10);
  const rBase = useMemo(() => (base ? simularBase(base, meta) : null), [base, meta]);
  const r = useMemo(() => (P && base && kgDis ? simularPert(P, base, kgDis, meta, nCamp) : null), [P, base, kgDis, meta, nCamp]);
  const setV = (k: keyof Pert, campo: 'o' | 'm' | 'p', v: number) => P && setP({ ...P, [k]: { ...P[k], [campo]: v, fuente: P[k].fuente.includes('(editado)') ? P[k].fuente : P[k].fuente + ' (editado)' } });

  return <div className="min-h-full pb-28">
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-display text-[24px] leading-tight font-semibold flex items-center gap-2"><FlaskConical size={22} className="text-accent" />Simulador</div>
        <div className="text-[12.5px] text-muted truncate">Estimación de tres puntos (PMBOK) + Monte Carlo</div>
      </div>
      <SyncChip compact unidadId={u.id} />
    </header>

    <main className="px-4 pt-4 max-w-3xl mx-auto grid gap-4">
      <div className="rounded-lg border border-accent/60 bg-accent/10 text-accent text-[13.5px] px-3 py-2 flex gap-2"><Info size={18} className="shrink-0 mt-0.5" />
        <span><b>Simulación: valores proyectados, no medidos.</b> Nada de esta pantalla se guarda como dato de campo.</span></div>

      <Card className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <SelectField id="sec" label="Sección" value={sec?.id} onChange={(v) => { setSecId(v); setEstId(''); }} options={cat.secciones.map((s) => ({ value: s.id, label: s.nombre }))} />
          <SelectField id="est" label="Estándar a evaluar" value={est?.id} onChange={setEstId} options={ests.map((e) => ({ value: e.id, label: `${e.metodo} v${e.version} · ${e.kg_disparo} kg` }))} />
        </div>
        {base ? <div className="grid grid-cols-3 gap-2">
          <Stat label="Base real" value={fmt(base.fcMedia)} unit="kg/m" sub={`${base.n} disparos`} />
          <Stat label="Carga" value={fmt(base.kgMedia, 0)} unit="kg" sub={`CV ${fmt(base.kgCv * 100)} %`} />
          <Stat label="Avance" value={fmt(base.avMedia, 2)} unit="m" sub={`CV ${fmt(base.avCv * 100)} %`} />
        </div> : <p className="text-sm text-accent">Se necesitan al menos 3 disparos cerrados (medidos o importados, sin estándar) en esta sección para construir la línea base.</p>}
        {base && <p className="text-[12.5px] text-muted">Correlación carga–avance observada: <span className="num text-ink">{fmt(base.rho, 2)}</span>. Con {base.n} disparos es una estimación gruesa.</p>}
        {!est && <p className="text-sm text-accent">Esta sección no tiene un estándar con kg por disparo. Créalo en la pestaña Diseño.</p>}
      </Card>

      {base && est && P && r && rBase && <>
        <Card className="grid gap-3">
          <h2 className="font-display text-[22px] font-semibold">Variables inciertas</h2>
          <p className="text-[13px] text-muted">Para cada variable: valor optimista (O), más probable (M) y pesimista (P). El pesimista por defecto es que nada cambie respecto de la base real.</p>
          <TresP l="Calibración sobre el diseño" t={P.calibracion} pct onChange={(c, v) => setV('calibracion', c, v)} />
          <TresP l="Eficiencia de avance" t={P.eficiencia} pct onChange={(c, v) => setV('eficiencia', c, v)} />
          <TresP l="Variabilidad de la carga (CV)" t={P.cvCarga} pct onChange={(c, v) => setV('cvCarga', c, v)} />
          <TresP l="Variabilidad del avance (CV)" t={P.cvAvance} pct onChange={(c, v) => setV('cvAvance', c, v)} />
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="ncamp" className="text-[14px]">Disparos de la campaña de validación</label>
            <input id="ncamp" type="number" min={3} max={50} value={nCamp} onChange={(e) => setNCamp(Math.max(3, Math.min(50, Number(e.target.value) || 10)))} className="num w-20 h-11 rounded-lg bg-raise border border-line text-center text-[16px]" />
          </div>
          <button className="text-[13px] text-muted underline justify-self-start" onClick={() => setP(defecto)}>Restablecer valores por defecto</button>
        </Card>

        <Card className="grid gap-3">
          <div className="flex items-center justify-between gap-2"><h2 className="font-display text-[22px] font-semibold">FC medio de la campaña</h2><Pill tone="warn">4 000 campañas simuladas</Pill></div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Optimista P10" value={fmt(r.p10)} unit="kg/m" tone={r.p10 <= meta ? 'good' : 'bad'} />
            <Stat label="Más probable P50" value={fmt(r.p50)} unit="kg/m" tone={r.p50 <= meta ? 'good' : 'bad'} />
            <Stat label="Pesimista P90" value={fmt(r.p90)} unit="kg/m" tone={r.p90 <= meta ? 'good' : 'bad'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={`Prob. campaña ≤ ${meta}`} value={fmt(r.probMeta * 100, 0)} unit="%" tone={r.probMeta >= 0.8 ? 'good' : r.probMeta < 0.5 ? 'bad' : undefined} sub={`media de ${r.n} disparos`} />
            <Stat label={`Prob. un disparo ≤ ${meta}`} value={fmt(r.probDisparo * 100, 0)} unit="%" sub={`base ${fmt(rBase.probMeta * 100, 0)} %`} />
            <Stat label="Ahorro por 100 m (P50)" value={fmt((base.fcMedia - r.p50) * 100, 0)} unit="kg" sub={costo ? `S/ ${fmt((base.fcMedia - r.p50) * 100 * costo, 0)}` : 'costo por kg pendiente'} />
            <Stat label="Frente a la base" value={fmt((r.p50 / base.fcMedia - 1) * 100, 0)} unit="%" sub={`base ${fmt(base.fcMedia)} kg/m`} />
          </div>
          <p className="text-[12.5px] text-muted">P10, P50 y P90: en 10, 50 y 90 de cada 100 campañas simuladas el FC medio queda por debajo de ese valor. Así se expresan los escenarios optimista, más probable y pesimista.</p>
          <Histo base={rBase.fc} esc={r.disparo} meta={meta} fcBase={base.fcMedia} fcEsc={r.p50} />
          <p className="text-[12px] text-muted -mt-1">Gris: disparos con la práctica actual. Ámbar: disparos con el estándar bajo la incertidumbre definida.</p>
        </Card>

        <Card className="grid gap-3">
          <h2 className="font-display text-[22px] font-semibold">¿Qué variable pesa más?</h2>
          <p className="text-[13px] text-muted">FC esperado al mover cada variable de su valor optimista al pesimista, con la otra en su valor más probable.</p>
          <Tornado t={r.tornado} meta={meta} />
        </Card>

        <Card className="grid gap-3">
          <h2 className="font-display text-[22px] font-semibold">¿Hasta cuánto se puede calibrar?</h2>
          <p className="text-[13.5px] text-muted">FC esperado según cuánto aumente la carga de diseño en campo, para tres niveles de eficiencia.</p>
          <Sensibilidad kg={kgDis} perf={base.perfMedia} meta={meta} cal={mediaPert(P.calibracion)} ef={mediaPert(P.eficiencia)} />
        </Card>

        <Card className="grid gap-2 text-[13px] text-muted">
          <h2 className="font-display text-[20px] font-semibold text-ink">Método y referencias</h2>
          <p>• <b className="text-ink">Estimación de tres puntos</b> (PMI, PMBOK® Guide, 6.ª ed.): optimista, más probable y pesimista por variable, con distribución Beta-PERT, media (O + 4M + P) / 6.</p>
          <p>• <b className="text-ink">Monte Carlo en dos niveles:</b> por campaña se sortean los parámetros del proceso; dentro de ella, {r.n} disparos con variabilidad disparo a disparo y la correlación carga–avance observada ({fmt(base.rho, 2)}).</p>
          <p>• Monte Carlo en voladura: Morin y Ficarazzo (2006), Computers & Geosciences 32, 352–359. Guía general: US EPA (1997), Guiding Principles for Monte Carlo Analysis.</p>
          <p>• Los diseños teóricos suelen quedar por debajo de lo que la cuadrilla carga en la práctica (modelo NTNU, Rock Mech. Rock Eng., 2023). Por eso se simula la calibración.</p>
          <p className="text-ink">Fuente de cada valor por defecto:</p>
          {(Object.keys(P) as (keyof Pert)[]).map((k) => <p key={k}>– {P[k].fuente}</p>)}
        </Card>
      </>}
    </main>
  </div>;
}

function TresP({ l, t, pct, onChange }: { l: string; t: TresPuntos; pct?: boolean; onChange: (c: 'o' | 'm' | 'p', v: number) => void }) {
  const f = pct ? 100 : 1;
  return <div className="grid gap-1.5 border-t border-line pt-3">
    <div className="flex justify-between text-[14px]"><span>{l}</span><span className="num text-muted text-[12.5px]">media PERT {fmt(mediaPert(t) * f, 1)}{pct ? ' %' : ''}</span></div>
    <div className="grid grid-cols-3 gap-2">{(['o', 'm', 'p'] as const).map((c) => <label key={c} className="grid gap-0.5 min-w-0">
      <span className="text-[11.5px] text-muted">{c === 'o' ? 'Optimista' : c === 'm' ? 'Más probable' : 'Pesimista'}</span>
      <input type="number" step={0.5} inputMode="decimal" value={Math.round(t[c] * f * 10) / 10} onChange={(e) => e.target.value !== '' && onChange(c, Number(e.target.value) / f)}
        className="num w-full min-w-0 h-11 rounded-lg bg-raise border border-line text-center text-[16px]" aria-label={`${l} ${c}`} /></label>)}</div>
  </div>;
}

function Tornado({ t, meta }: { t: { variable: string; bajo: number; alto: number }[]; meta: number }) {
  const lo = Math.min(meta, ...t.map((x) => Math.min(x.bajo, x.alto))) - 2, hi = Math.max(meta, ...t.map((x) => Math.max(x.bajo, x.alto))) + 2;
  const W = 400, x = (v: number) => 10 + ((v - lo) / (hi - lo)) * (W - 20);
  return <svg viewBox={`0 0 ${W} ${t.length * 46 + 26}`} className="w-full" role="img" aria-label="Sensibilidad por variable">
    {t.map((r, i) => { const a = Math.min(r.bajo, r.alto), b = Math.max(r.bajo, r.alto), y = i * 46 + 16;
      return <g key={r.variable}><text x="10" y={y} fontSize="12" fill="var(--color-ink)">{r.variable}</text>
        <rect x={x(a)} y={y + 6} width={Math.max(2, x(b) - x(a))} height="16" rx="3" fill="var(--color-accent)" opacity=".75" />
        <text x={x(a) - 4} y={y + 18} fontSize="11" textAnchor="end" fill="var(--color-muted)" fontFamily="var(--font-mono)">{a.toFixed(1)}</text>
        <text x={x(b) + 4} y={y + 18} fontSize="11" fill="var(--color-muted)" fontFamily="var(--font-mono)">{b.toFixed(1)}</text></g>; })}
    <line x1={x(meta)} x2={x(meta)} y1="4" y2={t.length * 46 + 10} stroke="var(--color-good)" strokeDasharray="5 4" />
    <text x={x(meta)} y={t.length * 46 + 22} fontSize="11" textAnchor="middle" fill="var(--color-good)" fontFamily="var(--font-mono)">meta {meta}</text>
  </svg>;
}

function Histo({ base, esc, meta, fcBase, fcEsc }: { base: Float64Array; esc: Float64Array; meta: number; fcBase: number; fcEsc: number }) {
  const lo = 15, hi = 70, W = 400, H = 210, m = { l: 6, r: 6, t: 24, b: 26 };
  const a = histograma(base, lo, hi), b = histograma(esc, lo, hi), ymax = Math.max(...a, ...b) * 1.3;
  const x = (v: number) => m.l + ((v - lo) / (hi - lo)) * (W - m.l - m.r), y = (v: number) => H - m.b - (v / ymax) * (H - m.t - m.b);
  const path = (h: number[]) => `M${x(lo)},${y(0)}` + h.map((v, i) => `L${x(lo + i)},${y(v)}L${x(lo + i + 1)},${y(v)}`).join('') + `L${x(hi)},${y(0)}Z`;
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Distribución del FC: base ${fcBase.toFixed(1)}, escenario ${fcEsc.toFixed(1)} kg/m`}>
    {[20, 30, 40, 50, 60].map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} stroke="var(--color-line)" /><text x={x(v)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--color-muted)" fontFamily="var(--font-mono)">{v}</text></g>)}
    <path d={path(a)} fill="var(--color-muted)" fillOpacity=".2" stroke="var(--color-muted)" />
    <path d={path(b)} fill="var(--color-accent)" fillOpacity=".32" stroke="var(--color-accent)" strokeWidth="1.5" />
    <line x1={x(meta)} x2={x(meta)} y1={m.t - 6} y2={H - m.b} stroke="var(--color-good)" strokeWidth="2" strokeDasharray="5 4" />
    <text x={x(meta) + 4} y={m.t - 8} fontSize="12" fill="var(--color-good)" fontFamily="var(--font-mono)">meta {meta}</text>
    <text x={x(fcBase)} y={m.t + 8} fontSize="12" textAnchor="middle" fill="var(--color-muted)" fontFamily="var(--font-mono)">base {fcBase.toFixed(1)}</text>
    <text x={x(fcEsc)} y={m.t + 8} fontSize="12" textAnchor="middle" fill="var(--color-accent)" fontWeight="600" fontFamily="var(--font-mono)">{fcEsc.toFixed(1)}</text>
    <text x={W - m.r} y={H - 10} textAnchor="end" fontSize="11" fill="var(--color-muted)">kg/m</text>
  </svg>;
}

function Sensibilidad({ kg, perf, meta, cal, ef }: { kg: number; perf: number; meta: number; cal: number; ef: number }) {
  const W = 400, H = 230, m = { l: 28, r: 10, t: 10, b: 26 }, cmax = 0.8, fmax = 60, fmin = 20;
  const x = (c: number) => m.l + (c / cmax) * (W - m.l - m.r), y = (f: number) => H - m.b - ((Math.min(fmax, Math.max(fmin, f)) - fmin) / (fmax - fmin)) * (H - m.t - m.b);
  const efs = [{ e: 0.88, c: 'var(--color-bad)' }, { e: 0.92, c: 'var(--color-accent)' }, { e: 0.95, c: 'var(--color-good)' }];
  const cMax = (e: number) => meta * perf * e / kg - 1;
  return <div className="grid gap-2"><svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="FC esperado según calibración">
    {[20, 30, 40, 50, 60].map((f) => <g key={f}><line x1={m.l} x2={W - m.r} y1={y(f)} y2={y(f)} stroke="var(--color-line)" /><text x={m.l - 6} y={y(f) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)" fontFamily="var(--font-mono)">{f}</text></g>)}
    {[0, 0.2, 0.4, 0.6, 0.8].map((c) => <text key={c} x={x(c)} y={H - 10} textAnchor={c === 0.8 ? 'end' : c === 0 ? 'start' : 'middle'} fontSize="11" fill="var(--color-muted)" fontFamily="var(--font-mono)">+{c * 100}%</text>)}
    <line x1={m.l} x2={W - m.r} y1={y(meta)} y2={y(meta)} stroke="var(--color-good)" strokeDasharray="5 4" strokeWidth="1.5" />
    {efs.map(({ e, c }) => {
      const d = Array.from({ length: 41 }, (_, i) => i * cmax / 40).map((cc, i) => `${i ? 'L' : 'M'}${x(cc)},${y(fcEsperado(kg, cc, perf, e))}`).join('');
      const cm = cMax(e);
      return <g key={e}><path d={d} fill="none" stroke={c} strokeWidth="2" />
        {cm > 0 && cm < cmax && <circle cx={x(cm)} cy={y(meta)} r="4" fill={c} />}
        </g>;
    })}
    <circle cx={x(cal)} cy={y(fcEsperado(kg, cal, perf, ef))} r="6" fill="none" stroke="var(--color-ink)" strokeWidth="2" />
  </svg>
  <ul className="grid gap-1 text-[13px]">{efs.map(({ e, c }) => { const cm = cMax(e); return <li key={e} className="flex flex-wrap items-center gap-x-2">
    <span className="w-5 h-0.5 rounded" style={{ background: c }} />Eficiencia {Math.round(e * 100)} %:
    <span className="num">{cm <= 0 ? 'no alcanza la meta ni sin calibrar' : cm >= cmax ? `cumple hasta más de +${cmax * 100} %` : `cumple hasta +${Math.round(cm * 100)} % de calibración`}</span></li>; })}
    <li className="flex items-center gap-2 text-muted"><span className="size-3 rounded-full border-2 border-ink" />Escenario actual · línea verde punteada: meta</li></ul>
  </div>;
}
