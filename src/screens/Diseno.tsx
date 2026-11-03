import { useEffect, useMemo, useState } from 'react';
import { Grid3x3, Pause, Play, Save, TriangleAlert } from 'lucide-react';
import { guardar, uuid } from '../lib/db';
import { holmberg, recetaParaEstandar, type Entrada, type ExplosivoDiseno, type Fuente, type Param, type Resultado, type ZonaH } from '../lib/holmberg';
import { puedeDisenar, type Estandar, type Membresia, type Producto } from '../lib/types';
import { useCatalogo } from '../hooks';
import { Button, Card, Pill, SelectField, Stat, cx, fmt } from '../ui';
import { SyncChip } from './Home';

const ZN: Record<ZonaH, string> = { arranque: 'Arranque', ayudas: 'Ayudas', hastiales: 'Hastiales', corona: 'Corona', arrastres: 'Arrastres' };
const ZC: Record<ZonaH, string> = { arranque: 'var(--color-z-arranque)', ayudas: 'var(--color-z-ayudas)', hastiales: 'var(--color-z-hastiales)', corona: 'var(--color-z-corona)', arrastres: 'var(--color-z-arrastres)' };
const ZONAS: ZonaH[] = ['arranque', 'ayudas', 'hastiales', 'corona', 'arrastres'];

// Campos editables: clave, etiqueta, unidad mostrada, factor de conversión a unidades del modelo, paso
const CAMPOS: { k: keyof Entrada; l: string; u: string; f: number; step: number; grupo: string }[] = [
  { k: 'ancho', l: 'Ancho', u: 'm', f: 1, step: 0.05, grupo: 'Sección' }, { k: 'alto', l: 'Alto', u: 'm', f: 1, step: 0.05, grupo: 'Sección' },
  { k: 'flecha', l: 'Flecha del arco', u: 'm', f: 1, step: 0.05, grupo: 'Sección' },
  { k: 'd1', l: 'Diámetro de broca', u: 'mm', f: 1000, step: 1, grupo: 'Perforación' }, { k: 'H', l: 'Perforación efectiva', u: 'm', f: 1, step: 0.01, grupo: 'Perforación' },
  { k: 'nRim', l: 'N.° de rimados', u: '', f: 1, step: 1, grupo: 'Perforación' }, { k: 'dRim', l: 'Diámetro de rimado', u: 'mm', f: 1000, step: 1, grupo: 'Perforación' },
  { k: 'alfa', l: 'Desviación angular', u: 'm/m', f: 1, step: 0.001, grupo: 'Perforación' }, { k: 'e', l: 'Error de emboquille', u: 'm', f: 1, step: 0.005, grupo: 'Perforación' },
  { k: 'gamma', l: 'Ángulo de realce', u: '°', f: 1, step: 0.5, grupo: 'Perforación' }, { k: 'yArranque', l: 'Altura del arranque', u: 'm', f: 1, step: 0.05, grupo: 'Perforación' },
  { k: 'c', l: 'Constante de roca c', u: 'kg/m³', f: 1, step: 0.01, grupo: 'Roca y carga' }, { k: 'K', l: 'K del contorno (S = K·d₁)', u: '', f: 1, step: 0.5, grupo: 'Roca y carga' },
  { k: 'dAtacado', l: 'Diámetro efectivo atacado', u: 'mm', f: 1000, step: 1, grupo: 'Roca y carga' },
];

const exp = (p: Producto | undefined): ExplosivoDiseno | null => p && p.kg_unidad
  ? { id: p.id, nombre: p.nombre.replace(/Emulnor /, 'E'), kg: Number(p.kg_unidad), densidad: Number(p.densidad ?? 1.15), sanfo: Number(p.potencia_rel_anfo ?? 1), largo: Number(p.largo_mm ?? 304.8) / 1000 } : null;

/** Lee los parámetros guardados en un estándar (formato de la app o del SQL inicial) */
function desdeEstandar(base: Entrada, est: Estandar | undefined): Entrada {
  const p = (est?.parametros ?? {}) as Record<string, Param>;
  const e: Entrada = { ...base };
  for (const k of Object.keys(base) as (keyof Entrada)[]) if (p[k] && typeof (p[k] as Param).valor === 'number') (e[k] as Param) = p[k];
  const map: [string, keyof Entrada, number][] = [['broca_mm', 'd1', 0.001], ['rimado_mm', 'dRim', 0.001], ['rimados_n', 'nRim', 1], ['emboquille', 'e', 1], ['gamma_grados', 'gamma', 1], ['K_contorno', 'K', 1]];
  for (const [a, b, f] of map) if (p[a]) (e[b] as Param) = { valor: Number(p[a].valor) * f, fuente: p[a].fuente };
  return e;
}

export function Diseno({ m }: { m: Membresia }) {
  const u = m.unidad, cat = useCatalogo(u.id), editor = puedeDisenar(m.rol);
  const [secId, setSecId] = useState('');
  const sec = cat.secciones.find((s) => s.id === secId) ?? cat.secciones[0];
  const ests = cat.estandares.filter((e) => e.seccion_id === sec?.id).sort((a, b) => b.version - a.version);
  const [estId, setEstId] = useState('');
  const est = ests.find((e) => e.id === estId) ?? ests.find((e) => e.vigente) ?? ests[0];
  const emul = cat.productos.filter((p) => p.kg_unidad != null && p.activo);
  const byName = (re: RegExp) => emul.find((p) => re.test(p.nombre));
  const e5 = byName(/5000 1¼/) ?? emul[0], e1 = byName(/1000 1¼/) ?? emul[0];

  const inicial = useMemo((): Entrada | null => {
    const a = exp(e5), b = exp(e1);
    if (!sec || !a || !b) return null;
    const P = (valor: number, fuente: Fuente = 'supuesto'): Param => ({ valor, fuente });
    const base: Entrada = {
      ancho: P(Number(sec.ancho), 'dato'), alto: P(Number(sec.alto), 'dato'), flecha: P(Number(sec.flecha ?? 0.5)),
      d1: P(0.045), dRim: P(0.102), nRim: P(4), H: P(4.06), alfa: P(0.01), e: P(0.02), gamma: P(3), c: P(0.4), K: P(15),
      dAtacado: P(0.038), yArranque: P(1.4), arranque: a, fondo: a, columna: b,
    };
    return desdeEstandar(base, est);
  }, [sec?.id, est?.id, e5?.id, e1?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [E, setE] = useState<Entrada | null>(null);
  useEffect(() => { setE(inicial); }, [inicial]);
  const calc = useMemo(() => { try { return { r: E ? holmberg(E) : null, err: null }; } catch (x) { return { r: null, err: (x as Error).message }; } }, [E]);
  const r = calc.r, errCalc = calc.err;
  const faltan = [!cat.secciones.length && 'no hay secciones registradas en la unidad', !emul.length && 'no hay explosivos con kg por cartucho en el catálogo',
    cat.secciones.length > 0 && emul.length > 0 && !cat.productos.length && 'el catálogo no se ha descargado (sincroniza con señal)', errCalc && `error de cálculo: ${errCalc}`].filter(Boolean) as string[];
  const [msg, setMsg] = useState<string | null>(null);

  async function guardarEstandar(vigente: boolean) {
    if (!E || !r || !sec) return;
    const params: Record<string, Param> = {};
    for (const c of CAMPOS) params[c.k] = E[c.k] as Param;
    const nuevo: Estandar = {
      id: uuid(), unidad_id: u.id, seccion_id: sec.id, version: Math.max(0, ...ests.map((x) => x.version)) + 1, metodo: 'Holmberg',
      parametros: { ...params, explosivos: { arranque: E.arranque.id, fondo: E.fondo.id, columna: E.columna.id } } as Record<string, unknown>,
      receta: recetaParaEstandar(E, r), kg_disparo: Math.round(r.kgTotal * 100) / 100, avance_esperado: Math.round(r.avance * 100) / 100, vigente,
    };
    if (vigente) for (const x of ests.filter((x) => x.vigente)) await guardar('estandares', { ...x, vigente: false });
    await guardar('estandares', nuevo);
    setEstId(nuevo.id);
    setMsg(`Guardado como Holmberg v${nuevo.version}${vigente ? ' (vigente)' : ' (propuesto)'}. Se sincroniza con el servidor.`);
  }

  return <div className="min-h-full pb-28">
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-display text-[24px] leading-tight font-semibold flex items-center gap-2"><Grid3x3 size={22} className="text-accent" />Diseño de malla</div>
        <div className="text-[12.5px] text-muted truncate">Modelo de Holmberg · López Jimeno et al. (1995)</div>
      </div>
      <SyncChip compact unidadId={u.id} />
    </header>

    <main className="px-4 pt-4 max-w-3xl mx-auto grid gap-4">
      <Card className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <SelectField id="dsec" label="Sección" value={sec?.id} onChange={(v) => { setSecId(v); setEstId(''); }} options={cat.secciones.map((s) => ({ value: s.id, label: s.nombre }))} />
          <SelectField id="dest" label="Partir de" value={est?.id} onChange={setEstId} options={ests.map((e) => ({ value: e.id, label: `v${e.version}${e.vigente ? ' vigente' : ''} · ${e.kg_disparo ?? '—'} kg` }))} />
        </div>
        {!editor && <p className="text-[13px] text-muted">Puedes explorar el diseño; solo ingeniería puede guardarlo como estándar.</p>}
      </Card>

      {!E || !r ? <Card className="grid gap-2"><p className="font-semibold">No se puede dibujar la malla todavía</p>
        {faltan.length ? faltan.map((f) => <p key={f} className="text-bad text-[14px]">• {f[0].toUpperCase() + f.slice(1)}.</p>) : <p className="text-muted text-[14px]">Cargando catálogo…</p>}
        <p className="text-[12.5px] text-muted">Secciones: {cat.secciones.length} · productos: {cat.productos.length} · explosivos con kg: {emul.length} · estándares: {cat.estandares.length}</p>
      </Card> : <>
        <Card className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Taladros" value={String(r.nTaladros)} sub={`+ ${r.rimados.length} rimados`} />
            <Stat label="Explosivo" value={fmt(r.kgTotal)} unit="kg" sub={`${r.cartuchos} cartuchos`} />
            <Stat label="Avance esp." value={fmt(r.avance, 2)} unit="m" sub={`L arrancable ${fmt(r.L, 2)} m`} />
            <Stat label="FC teórico" value={fmt(r.fcLineal)} unit="kg/m" />
            <Stat label="FC vol." value={fmt(r.fcVol, 2)} unit="kg/m³" />
            <Stat label="Máx./retardo" value={fmt(r.qopMax.kg, 2)} unit="kg" sub={`LP ${r.qopMax.lp}`} />
          </div>
          {r.avisos.map((a, i) => <p key={i} className="text-bad text-[13.5px] flex gap-2"><TriangleAlert size={18} className="shrink-0" />{a}</p>)}
          <p className="text-[12.5px] text-muted">El FC teórico es el mínimo que el modelo considera necesario. En campo suele requerir calibración: evalúalo en el Simulador antes de fijar una meta.</p>
        </Card>

        <Malla r={r} E={E} />

        <Card className="grid gap-3">
          <h2 className="font-display text-[22px] font-semibold">Receta por zona</h2>
          <div className="overflow-x-auto"><table className="w-full text-[13.5px]">
            <thead><tr className="text-muted text-[11.5px] uppercase"><th className="text-left py-2 font-medium">Zona</th><th className="text-right font-medium">Tal.</th><th className="text-left pl-3 font-medium">Por taladro</th><th className="text-right font-medium">kg</th></tr></thead>
            <tbody>{ZONAS.map((z) => <tr key={z} className="border-t border-line align-top">
              <td className="py-2 whitespace-nowrap"><span className="inline-block size-2.5 rounded-full mr-1.5" style={{ background: ZC[z] }} />{ZN[z]}</td>
              <td className="text-right num">{r.receta[z].taladros}</td><td className="pl-3">{r.receta[z].nota}</td><td className="text-right num">{fmt(r.receta[z].kgZona)}</td></tr>)}
              <tr className="border-t border-line font-semibold"><td className="py-2">Total</td><td className="text-right num">{r.nTaladros}</td><td className="pl-3">Taco de arcilla {fmt(r.taco, 2)} m en todos</td><td className="text-right num">{fmt(r.kgTotal)}</td></tr>
            </tbody></table></div>
        </Card>

        <Card className="grid gap-4">
          <h2 className="font-display text-[22px] font-semibold">Parámetros</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['arranque', 'fondo', 'columna'] as const).map((k) => <SelectField key={k} id={`x-${k}`} label={k === 'arranque' ? 'Arranque' : k === 'fondo' ? 'Fondo (atacado)' : 'Columna'} value={E[k].id} disabled={!editor}
              onChange={(v) => { const x = exp(emul.find((p) => p.id === v)); if (x) setE({ ...E, [k]: x }); }} options={emul.map((p) => ({ value: p.id, label: p.nombre }))} />)}
          </div>
          {['Sección', 'Perforación', 'Roca y carga'].map((g) => <div key={g} className="grid gap-2">
            <div className="text-[12px] uppercase tracking-wide text-muted">{g}</div>
            {CAMPOS.filter((c) => c.grupo === g).map((c) => { const p = E[c.k] as Param; return <div key={c.k} className="flex items-center gap-2">
              <label htmlFor={`p-${c.k}`} className="flex-1 text-[14px]">{c.l}</label>
              <div className="flex items-center rounded-lg bg-raise border border-line w-32">
                <input id={`p-${c.k}`} type="number" inputMode="decimal" step={c.step} disabled={!editor}
                  className="num w-full bg-transparent px-2 h-11 text-[16px] outline-none text-right"
                  value={Math.round(p.valor * c.f * 10000) / 10000}
                  onChange={(ev) => ev.target.value !== '' && setE({ ...E, [c.k]: { ...p, valor: Number(ev.target.value) / c.f } })} />
                <span className="pr-2 text-muted text-[12px] min-w-6">{c.u}</span>
              </div>
              <button disabled={!editor} onClick={() => setE({ ...E, [c.k]: { ...p, fuente: p.fuente === 'dato' ? 'supuesto' : 'dato' } })}
                className={cx('w-[78px] h-9 rounded-full text-[12px] font-semibold border', p.fuente === 'dato' ? 'border-good/50 text-good' : 'border-accent/60 text-accent')}
                aria-label={`Fuente de ${c.l}: ${p.fuente}`}>{p.fuente}</button>
            </div>; })}
          </div>)}
          <p className="text-[12.5px] text-muted">Marca como <b className="text-good">dato</b> lo medido o confirmado por la unidad y como <b className="text-accent">supuesto</b> lo asumido. Se guarda con el estándar.</p>
        </Card>

        <Card className="grid gap-3">
          <h2 className="font-display text-[22px] font-semibold">Detalle del cálculo</h2>
          <div className="text-[13px] num grid gap-1 text-muted">
            <div>D₂ = {fmt(r.D2, 3)} m · F = {fmt(r.F, 4)} m · L = {fmt(r.L, 2)} m</div>
            <div>q arranque {fmt(r.qArranque, 3)} · q fondo atacado {fmt(r.qFondo, 3)} · q columna {fmt(r.qColumna, 3)} kg/m · q₁ mín {fmt(r.q1Min, 3)} kg/m</div>
            <div>Arranque Bp: {r.secciones.map((s) => fmt(s.Bp, 3)).join(' / ')} m · Ah: {r.secciones.map((s) => fmt(s.Ah, 3)).join(' / ')} m</div>
            <div>Arrastres B {fmt(r.arrastres.B, 3)} · Bp {fmt(r.arrastres.Bp, 3)} · S {fmt(r.arrastres.S, 3)} m · Ayudas B {fmt(r.ayudas.B, 3)} · Bp {fmt(r.ayudas.Bp, 3)} m</div>
            <div>Contorno S {fmt(r.contorno.S, 3)} · B {fmt(r.contorno.B, 3)} · Bp {fmt(r.contorno.Bp, 3)} m · q mín {fmt(r.contorno.qMin, 3)} kg/m</div>
          </div>
        </Card>

        {editor && <Card className="grid gap-3">
          {msg && <p className="text-good text-sm">{msg}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => guardarEstandar(false)}><Save size={18} />Guardar propuesto</Button>
            <Button onClick={() => guardarEstandar(true)}><Save size={18} />Guardar vigente</Button>
          </div>
          <p className="text-[12.5px] text-muted">"Vigente" es el estándar que se asigna por defecto a los disparos nuevos de esta sección y contra el que se compara la carga real.</p>
        </Card>}
      </>}
    </main>
  </div>;
}

function Forma({ z, x, y, s, fill, stroke }: { z: ZonaH; x: number; y: number; s: number; fill: string; stroke: string }) {
  const p = { fill, stroke, strokeWidth: 1.5 };
  if (z === 'arranque') return <circle cx={x} cy={y} r={s} {...p} />;
  if (z === 'ayudas') return <rect x={x - s} y={y - s} width={2 * s} height={2 * s} {...p} />;
  if (z === 'hastiales') return <path d={`M${x},${y - s * 1.3}L${x + s * 1.3},${y}L${x},${y + s * 1.3}L${x - s * 1.3},${y}Z`} {...p} />;
  if (z === 'corona') return <path d={`M${x},${y - s * 1.3}L${x + s * 1.2},${y + s}L${x - s * 1.2},${y + s}Z`} {...p} />;
  return <path d={`M${x},${y + s * 1.3}L${x + s * 1.2},${y - s}L${x - s * 1.2},${y - s}Z`} {...p} />;
}

function Malla({ r, E }: { r: Resultado; E: Entrada }) {
  const ancho = E.ancho.valor, alto = E.alto.valor, f = E.flecha.valor, { R, th, hWall } = r.geom;
  const pad = 0.45, sc = 100, W = (ancho + 2 * pad) * sc, Hh = (alto + 2 * pad) * sc;
  const X = (x: number) => (x + ancho / 2 + pad) * sc, Y = (y: number) => (alto + pad - y) * sc;
  const cy = hWall - (R - f);
  const arc = Array.from({ length: 41 }, (_, i) => { const a = th - (2 * th * i) / 40; return `${X(R * Math.sin(a))},${Y(cy + R * Math.cos(a))}`; }).join(' L');
  const contorno = `M${X(-ancho / 2)},${Y(0)} L${X(ancho / 2)},${Y(0)} L${X(ancho / 2)},${Y(hWall)} L${arc} Z`;
  const [lp, setLp] = useState<number | null>(null);
  const [play, setPlay] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setLp((x) => { const n = (x ?? 0) + 1; if (n > 16) { setPlay(false); return null; } return n; }), 700);
    return () => clearInterval(t);
  }, [play]);
  const t = sel != null ? r.taladros[sel] : null;
  const lps = Array.from(new Set(r.taladros.map((x) => x.lp))).sort((a, b) => a - b);
  return <Card className="grid gap-3">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-display text-[22px] font-semibold">Malla y secuencia</h2>
      <Button variant="ghost" className="min-h-10" onClick={() => { if (play) { setPlay(false); setLp(null); } else { setLp(1); setPlay(true); } }}>
        {play ? <><Pause size={16} />Detener</> : <><Play size={16} />Secuencia</>}</Button>
    </div>
    <div className="rounded-lg bg-bg border border-line">
      <svg viewBox={`0 0 ${W} ${Hh}`} className="w-full max-h-[520px]" role="img" aria-label={`Malla de ${r.nTaladros} taladros`}>
        <path d={contorno} fill="none" stroke="var(--color-muted)" strokeWidth="2" />
        <line x1={X(-ancho / 2)} x2={X(ancho / 2)} y1={Y(-0.25)} y2={Y(-0.25)} stroke="var(--color-line)" />
        <text x={X(0)} y={Y(-0.25) + 16} textAnchor="middle" fontSize="14" fill="var(--color-muted)" fontFamily="var(--font-mono)">{ancho.toFixed(2)} m</text>
        <text x={X(ancho / 2) + 14} y={Y(alto / 2)} fontSize="14" fill="var(--color-muted)" fontFamily="var(--font-mono)" transform={`rotate(90 ${X(ancho / 2) + 14} ${Y(alto / 2)})`} textAnchor="middle">{alto.toFixed(2)} m</text>
        {r.rimados.map((h, i) => <circle key={i} cx={X(h.x)} cy={Y(h.y)} r={E.dRim.valor / 2 * sc} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />)}
        {r.taladros.map((h, i) => {
          const on = lp === h.lp, fired = lp != null && h.lp < lp;
          return <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }} opacity={lp == null ? 1 : on ? 1 : fired ? 0.25 : 0.55}>
            {on && <circle cx={X(h.x)} cy={Y(h.y)} r="22" fill={ZC[h.zona]} opacity=".25" />}
            <Forma z={h.zona} x={X(h.x)} y={Y(h.y)} s={on ? 9 : 7} fill={ZC[h.zona]} stroke={sel === i ? 'var(--color-ink)' : 'var(--color-bg)'} />
            <text x={X(h.x) + 10} y={Y(h.y) - 8} fontSize="12" fill="var(--color-ink)" fontFamily="var(--font-mono)">{h.lp}</text>
          </g>;
        })}
      </svg>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
      {ZONAS.map((z) => <span key={z} className="inline-flex items-center gap-1.5"><svg width="16" height="16"><Forma z={z} x={8} y={8} s={5} fill={ZC[z]} stroke="none" /></svg>{ZN[z]}</span>)}
      <span className="inline-flex items-center gap-1.5"><svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="none" stroke="var(--color-ink)" /></svg>Rimado</span>
      <span>Número = retardo Fanel LP</span>
    </div>
    {lp != null && <div className="text-[14px]"><Pill tone="accent">LP {lp}</Pill> <span className="num">{fmt(r.qop[lp] ?? 0, 2)} kg</span> · {r.taladros.filter((x) => x.lp === lp).length} taladros</div>}
    {t && lp == null && <div className="text-[14px] grid gap-0.5 border border-line rounded-lg px-3 py-2">
      <div><b style={{ color: ZC[t.zona] }}>{ZN[t.zona]}</b> · LP {t.lp} · x {fmt(t.x, 2)} m, y {fmt(t.y, 2)} m</div>
      <div className="text-muted">{r.receta[t.zona].nota} · <span className="num">{fmt(r.receta[t.zona].kgTaladro, 2)} kg</span></div>
    </div>}
    <svg viewBox="0 0 400 120" className="w-full" role="img" aria-label="Carga por retardo">
      {lps.map((k, i) => { const w = 380 / lps.length, hb = (r.qop[k] / Math.max(r.qopMax.kg, 1)) * 80, z = r.taladros.find((x) => x.lp === k)!.zona;
        return <g key={k}><rect x={10 + i * w + 2} y={95 - hb} width={w - 4} height={hb} rx="2" fill={ZC[z]} opacity={lp == null || lp === k ? 0.9 : 0.3} />
          <text x={10 + (i + 0.5) * w} y={110} textAnchor="middle" fontSize="10" fill="var(--color-muted)" fontFamily="var(--font-mono)">{k}</text></g>; })}
      <text x="10" y="10" fontSize="10" fill="var(--color-muted)">kg por retardo (máx. {fmt(r.qopMax.kg, 2)} kg)</text>
    </svg>
  </Card>;
}
