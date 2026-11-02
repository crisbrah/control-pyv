import { useState } from 'react';
import { HardHat, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, TextField } from '../ui';

export function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) setErr(/fetch|network/i.test(error.message)
      ? 'Sin conexión. Inicia sesión una vez con señal; después la app funciona sin ella.'
      : 'Correo o contraseña incorrectos.');
  }

  return <main className="min-h-full grid place-items-center px-5 py-10">
    <form onSubmit={entrar} className="w-full max-w-sm grid gap-5">
      <div className="grid gap-2">
        <div className="size-14 rounded-xl bg-accent text-accent-ink grid place-items-center"><HardHat size={30} /></div>
        <h1 className="font-display text-[40px] leading-none font-semibold">Control P&amp;V</h1>
        <p className="text-muted">Registro de perforación y voladura en frentes de avance.</p>
      </div>
      <TextField id="email" label="Correo" type="email" value={email} onChange={setEmail} placeholder="nombre@empresa.com" />
      <TextField id="pass" label="Contraseña" type="password" value={pass} onChange={setPass} />
      {err && <p role="alert" className="text-bad text-sm">{err}</p>}
      <Button type="submit" disabled={busy || !email || !pass} className="h-14 text-[17px]"><LogIn size={20} />{busy ? 'Entrando…' : 'Entrar'}</Button>
      <p className="text-[12.5px] text-muted">Los usuarios los crea el administrador de la unidad.</p>
    </form>
  </main>;
}
