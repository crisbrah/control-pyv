import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return <button {...p} className={cx(
    'inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-lg font-semibold text-[15px] transition-colors disabled:opacity-40 disabled:pointer-events-none',
    variant === 'primary' && 'bg-accent text-accent-ink active:brightness-90',
    variant === 'ghost' && 'border border-line text-ink bg-transparent active:bg-raise',
    variant === 'danger' && 'border border-bad text-bad bg-transparent', className)} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('bg-surface border border-line rounded-xl p-4', className)}>{children}</div>;
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return <span className="flex items-baseline justify-between gap-2 text-[13px] text-muted mb-1.5"><span>{children}</span>{hint && <span className="text-[12px]">{hint}</span>}</span>;
}

type NumProps = { id: string; label: string; value: number | null | undefined; onChange: (v: number | null) => void; unit?: string; step?: number; min?: number; max?: number; disabled?: boolean; hint?: ReactNode; required?: boolean };
export function NumField({ id, label, value, onChange, unit, step = 0.01, min, max, disabled, hint, required }: NumProps) {
  const fuera = value != null && ((min != null && value < min) || (max != null && value > max));
  return <label htmlFor={id} className="block">
    <Label hint={hint}>{label}{required && <span className="text-accent"> *</span>}</Label>
    <div className={cx('flex items-center rounded-lg bg-raise border', fuera ? 'border-bad' : 'border-line')}>
      <input id={id} inputMode="decimal" type="number" step={step} disabled={disabled}
        className="num w-full bg-transparent px-3 h-12 text-[17px] outline-none disabled:opacity-60"
        value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      {unit && <span className="pr-3 text-muted text-sm">{unit}</span>}
    </div>
    {fuera && <span className="text-bad text-[12px]">Fuera del rango esperado ({min}–{max})</span>}
  </label>;
}

export function TextField({ id, label, value, onChange, disabled, type = 'text', placeholder }: { id: string; label: string; value: string | null | undefined; onChange: (v: string) => void; disabled?: boolean; type?: string; placeholder?: string }) {
  return <label htmlFor={id} className="block"><Label>{label}</Label>
    <input id={id} type={type} disabled={disabled} placeholder={placeholder}
      className="w-full rounded-lg bg-raise border border-line px-3 h-12 text-[16px] outline-none disabled:opacity-60"
      value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></label>;
}

export function SelectField({ id, label, value, onChange, options, disabled }: { id: string; label: string; value: string | null | undefined; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return <label htmlFor={id} className="block"><Label>{label}</Label>
    <select id={id} disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-raise border border-line px-3 h-12 text-[16px] outline-none disabled:opacity-60">
      <option value="">Seleccionar…</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select></label>;
}

export function Chips<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T | null | undefined; options: { value: T; label: string }[]; onChange: (v: T | null) => void; disabled?: boolean }) {
  return <div><Label>{label}</Label>
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" disabled={disabled} aria-pressed={value === o.value}
        onClick={() => onChange(value === o.value ? null : o.value)}
        className={cx('min-h-11 px-4 rounded-lg border text-[15px] font-medium',
          value === o.value ? 'bg-accent text-accent-ink border-accent' : 'border-line text-ink bg-raise')}>{o.label}</button>)}
    </div></div>;
}

export function SiNo({ label, value, onChange, disabled }: { label: string; value: boolean | null | undefined; onChange: (v: boolean | null) => void; disabled?: boolean }) {
  return <Chips label={label} disabled={disabled} value={value == null ? null : value ? 'si' : 'no'}
    options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]}
    onChange={(v) => onChange(v == null ? null : v === 'si')} />;
}

export function Counter({ value, onChange, step = 1, disabled, big }: { value: number; onChange: (v: number) => void; step?: number; disabled?: boolean; big?: boolean }) {
  const btn = cx('grid place-items-center rounded-lg bg-raise border border-line active:bg-line disabled:opacity-40', big ? 'size-14' : 'size-12');
  return <div className="flex items-center gap-2">
    <button type="button" aria-label="Restar" className={btn} disabled={disabled || value <= 0} onClick={() => onChange(Math.max(0, value - step))}><Minus size={20} /></button>
    <input type="number" inputMode="numeric" aria-label="Cantidad" disabled={disabled}
      className={cx('num text-center bg-transparent outline-none', big ? 'w-20 text-[26px]' : 'w-16 text-[20px]')}
      value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    <button type="button" aria-label="Sumar" className={btn} disabled={disabled} onClick={() => onChange(value + step)}><Plus size={20} /></button>
  </div>;
}

export function Pill({ tone = 'muted', children }: { tone?: 'good' | 'bad' | 'warn' | 'muted' | 'accent'; children: ReactNode }) {
  const t = { good: 'bg-good/15 text-good', bad: 'bg-bad/15 text-bad', warn: 'bg-accent/15 text-accent', muted: 'bg-line text-muted', accent: 'bg-accent text-accent-ink' }[tone];
  return <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold', t)}>{children}</span>;
}

export function Stat({ label, value, unit, tone, sub }: { label: string; value: string; unit?: string; tone?: 'good' | 'bad'; sub?: ReactNode }) {
  return <div className="bg-raise border border-line rounded-lg px-3 py-2.5">
    <div className="text-[11.5px] uppercase tracking-wide text-muted">{label}</div>
    <div className={cx('num text-[22px] font-medium leading-tight', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}{unit && <span className="text-[13px] text-muted font-normal"> {unit}</span>}</div>
    {sub && <div className="text-[12px] text-muted">{sub}</div>}
  </div>;
}

export const fmt = (v: number | null | undefined, d = 1) => (v == null || !isFinite(v) ? '—' : v.toFixed(d));
