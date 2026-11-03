import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Plus, Settings, UserPlus } from 'lucide-react';
import { db, guardar, uuid } from '../lib/db';
import { supabase } from '../lib/supabase';
import { sincronizar } from '../lib/sync';
import type { Labor, Membresia, Producto, Rol, Seccion } from '../lib/types';
import { useOnline } from '../hooks';
import { Button, Card, Chips, NumField, Pill, SelectField, TextField, cx, fmt } from '../ui';

type Tab = 'secciones' | 'labores' | 'productos' | 'usuarios';
const ROLES: { value: Rol; label: string }[] = [
  { value: 'cargador', label: 'Cargador' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'ingeniero', label: 'Ingeniero' },
  { value: 'gerencia', label: 'Gerencia' }, { value: 'admin', label: 'Administrador' }];

export function Admin({ m, onBack }: { m: Membresia; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('secciones');
  const tabs: [Tab, string][] = [['secciones', 'Secciones'], ['labores', 'Labores'], ['productos', 'Explosivos'], ...(m.rol === 'admin' ? [['usuarios', 'Usuarios'] as [Tab, string]] : [])];
  return <div className="min-h-full pb-28">
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <button onClick={onBack} aria-label="Volver" className="size-11 grid place-items-center rounded-lg border border-line"><ArrowLeft size={20} /></button>
        <div className="font-display text-[24px] font-semibold flex items-center gap-2"><Settings size={20} className="text-accent" />Administración</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
        className={cx('shrink-0 h-10 px-4 rounded-lg text-[14px] font-medium border', tab === k ? 'bg-accent text-accent-ink border-accent' : 'border-line text-muted')}>{l}</button>)}</nav>
    </header>
    <main className="px-4 pt-4 max-w-3xl mx-auto grid gap-4">
      {tab === 'secciones' && <Secciones u={m.unidad.id} />}
      {tab === 'labores' && <Labores u={m.unidad.id} />}
      {tab === 'productos' && <Productos u={m.unidad.id} />}
      {tab === 'usuarios' && <Usuarios m={m} />}
    </main>
  </div>;
}

function Lista<T extends { id: string }>({ items, render, onEdit }: { items: T[]; render: (x: T) => React.ReactNode; onEdit: (x: T) => void }) {
  return <ul className="grid gap-2">{items.map((x) => <li key={x.id}><button onClick={() => onEdit(x)} className="w-full text-left bg-surface border border-line rounded-xl px-4 py-3 flex items-center gap-3 active:bg-raise">
    <div className="flex-1 min-w-0">{render(x)}</div><Pencil size={16} className="text-muted" /></button></li>)}</ul>;
}

function Secciones({ u }: { u: string }) {
  const items = useLiveQuery(() => db.secciones.where('unidad_id').equals(u).filter((x) => !x.deleted_at).toArray(), [u]) ?? [];
  const [ed, setEd] = useState<Seccion | null>(null);
  const nueva = (): Seccion => ({ id: uuid(), unidad_id: u, nombre: '', ancho: 4, alto: 4, flecha: 0.5, sentido: 'horizontal' });
  const nombreAuto = (s: Seccion) => `${Number(s.ancho).toFixed(2)} x ${Number(s.alto).toFixed(2)} ${s.sentido}`;
  return <>
    {!ed && <Button onClick={() => setEd(nueva())}><Plus size={18} />Nueva sección</Button>}
    {ed && <Card className="grid gap-3">
      <h2 className="font-display text-[22px] font-semibold">{items.some((x) => x.id === ed.id) ? 'Editar sección' : 'Nueva sección'}</h2>
      <div className="grid grid-cols-3 gap-3">
        <NumField id="s-an" label="Ancho" unit="m" value={ed.ancho} min={1.5} max={10} onChange={(v) => setEd({ ...ed, ancho: v ?? 0 })} />
        <NumField id="s-al" label="Alto" unit="m" value={ed.alto} min={1.5} max={10} onChange={(v) => setEd({ ...ed, alto: v ?? 0 })} />
        <NumField id="s-fl" label="Flecha" unit="m" value={ed.flecha} min={0} max={2} onChange={(v) => setEd({ ...ed, flecha: v })} />
      </div>
      <Chips label="Sentido" value={ed.sentido as 'horizontal'} options={[{ value: 'horizontal', label: 'Horizontal' }, { value: 'negativo', label: 'Negativo' }, { value: 'positivo', label: 'Positivo' }]} onChange={(v) => v && setEd({ ...ed, sentido: v })} />
      <TextField id="s-no" label="Nombre" value={ed.nombre} placeholder={nombreAuto(ed)} onChange={(v) => setEd({ ...ed, nombre: v })} />
      <p className="text-[12.5px] text-muted">Área de diseño: <span className="num">{fmt(Number(ed.ancho) * (Number(ed.alto) - Number(ed.flecha ?? 0)) + (2 / 3) * Number(ed.ancho) * Number(ed.flecha ?? 0), 2)} m²</span>. Cada sección necesita su propio estándar de carga: créalo luego en Diseño.</p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => setEd(null)}>Cancelar</Button>
        <Button disabled={!(ed.ancho > 0 && ed.alto > 0)} onClick={async () => { const { area: _a, ...row } = { ...ed, nombre: ed.nombre.trim() || nombreAuto(ed) }; void _a; await guardar('secciones', row as Seccion); setEd(null); }}>Guardar</Button>
      </div>
      {items.some((x) => x.id === ed.id) && <Button variant="danger" onClick={async () => { await guardar('secciones', { ...ed, deleted_at: new Date().toISOString() }); setEd(null); }}>Eliminar sección</Button>}
    </Card>}
    <Lista items={items} onEdit={setEd} render={(s) => <><div className="text-[16px] font-medium">{s.nombre}</div><div className="text-[13px] text-muted num">{s.ancho} × {s.alto} m · flecha {s.flecha ?? 0} m · {s.sentido}</div></>} />
  </>;
}

function Labores({ u }: { u: string }) {
  const items = useLiveQuery(() => db.labores.where('unidad_id').equals(u).filter((x) => !x.deleted_at).toArray(), [u]) ?? [];
  const [ed, setEd] = useState<Labor | null>(null);
  return <>
    {!ed && <Button onClick={() => setEd({ id: uuid(), unidad_id: u, codigo: '', zona: '', tipo: 'crucero' })}><Plus size={18} />Nueva labor</Button>}
    {ed && <Card className="grid gap-3">
      <TextField id="l-co" label="Código" value={ed.codigo} placeholder="CX-410" onChange={(v) => setEd({ ...ed, codigo: v.toUpperCase() })} />
      <TextField id="l-zo" label="Zona / veta" value={ed.zona} onChange={(v) => setEd({ ...ed, zona: v })} />
      <Chips label="Tipo" value={ed.tipo as 'crucero'} options={['crucero', 'galería', 'rampa', 'subnivel', 'chimenea', 'by pass'].map((t) => ({ value: t as 'crucero', label: t }))} onChange={(v) => setEd({ ...ed, tipo: v })} />
      {items.some((x) => x.codigo === ed.codigo && x.id !== ed.id) && <p className="text-bad text-sm">Ya existe una labor con ese código.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => setEd(null)}>Cancelar</Button>
        <Button disabled={!ed.codigo.trim() || items.some((x) => x.codigo === ed.codigo && x.id !== ed.id)} onClick={async () => { await guardar('labores', { ...ed, codigo: ed.codigo.trim() }); setEd(null); }}>Guardar</Button>
      </div>
    </Card>}
    <Lista items={items} onEdit={setEd} render={(l) => <><div className="text-[16px] font-medium">{l.codigo}</div><div className="text-[13px] text-muted">{[l.tipo, l.zona].filter(Boolean).join(' · ')}</div></>} />
  </>;
}

function Productos({ u }: { u: string }) {
  const items = useLiveQuery(() => db.productos.where('unidad_id').equals(u).filter((x) => !x.deleted_at).toArray(), [u]) ?? [];
  const [ed, setEd] = useState<Producto | null>(null);
  const kgCaja = ed && ed.kg_unidad ? 25 / Number(ed.kg_unidad) : null;
  return <>
    {!ed && <Button onClick={() => setEd({ id: uuid(), unidad_id: u, nombre: '', categoria: 'emulsion', unidad_medida: 'cartucho', kg_unidad: 0.25, activo: true, densidad: 1.14, potencia_rel_anfo: 1, largo_mm: 304.8, diametro_mm: 31.75 })}><Plus size={18} />Nuevo producto</Button>}
    {ed && <Card className="grid gap-3">
      <TextField id="p-no" label="Nombre" value={ed.nombre} placeholder={'Emulnor 3000 1½"x12"'} onChange={(v) => setEd({ ...ed, nombre: v })} />
      <SelectField id="p-ca" label="Categoría" value={ed.categoria} onChange={(v) => setEd({ ...ed, categoria: v, kg_unidad: ['iniciador', 'cordon', 'mecha', 'otro_accesorio'].includes(v) ? null : ed.kg_unidad ?? 0.25, unidad_medida: ['cordon', 'mecha'].includes(v) ? 'm' : ['iniciador', 'otro_accesorio'].includes(v) ? 'unidad' : 'cartucho' })}
        options={[['emulsion', 'Emulsión'], ['dinamita', 'Dinamita'], ['anfo', 'ANFO'], ['agente_bombeable', 'Agente bombeable'], ['iniciador', 'Iniciador / detonador'], ['cordon', 'Cordón detonante'], ['mecha', 'Mecha'], ['otro_accesorio', 'Otro accesorio']].map(([value, label]) => ({ value, label }))} />
      {ed.kg_unidad != null && <><div className="grid grid-cols-2 gap-3">
        <NumField id="p-kg" label="kg por cartucho" value={ed.kg_unidad} step={0.00001} min={0.05} max={3} onChange={(v) => setEd({ ...ed, kg_unidad: v })} hint={kgCaja ? `${fmt(kgCaja, 0)} por caja de 25 kg` : undefined} />
        <NumField id="p-de" label="Densidad" unit="g/cm³" value={ed.densidad} step={0.01} min={0.7} max={1.6} onChange={(v) => setEd({ ...ed, densidad: v })} />
        <NumField id="p-sa" label="Potencia rel. ANFO" value={ed.potencia_rel_anfo} step={0.01} min={0.5} max={1.5} onChange={(v) => setEd({ ...ed, potencia_rel_anfo: v })} />
        <NumField id="p-la" label="Largo" unit="mm" value={ed.largo_mm} step={0.1} min={100} max={1000} onChange={(v) => setEd({ ...ed, largo_mm: v })} />
      </div><p className="text-[12.5px] text-muted">Toma los valores de la ficha técnica del fabricante. Densidad y potencia relativa los usa el modelo de Holmberg.</p></>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => setEd(null)}>Cancelar</Button>
        <Button disabled={!ed.nombre.trim()} onClick={async () => { await guardar('productos', ed); setEd(null); }}>Guardar</Button>
      </div>
      {items.some((x) => x.id === ed.id) && <Button variant="ghost" onClick={async () => { await guardar('productos', { ...ed, activo: !ed.activo }); setEd(null); }}>{ed.activo ? 'Desactivar' : 'Activar'}</Button>}
    </Card>}
    <Lista items={items} onEdit={setEd} render={(p) => <><div className="text-[16px] font-medium flex items-center gap-2">{p.nombre}{!p.activo && <Pill>inactivo</Pill>}</div>
      <div className="text-[13px] text-muted num">{p.kg_unidad ? `${p.kg_unidad} kg · ρ ${p.densidad ?? '—'} · S ${p.potencia_rel_anfo ?? '—'}` : p.unidad_medida}</div></>} />
  </>;
}

interface Miembro { user_id: string; email: string; nombre: string | null; rol: Rol; activo: boolean }
function Usuarios({ m }: { m: Membresia }) {
  const online = useOnline();
  const [lista, setLista] = useState<Miembro[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [f, setF] = useState({ email: '', nombre: '', rol: 'cargador' as Rol });
  const cargar = async () => {
    const { data, error } = await supabase.rpc('miembros_unidad', { p_unidad: m.unidad_id });
    if (error) setErr(/function|does not exist|schema cache/i.test(error.message) ? 'Falta ejecutar 04_admin.sql en Supabase (SQL Editor).' : error.message); else { setErr(null); setLista(data as Miembro[]); }
  };
  useEffect(() => { if (online) cargar(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps
  const asignar = async (email: string, rol: Rol, nombre?: string) => {
    setOk(null);
    const { error } = await supabase.rpc('asignar_rol', { p_email: email, p_unidad: m.unidad_id, p_rol: rol, p_nombre: nombre || null });
    if (error) setErr(error.message); else { setOk(`Acceso asignado a ${email}.`); setF({ email: '', nombre: '', rol: 'cargador' }); cargar(); sincronizar(m.unidad_id); }
  };
  if (!online) return <Card><p className="text-accent">La gestión de usuarios necesita conexión.</p></Card>;
  return <>
    <Card className="grid gap-3">
      <h2 className="font-display text-[22px] font-semibold flex items-center gap-2"><UserPlus size={20} />Dar acceso</h2>
      <ol className="text-[13px] text-muted list-decimal pl-5 grid gap-1">
        <li>La persona crea su cuenta en la app ("Crear cuenta") o el administrador la crea en Supabase → Authentication → Add user.</li>
        <li>Aquí escribes su correo y le das un rol en esta unidad.</li>
      </ol>
      <TextField id="u-em" label="Correo" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
      <TextField id="u-no" label="Nombre (opcional)" value={f.nombre} onChange={(v) => setF({ ...f, nombre: v })} />
      <SelectField id="u-ro" label="Rol" value={f.rol} onChange={(v) => setF({ ...f, rol: v as Rol })} options={ROLES} />
      {err && <p className="text-bad text-sm" role="alert">{err}</p>}
      {ok && <p className="text-good text-sm">{ok}</p>}
      <Button disabled={!/\S+@\S+\.\S+/.test(f.email)} onClick={() => asignar(f.email, f.rol, f.nombre)}><UserPlus size={18} />Asignar acceso</Button>
    </Card>
    <Card className="grid gap-2">
      <h2 className="font-display text-[22px] font-semibold">Usuarios de {m.unidad.nombre}</h2>
      {!lista ? <p className="text-muted text-sm">Cargando…</p> : lista.map((x) => <div key={x.user_id} className="flex items-center gap-2 border-t border-line pt-2">
        <div className="flex-1 min-w-0"><div className="text-[15px] truncate">{x.nombre || x.email}</div><div className="text-[12.5px] text-muted truncate">{x.email}{!x.activo && ' · sin acceso'}</div></div>
        <select aria-label={`Rol de ${x.email}`} value={x.rol} onChange={(e) => asignar(x.email, e.target.value as Rol)} className="h-10 rounded-lg bg-raise border border-line px-2 text-[14px]">
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        {x.activo && <button className="text-bad text-[13px] underline" onClick={async () => { const { error } = await supabase.rpc('quitar_acceso', { p_user: x.user_id, p_unidad: m.unidad_id }); if (error) setErr(error.message); else cargar(); }}>Quitar</button>}
      </div>)}
    </Card>
  </>;
}
