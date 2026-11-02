import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { db, guardar, uuid } from '../lib/db';
import { alertas, clasificar, desviacion, disenoPorZona, estadoSugerido, kgDe, kpiDisparo } from '../lib/calc';
import { ZONAS, ZONA_NOMBRE, puedeCerrar, puedeEditar, type CargaZona, type Disparo as D, type Membresia, type Movimiento, type Respuesta, type Zona } from '../lib/types';
import { useCatalogo, type Catalogo } from '../hooks';
import { Button, Card, Chips, Counter, Label, NumField, Pill, SelectField, SiNo, Stat, TextField, cx, fmt } from '../ui';
import { ESTADO, SyncChip } from './Home';

const PASOS = ['Datos', 'Macizo', 'Perforación', 'Vale', 'Carguío', 'Resultado', 'Checklist', 'Cierre'] as const;
const ZCOLOR: Record<string, string> = { arranque: 'bg-z-arranque', ayudas: 'bg-z-ayudas', hastiales: 'bg-z-hastiales', corona: 'bg-z-corona', arrastres: 'bg-z-arrastres', sin_zona: 'bg-muted' };

export function Disparo({ id, m, onBack }: { id: string; m: Membresia; onBack: () => void }) {
  const u = m.unidad;
  const cat = useCatalogo(u.id);
  const d = useLiveQuery(() => db.disparos.get(id), [id]);
  const carga = useLiveQuery(() => db.carga_zona.where('disparo_id').equals(id).toArray(), [id]) ?? [];
  const movs = useLiveQuery(() => db.movimientos_explosivo.where('disparo_id').equals(id).toArray(), [id]) ?? [];
  const resp = useLiveQuery(() => db.checklist_respuestas.where('disparo_id').equals(id).toArray(), [id]) ?? [];
  const [paso, setPaso] = useState(0);

  const est = cat.estandares.find((e) => e.id === d?.estandar_id);
  const diseno = useMemo(() => disenoPorZona(est?.receta, cat.prodMap), [est, cat.prodMap]);
  if (!d) return <p className="p-6 text-muted">Cargando…</p>;

  const editable = puedeEditar(m.rol, d.estado);
  const set = async (patch: Partial<D>) => {
    if (!editable) return;
    const next = { ...d, ...patch };
    next.estado = estadoSugerido(next, carga.some((c) => c.cantidad > 0));
    if (patch.estado === 'cerrado') next.estado = 'cerrado';
    await guardar('disparos', next);
  };
  const tol = u.config?.tolerancia_carga ?? 5;
  const k = kpiDisparo(d, cat.secciones.find((s) => s.id === d.seccion_id), carga, movs, cat.prodMap, est?.kg_disparo ?? null, resp);
  const props = { d, set, editable, cat, carga, movs, resp, diseno, tol, m };

  return <div className="min-h-full pb-28">
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <button onClick={onBack} aria-label="Volver" className="size-11 grid place-items-center rounded-lg border border-line"><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2"><span className="font-display text-[24px] leading-none font-semibold whitespace-nowrap">N.° {d.numero_voladura}</span><Pill tone={ESTADO[d.estado].tone}>{ESTADO[d.estado].label}</Pill></div>
          <div className="num text-[12.5px] text-muted mt-0.5 truncate">FC {fmt(k.fc)} kg/m · {fmt(k.kg, 1)} kg · efic. {fmt(k.eficiencia)} %</div>
        </div>
        <SyncChip compact unidadId={u.id} />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar" aria-label="Etapas del disparo">
        {PASOS.map((p, i) => <button key={p} onClick={() => setPaso(i)} aria-current={paso === i ? 'step' : undefined}
          className={cx('shrink-0 h-10 px-3.5 rounded-lg text-[14px] font-medium border', paso === i ? 'bg-accent text-accent-ink border-accent' : 'border-line text-muted')}>
          <span className="num text-[11px] opacity-70 mr-1">{i + 1}</span>{p}</button>)}
      </nav>
    </header>

    {!editable && <div className="mx-4 mt-3 flex items-center gap-2 text-sm text-muted border border-line rounded-lg px-3 py-2"><Lock size={16} />
      {m.rol === 'gerencia' ? 'Acceso de solo lectura.' : 'Disparo cerrado. Solo ingeniería puede corregirlo.'}</div>}

    <main className="px-4 pt-4 max-w-3xl mx-auto grid gap-4">
      {paso === 0 && <PasoDatos {...props} />}
      {paso === 1 && <PasoMacizo {...props} />}
      {paso === 2 && <PasoPerforacion {...props} />}
      {paso === 3 && <PasoVale {...props} />}
      {paso === 4 && <PasoCarguio {...props} />}
      {paso === 5 && <PasoResultado {...props} />}
      {paso === 6 && <PasoChecklist {...props} />}
      {paso === 7 && <PasoCierre {...props} k={k} />}
    </main>

    <footer className="fixed bottom-0 inset-x-0 p-3 bg-bg/95 border-t border-line">
      <div className="max-w-3xl mx-auto flex gap-3">
        <Button variant="ghost" className="flex-1" disabled={paso === 0} onClick={() => setPaso(paso - 1)}><ChevronLeft size={20} />{PASOS[paso - 1] ?? 'Anterior'}</Button>
        <Button className="flex-1" disabled={paso === PASOS.length - 1} onClick={() => setPaso(paso + 1)}>{PASOS[paso + 1] ?? 'Siguiente'}<ChevronRight size={20} /></Button>
      </div>
    </footer>
  </div>;
}

type P = { d: D; set: (p: Partial<D>) => Promise<void>; editable: boolean; cat: Catalogo; carga: CargaZona[]; movs: Movimiento[]; resp: Respuesta[]; diseno: ReturnType<typeof disenoPorZona>; tol: number; m: Membresia };
const Section = ({ title, children, sub }: { title: string; sub?: string; children: React.ReactNode }) =>
  <Card className="grid gap-4"><div><h2 className="font-display text-[22px] font-semibold leading-tight">{title}</h2>{sub && <p className="text-[13px] text-muted">{sub}</p>}</div>{children}</Card>;
const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-3">{children}</div>;

function PasoDatos({ d, set, editable, cat }: P) {
  const dup = useLiveQuery(() => db.disparos.where('[unidad_id+numero_voladura]').equals([d.unidad_id, d.numero_voladura]).count(), [d.numero_voladura]) ?? 0;
  const ests = cat.estandares.filter((e) => e.seccion_id === d.seccion_id);
  return <Section title="Identificación" sub="El número de voladura debe ser único en la unidad.">
    <Grid>
      <div>
        <TextField id="num" label="N.° de voladura" value={d.numero_voladura} disabled={!editable} onChange={(v) => set({ numero_voladura: v.trim() })} />
        {dup > 1 && <span className="text-bad text-[12px]">Ya existe otro disparo con este número</span>}
      </div>
      <TextField id="fecha" label="Fecha" type="date" value={d.fecha} disabled={!editable} onChange={(v) => set({ fecha: v })} />
    </Grid>
    <Chips label="Guardia" value={d.guardia ?? null} disabled={!editable} options={[{ value: 'Día', label: 'Día' }, { value: 'Noche', label: 'Noche' }]} onChange={(v) => set({ guardia: v })} />
    <SelectField id="labor" label="Labor" value={d.labor_id} disabled={!editable} options={cat.labores.map((l) => ({ value: l.id, label: `${l.codigo}${l.zona ? ' · ' + l.zona : ''}` }))} onChange={(v) => set({ labor_id: v })} />
    <SelectField id="sec" label="Sección" value={d.seccion_id} disabled={!editable} options={cat.secciones.map((s) => ({ value: s.id, label: s.nombre }))}
      onChange={(v) => set({ seccion_id: v, estandar_id: cat.estandares.find((e) => e.seccion_id === v && e.vigente)?.id ?? null })} />
    <SelectField id="est" label="Estándar de carga" value={d.estandar_id} disabled={!editable}
      options={ests.map((e) => ({ value: e.id, label: `${e.metodo} v${e.version}${e.vigente ? ' (vigente)' : ' (propuesto)'} · ${e.kg_disparo ?? '—'} kg` }))}
      onChange={(v) => set({ estandar_id: v || null })} />
    <Chips label="Origen del dato" value={d.origen} disabled={!editable}
      options={[{ value: 'medido', label: 'Medido' }, { value: 'estimado', label: 'Estimado' }]} onChange={(v) => v && set({ origen: v })} />
  </Section>;
}

function PasoMacizo({ d, set, editable, cat, m }: P) {
  const sis = m.unidad.sistema_geomecanico;
  const campo = sis === 'GSI' ? 'gsi' : sis === 'Q' ? 'q_barton' : 'rmr';
  const valor = d[campo] as number | null | undefined;
  const clase = clasificar(valor ?? null, cat.clases, sis);
  return <Section title="Macizo rocoso" sub="Se registra en cada disparo: la roca cambia a lo largo de la labor.">
    <NumField id="geo" label={sis === 'Q' ? 'Índice Q de Barton' : sis} value={valor} step={sis === 'Q' ? 0.001 : 1}
      min={sis === 'Q' ? 0.001 : 0} max={sis === 'Q' ? 1000 : 100} disabled={!editable}
      hint={clase ? <Pill tone="accent">Clase {clase.clase}</Pill> : valor != null ? <Pill tone="bad">Sin clase definida</Pill> : null}
      onChange={(v) => set({ [campo]: v, clase_roca_id: clasificar(v, cat.clases, sis)?.id ?? null } as Partial<D>)} />
    <Chips label="Presencia de agua" value={d.agua ?? null} disabled={!editable}
      options={[{ value: 'seco', label: 'Seco' }, { value: 'humedo', label: 'Húmedo' }, { value: 'goteo', label: 'Goteo' }, { value: 'flujo', label: 'Flujo' }]} onChange={(v) => set({ agua: v })} />
    <TextField id="lit" label="Litología / observación geológica" value={d.litologia} disabled={!editable} onChange={(v) => set({ litologia: v })} />
    <p className="text-[12.5px] text-muted">Las clases son las definidas por esta unidad. Para comparar con otras minas se usa el valor numérico, no la etiqueta.</p>
  </Section>;
}

function PasoPerforacion({ d, set, editable }: P) {
  return <Section title="Perforación">
    <Grid>
      <NumField id="barra" label="Barra" unit="pies" step={1} value={d.barra_pies} min={4} max={20} disabled={!editable} onChange={(v) => set({ barra_pies: v })} />
      <NumField id="broca" label="Broca" unit="mm" step={1} value={d.broca_mm} min={25} max={64} disabled={!editable} onChange={(v) => set({ broca_mm: v })} />
      <NumField id="perf" label="Taladros perforados" step={1} value={d.taladros_perforados} min={10} max={120} disabled={!editable} onChange={(v) => set({ taladros_perforados: v })} />
      <NumField id="carg" label="Taladros cargados" step={1} value={d.taladros_cargados} min={10} max={120} disabled={!editable} onChange={(v) => set({ taladros_cargados: v })} />
      <NumField id="rimn" label="Rimados" step={1} value={d.rimados_n} min={0} max={8} disabled={!editable} onChange={(v) => set({ rimados_n: v })} />
      <NumField id="rimd" label="Diámetro rimado" unit="mm" step={1} value={d.rimados_mm} min={45} max={152} disabled={!editable} onChange={(v) => set({ rimados_mm: v })} />
    </Grid>
    <NumField id="pe" label="Perforación efectiva media" unit="m" value={d.perforacion_efectiva} min={1} max={6} disabled={!editable} onChange={(v) => set({ perforacion_efectiva: v })} />
    <Grid>
      <SiNo label="Guiadores" value={d.guiadores} disabled={!editable} onChange={(v) => set({ guiadores: v })} />
      <SiNo label="Paralelismo controlado" value={d.paralelismo} disabled={!editable} onChange={(v) => set({ paralelismo: v })} />
    </Grid>
  </Section>;
}

/** Contadores por producto para movimientos (despacho o devolución) */
function Movs({ d, movs, cat, editable, tipo, soloCon }: P & { tipo: 'despacho' | 'devolucion'; soloCon?: Set<string> }) {
  const prods = cat.productos.filter((p) => p.activo && (!soloCon || soloCon.has(p.id)));
  const setQ = async (pid: string, q: number) => {
    const ex = movs.find((x) => x.tipo === tipo && x.producto_id === pid);
    await guardar('movimientos_explosivo', ex ? { ...ex, cantidad: q } : { id: uuid(), unidad_id: d.unidad_id, disparo_id: d.id, tipo, producto_id: pid, cantidad: q });
  };
  if (!prods.length) return <p className="text-muted text-sm">{soloCon ? 'No hay productos despachados.' : 'No hay productos en el catálogo.'}</p>;
  return <ul className="grid gap-2">{prods.map((p) => {
    const q = Number(movs.find((x) => x.tipo === tipo && x.producto_id === p.id)?.cantidad ?? 0);
    return <li key={p.id} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
      <div className="min-w-0"><div className="text-[15px] leading-tight">{p.nombre}</div>
        <div className="num text-[12px] text-muted">{p.kg_unidad ? `${fmt(q * Number(p.kg_unidad), 2)} kg` : p.unidad_medida}</div></div>
      <Counter value={q} disabled={!editable} onChange={(v) => setQ(p.id, v)} />
    </li>;
  })}</ul>;
}

function PasoVale(p: P) {
  const desp = p.movs.filter((x) => x.tipo === 'despacho');
  return <Section title="Vale de explosivos" sub="Lo que sale del polvorín para este disparo. Complementa, no reemplaza, el registro oficial del polvorín.">
    <TextField id="vale" label="N.° de vale" value={(p.d.extra?.numero_vale as string) ?? ''} disabled={!p.editable} onChange={(v) => p.set({ extra: { ...p.d.extra, numero_vale: v } })} />
    <Movs {...p} tipo="despacho" />
    <div className="num text-right text-[15px]">Despachado: {fmt(kgDe(desp, p.cat.prodMap).kg, 2)} kg</div>
  </Section>;
}

function PasoCarguio(p: P) {
  const { d, carga, diseno, cat, editable, tol } = p;
  const zonasConDiseno = ZONAS.filter((z) => diseno[z]);
  const [zona, setZona] = useState<Zona>(zonasConDiseno[0] ?? 'arranque');
  const [extra, setExtra] = useState('');
  const dz = diseno[zona];
  const lineasZona = carga.filter((c) => c.zona === zona);
  const productosZona = Array.from(new Set([...(dz?.lineas.map((l) => l.producto_id) ?? []), ...lineasZona.map((c) => c.producto_id)]));
  const explosivos = cat.productos.filter((x) => x.kg_unidad != null && x.activo);

  const setQ = async (pid: string, q: number) => {
    const ex = lineasZona.find((c) => c.producto_id === pid);
    const atacado = dz?.lineas.find((l) => l.producto_id === pid)?.atacado ?? null;
    await guardar('carga_zona', ex ? { ...ex, cantidad: q } : { id: uuid(), unidad_id: d.unidad_id, disparo_id: d.id, zona, producto_id: pid, cantidad: q, atacado });
    if (q > 0 && (d.estado === 'borrador' || d.estado === 'perforado')) await guardar('disparos', { ...d, estado: 'cargado' });
  };
  const kgZona = (z: Zona) => kgDe(carga.filter((c) => c.zona === z), cat.prodMap).kg;
  const totalReal = kgDe(carga, cat.prodMap).kg;
  const totalDis = Object.values(diseno).reduce((a, z) => a + (z?.kg ?? 0), 0);
  const dvT = desviacion(totalReal, totalDis);

  return <>
    <Card className="grid gap-3">
      <div className="flex items-baseline justify-between"><h2 className="font-display text-[22px] font-semibold">Carguío por zona</h2>
        {dvT != null && totalReal > 0 && <Pill tone={Math.abs(dvT) <= tol ? 'good' : 'bad'}>Total {dvT > 0 ? '+' : ''}{dvT.toFixed(1)} %</Pill>}</div>
      {!zonasConDiseno.length && <p className="text-sm text-accent">Este disparo no tiene estándar asignado: se registra la carga sin comparar con un diseño.</p>}
      <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist">
        {[...ZONAS, 'sin_zona' as Zona].filter((z) => z !== 'sin_zona' || carga.some((c) => c.zona === 'sin_zona')).map((z) => {
          const dis = diseno[z]?.kg, real = kgZona(z), dv = dis ? desviacion(real, dis) : null, mal = dv != null && real > 0 && Math.abs(dv) > tol;
          return <button key={z} role="tab" aria-selected={zona === z} onClick={() => setZona(z)}
            className={cx('shrink-0 rounded-lg border px-3 py-2 text-left min-w-[104px]', zona === z ? 'border-accent bg-accent/10' : 'border-line bg-raise')}>
            <div className="flex items-center gap-1.5 text-[13.5px] font-medium"><span className={cx('size-2.5 rounded-full', ZCOLOR[z])} />{ZONA_NOMBRE[z]}</div>
            <div className={cx('num text-[12px]', mal ? 'text-bad' : 'text-muted')}>{fmt(real, 1)}{dis ? ` / ${fmt(dis, 1)}` : ''} kg</div>
          </button>;
        })}
      </div>
    </Card>

    <Card className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[20px] font-semibold flex items-center gap-2"><span className={cx('size-3 rounded-full', ZCOLOR[zona])} />{ZONA_NOMBRE[zona]}</h3>
        {dz && <span className="text-[13px] text-muted">{dz.taladros} taladros en el diseño</span>}
      </div>
      {productosZona.length === 0 && <p className="text-muted text-sm">Agrega el producto que se cargó en esta zona.</p>}
      <ul className="grid gap-3">{productosZona.map((pid) => {
        const prod = cat.prodMap.get(pid), dl = dz?.lineas.find((l) => l.producto_id === pid);
        const real = Number(lineasZona.find((c) => c.producto_id === pid)?.cantidad ?? 0);
        const dv = dl ? desviacion(real, dl.cantidad) : null;
        return <li key={pid} className="grid gap-2 border-b border-line pb-3 last:border-0">
          <div className="flex justify-between gap-2"><div>
            <div className="text-[15px]">{prod?.nombre ?? 'Producto'}</div>
            <div className="text-[12.5px] text-muted">{dl ? `Diseño: ${dl.cantidad} (${dl.cantidad / dz!.taladros} por taladro${dl.atacado ? ', atacado' : dl.cana ? ', con caña' : ', sin atacar'})` : 'Fuera del diseño'}</div>
          </div>{dv != null && real > 0 && <Pill tone={Math.abs(dv) <= tol ? 'good' : 'bad'}>{dv > 0 ? '+' : ''}{dv.toFixed(0)} %</Pill>}</div>
          <div className="flex items-center justify-between gap-2">
            <Counter big value={real} disabled={!editable} onChange={(v) => setQ(pid, v)} />
            {dl && editable && real !== dl.cantidad && <Button variant="ghost" className="min-h-11 px-3 text-[13px]" onClick={() => setQ(pid, dl.cantidad)}>= diseño</Button>}
          </div>
        </li>;
      })}</ul>
      {editable && <div className="flex gap-2 items-end">
        <div className="flex-1"><SelectField id="addp" label="Agregar producto a la zona" value={extra} onChange={setExtra}
          options={explosivos.filter((x) => !productosZona.includes(x.id)).map((x) => ({ value: x.id, label: x.nombre }))} /></div>
        <Button variant="ghost" disabled={!extra} onClick={async () => { await setQ(extra, 1); setExtra(''); }}>Agregar</Button>
      </div>}
    </Card>

    <Card className="grid gap-3">
      <h3 className="font-display text-[20px] font-semibold">Taco y amarre</h3>
      <div className="flex items-center justify-between"><Label>Taladros con taco de arcilla</Label><Counter value={d.taladros_con_taco ?? 0} disabled={!editable} onChange={(v) => p.set({ taladros_con_taco: v })} /></div>
      {d.taladros_cargados ? <div className="text-[13px] text-muted">{fmt(((d.taladros_con_taco ?? 0) / d.taladros_cargados) * 100, 0)} % de {d.taladros_cargados} cargados</div> : <div className="text-[13px] text-accent">Registra los taladros cargados en Perforación.</div>}
      <SiNo label="Amarre y retardos según el estándar" value={d.amarre_conforme} disabled={!editable} onChange={(v) => p.set({ amarre_conforme: v })} />
    </Card>
  </>;
}

function PasoResultado(p: P) {
  const { d, set, editable } = p;
  const despachados = new Set(p.movs.filter((x) => x.tipo === 'despacho' && x.cantidad > 0).map((x) => x.producto_id));
  return <>
    <Section title="Resultado del disparo" sub="El avance medido es obligatorio para cerrar.">
      <NumField id="av" label="Avance medido" unit="m" required value={d.avance} min={0.5} max={6} disabled={!editable} onChange={(v) => set({ avance: v })} />
      <Grid>
        <NumField id="anr" label="Ancho real" unit="m" value={d.ancho_real} min={1} max={10} disabled={!editable} onChange={(v) => set({ ancho_real: v })} />
        <NumField id="alr" label="Alto real" unit="m" value={d.alto_real} min={1} max={10} disabled={!editable} onChange={(v) => set({ alto_real: v })} />
        <NumField id="tf" label="Tiros fallados" step={1} value={d.tiros_fallados} min={0} max={50} disabled={!editable} onChange={(v) => set({ tiros_fallados: v })} />
        <NumField id="tr" label="Tacos remanentes" step={1} value={d.tacos_remanentes} min={0} max={50} disabled={!editable} onChange={(v) => set({ tacos_remanentes: v })} />
      </Grid>
      <SiNo label="Arranque completo" value={d.arranque_completo} disabled={!editable} onChange={(v) => set({ arranque_completo: v })} />
      <Chips label="Fragmentación (visual)" value={d.fragmentacion ?? null} disabled={!editable}
        options={[{ value: 'fina', label: 'Fina' }, { value: 'adecuada', label: 'Adecuada' }, { value: 'gruesa', label: 'Gruesa' }, { value: 'bancos', label: 'Bancos' }]} onChange={(v) => set({ fragmentacion: v })} />
      <label className="block" htmlFor="obs"><Label>Observaciones</Label>
        <textarea id="obs" rows={3} disabled={!editable} value={d.observaciones ?? ''} onChange={(e) => set({ observaciones: e.target.value })}
          className="w-full rounded-lg bg-raise border border-line px-3 py-2 text-[16px] outline-none" /></label>
    </Section>
    <Section title="Devolución al polvorín" sub="Sobrante que regresa. Cierra la conciliación del explosivo.">
      <Movs {...p} tipo="devolucion" soloCon={despachados} />
    </Section>
  </>;
}

function PasoChecklist({ d, resp, cat, editable }: P) {
  const pl = cat.plantillas[0];
  if (!pl) return <Section title="Checklist"><p className="text-muted">La unidad no tiene una plantilla de checklist vigente.</p></Section>;
  const setR = async (codigo: string, cumple: boolean | null) => {
    const ex = resp.find((r) => r.item_codigo === codigo);
    await guardar('checklist_respuestas', ex ? { ...ex, cumple } : { id: uuid(), unidad_id: d.unidad_id, disparo_id: d.id, item_codigo: codigo, cumple });
  };
  return <Section title="Checklist de control" sub={pl.nombre}>
    <ul className="grid gap-3">{pl.items.map((it) => {
      const r = resp.find((x) => x.item_codigo === it.codigo);
      const v = r == null ? undefined : r.cumple === null ? 'na' : r.cumple ? 'si' : 'no';
      return <li key={it.codigo} className="grid gap-2 border-b border-line pb-3 last:border-0">
        <div className="text-[15px]"><span className="num text-[11.5px] text-muted mr-2">{it.codigo}</span>{it.texto}</div>
        <div className="flex gap-2">{(['si', 'no', 'na'] as const).map((o) => <button key={o} disabled={!editable} aria-pressed={v === o}
          onClick={() => setR(it.codigo, o === 'na' ? null : o === 'si')}
          className={cx('flex-1 h-11 rounded-lg border font-semibold text-[14px]',
            v === o ? (o === 'si' ? 'bg-good text-bg border-good' : o === 'no' ? 'bg-bad text-bg border-bad' : 'bg-line border-line') : 'border-line text-muted bg-raise')}>
          {o === 'si' ? 'Cumple' : o === 'no' ? 'No cumple' : 'N.A.'}</button>)}</div>
      </li>;
    })}</ul>
  </Section>;
}

function PasoCierre(p: P & { k: ReturnType<typeof kpiDisparo> }) {
  const { d, k, m, tol, set, editable } = p;
  const al = alertas(k, tol, m.unidad.config?.meta_fc);
  const puede = puedeCerrar(m.rol) && editable && d.estado !== 'cerrado';
  return <>
    <Card className="grid gap-3">
      <h2 className="font-display text-[22px] font-semibold">Indicadores</h2>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="FC lineal" value={fmt(k.fc)} unit="kg/m" tone={k.fc != null && m.unidad.config?.meta_fc ? (k.fc <= m.unidad.config.meta_fc ? 'good' : 'bad') : undefined} />
        <Stat label="Eficiencia" value={fmt(k.eficiencia)} unit="%" />
        <Stat label="Explosivo" value={fmt(k.kg)} unit="kg" sub={k.kgDiseno ? `diseño ${fmt(k.kgDiseno)} kg` : undefined} />
        <Stat label="Desviación vs diseño" value={k.desvTotal == null ? '—' : `${k.desvTotal > 0 ? '+' : ''}${fmt(k.desvTotal)}`} unit="%" tone={k.desvTotal == null ? undefined : Math.abs(k.desvTotal) <= tol ? 'good' : 'bad'} />
        <Stat label="FC volumétrico" value={fmt(k.fcVol, 2)} unit="kg/m³" />
        <Stat label="Sobreexcavación" value={fmt(k.sobreexc)} unit="%" />
        <Stat label="Taco de arcilla" value={fmt(k.pctTaco, 0)} unit="%" />
        <Stat label="Checklist" value={fmt(k.checklist, 0)} unit="%" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Despachado" value={fmt(k.kgDespachado, 1)} unit="kg" />
        <Stat label="Devuelto" value={fmt(k.kgDevuelto, 1)} unit="kg" />
        <Stat label="Sin conciliar" value={fmt(k.sinConciliar, 2)} unit="kg" tone={k.sinConciliar == null ? undefined : Math.abs(k.sinConciliar) <= 0.5 ? 'good' : 'bad'} />
      </div>
    </Card>
    <Card className="grid gap-2">
      <h2 className="font-display text-[22px] font-semibold">Alertas</h2>
      {!al.length && <p className="flex items-center gap-2 text-good text-sm"><CheckCircle2 size={18} />Sin alertas.</p>}
      {al.map((a, i) => <p key={i} className={cx('flex gap-2 text-[14px]', a.nivel === 'error' ? 'text-bad' : 'text-accent')}><TriangleAlert size={18} className="shrink-0 mt-0.5" />{a.texto}</p>)}
      {d.calidad?.length ? <p className="text-[12.5px] text-muted">Calidad del dato: {d.calidad.join(' · ')}</p> : null}
    </Card>
    {d.estado !== 'cerrado' && <Card className="grid gap-3">
      {d.avance == null && <p className="text-accent text-sm">Falta el avance medido (etapa Resultado).</p>}
      {!puedeCerrar(m.rol) && <p className="text-muted text-sm">Solo el supervisor o ingeniería pueden cerrar el disparo.</p>}
      <Button disabled={!puede || d.avance == null} className="h-14 text-[17px]" onClick={() => set({ estado: 'cerrado' })}><Lock size={18} />Cerrar disparo</Button>
      <p className="text-[12.5px] text-muted">Al cerrar, el disparo queda bloqueado para el campo. Cualquier corrección posterior la hace ingeniería y queda en la auditoría.</p>
    </Card>}
  </>;
}
