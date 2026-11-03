import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { DEMO, supabase } from './lib/supabase';
import { db, getMembresias, getMeta, pedirPersistencia, setMeta } from './lib/db';
import { cargarMembresias, contarPendientes, sincronizar } from './lib/sync';
import type { Membresia } from './lib/types';
import { Login } from './screens/Login';
import { Home } from './screens/Home';
import { Disparo } from './screens/Disparo';
import { Simulador } from './screens/Simulador';
import { Diseno } from './screens/Diseno';
import { Analisis } from './screens/Analisis';
import { Admin } from './screens/Admin';
import { ClipboardList, FlaskConical, Grid3x3 } from 'lucide-react';
import { Button, Card, Pill } from './ui';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [mems, setMems] = useState<Membresia[] | null>(null);
  const [unidadId, setUnidadId] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<string[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [tab, setTab] = useState<'disparos' | 'diseno' | 'simulador'>('disparos');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pedirPersistencia();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // membresías: primero las guardadas (funciona sin señal), luego las del servidor
  useEffect(() => {
    if (!session) return;
    (async () => {
      const local = await getMembresias();
      if (local) setMems(local);
      setUnidadId((await getMeta<string>('unidad')) ?? local?.[0]?.unidad_id ?? null);
      try {
        const remoto = await cargarMembresias();
        if (remoto) { setMems(remoto); if (remoto.length === 1) setUnidadId(remoto[0].unidad_id); }
        else if (!local) setError('Sin conexión. La primera vez necesitas señal para descargar tus datos.');
      } catch (e) { setError((e as Error).message); }
    })();
  }, [session]);

  // sincronización: al entrar, al recuperar señal y cada 60 s
  useEffect(() => {
    if (!unidadId || !session) return;
    setMeta('unidad', unidadId);
    contarPendientes();
    const go = () => sincronizar(unidadId);
    go();
    addEventListener('online', go);
    const t = setInterval(go, 60_000);
    return () => { removeEventListener('online', go); clearInterval(t); };
  }, [unidadId, session]);

  async function salir() {
    const pend = await db.outbox.count();
    if (pend && !window.confirm(`Hay ${pend} cambios sin sincronizar. Si sales se perderán. ¿Salir igual?`)) return;
    await supabase.auth.signOut();
    await db.delete(); location.reload();
  }

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (error && !mems) return <Centro><p className="text-bad">{error}</p><Button variant="ghost" onClick={salir}>Cerrar sesión</Button></Centro>;
  if (!mems) return <Centro><p className="text-muted">Cargando…</p></Centro>;
  if (!mems.length) return <Centro><p>Tu usuario aún no tiene acceso a ninguna unidad minera. Pide al administrador que te asigne un rol.</p><Button variant="ghost" onClick={salir}>Cerrar sesión</Button></Centro>;

  const m = mems.find((x) => x.unidad_id === unidadId);
  if (!m) return <Centro>
    <h1 className="font-display text-[30px] font-semibold">Elige la unidad</h1>
    {mems.map((x) => <button key={x.unidad_id} onClick={() => setUnidadId(x.unidad_id)} className="text-left">
      <Card className="flex items-center justify-between"><div><div className="text-[17px] font-medium">{x.unidad.nombre}</div><div className="text-muted text-sm capitalize">{x.rol}</div></div>{x.unidad.es_demo && <Pill tone="warn">DEMO</Pill>}</Card>
    </button>)}
  </Centro>;

  if (abierto) return <Disparo id={abierto} m={m} onBack={() => setAbierto(null)} />;
  if (analisis) return <Analisis m={m} ids={analisis} onBack={() => setAnalisis(null)} />;
  if (admin) return <Admin m={m} onBack={() => setAdmin(false)} />;
  return <>
    {DEMO && <div className="bg-accent text-accent-ink text-center text-[12px] font-semibold py-1">MODO DEMO LOCAL · sin servidor</div>}
    {tab === 'disparos'
      ? <Home m={m} multi={mems.length > 1} onOpen={setAbierto} onAnalizar={setAnalisis} onAdmin={() => setAdmin(true)} onLogout={salir} onCambiarUnidad={() => setUnidadId(null)} />
      : tab === 'diseno' ? <Diseno m={m} /> : <Simulador m={m} />}
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-line grid grid-cols-3" aria-label="Secciones"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {([['disparos', 'Disparos', ClipboardList], ['diseno', 'Diseño', Grid3x3], ['simulador', 'Simulador', FlaskConical]] as const).map(([k, l, Icon]) =>
        <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
          className={'h-16 flex flex-col items-center justify-center gap-0.5 text-[12.5px] font-medium ' + (tab === k ? 'text-accent' : 'text-muted')}>
          <Icon size={22} />{l}</button>)}
    </nav>
  </>;
}

const Centro = ({ children }: { children: React.ReactNode }) =>
  <main className="min-h-full grid place-items-center p-6"><div className="w-full max-w-sm grid gap-4">{children}</div></main>;
