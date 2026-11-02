import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { db, getMembresias, getMeta, pedirPersistencia, setMeta } from './lib/db';
import { cargarMembresias, contarPendientes, sincronizar } from './lib/sync';
import type { Membresia } from './lib/types';
import { Login } from './screens/Login';
import { Home } from './screens/Home';
import { Disparo } from './screens/Disparo';
import { Button, Card, Pill } from './ui';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [mems, setMems] = useState<Membresia[] | null>(null);
  const [unidadId, setUnidadId] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
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
  return <Home m={m} multi={mems.length > 1} onOpen={setAbierto} onLogout={salir} onCambiarUnidad={() => setUnidadId(null)} />;
}

const Centro = ({ children }: { children: React.ReactNode }) =>
  <main className="min-h-full grid place-items-center p-6"><div className="w-full max-w-sm grid gap-4">{children}</div></main>;
