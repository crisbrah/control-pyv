// MODO DEMO: simula Supabase dentro del navegador. Se activa con `npm run demo`.
// Sirve para probar la app en la PC sin servidor ni internet. Nada sale del navegador.
/* eslint-disable @typescript-eslint/no-explicit-any */
const SOT = '11111111-1111-1111-1111-111111111111', T = '2026-11-02T10:00:00.000000+00:00';
const b = (o: any) => ({ unidad_id: SOT, updated_at: T, deleted_at: null, ...o });
const E1 = 'p-e1000', E3 = 'p-e3000', E5 = 'p-e5000';
const data = {
  labores: [b({ id: 'l-cx400', codigo: 'CX-400', zona: 'Santa Rosa', tipo: 'crucero' })],
  secciones: [b({ id: 's-350', nombre: '3.50 x 3.50 negativo', ancho: 3.5, alto: 3.5, flecha: 0.5, sentido: 'negativo', area: 11.67 })],
  productos: [
    b({ id: E1, nombre: 'Emulnor 1000 1¼"x12"', categoria: 'emulsion', unidad_medida: 'cartucho', kg_unidad: 0.25, activo: true, densidad: 1.13, potencia_rel_anfo: 0.85, largo_mm: 304.8 }),
    b({ id: E3, nombre: 'Emulnor 3000 1¼"x12"', categoria: 'emulsion', unidad_medida: 'cartucho', kg_unidad: 0.26596, activo: true, densidad: 1.14, potencia_rel_anfo: 1.0, largo_mm: 304.8 }),
    b({ id: E5, nombre: 'Emulnor 5000 1¼"x12"', categoria: 'emulsion', unidad_medida: 'cartucho', kg_unidad: 0.26596, activo: true, densidad: 1.16, potencia_rel_anfo: 1.05, largo_mm: 304.8 }),
    b({ id: 'p-fanel', nombre: 'Fanel LP 4.8 m', categoria: 'iniciador', unidad_medida: 'unidad', kg_unidad: null, activo: true }),
  ],
  clases_roca: [['III A', 51, 60], ['III B', 41, 50], ['II', 61, 80]].map(([c, a, z]: any) => b({ id: 'c-' + c, sistema: 'RMR', clase: c, valor_min: a, valor_max: z })),
  plantillas_checklist: [b({ id: 'pl1', nombre: 'Control de ejecución CX-400 v1', vigente: true, items: [
    { codigo: 'A.I.1-3a', texto: 'Malla marcada en el frente según el estándar' }, { codigo: 'A.I.1-6', texto: 'Retardos según el estándar' },
    { codigo: 'A.I.1-7', texto: 'Taco de arcilla en todos los taladros' }, { codigo: 'SEG-1', texto: 'Verificación de tiros fallados' }] })],
  estandares: [b({ id: 'est1', seccion_id: 's-350', version: 1, metodo: 'Holmberg', vigente: false, kg_disparo: 105.3, avance_esperado: 3.86, parametros: { broca_mm: { valor: 45, fuente: 'supuesto' }, rimado_mm: { valor: 102, fuente: 'supuesto' }, rimados_n: { valor: 4, fuente: 'dato' }, H: { valor: 4.06, fuente: 'dato' } }, receta: {
    arranque: { taladros: 16, productos: [{ id: E5, cantidad: 11 }] },
    ayudas: { taladros: 7, productos: [{ id: E5, cantidad: 7, atacado: true }, { id: E1, cantidad: 7 }] },
    hastiales: { taladros: 8, productos: [{ id: E5, cantidad: 1 }, { id: E1, cantidad: 2, cana: true }] },
    corona: { taladros: 7, productos: [{ id: E5, cantidad: 1 }, { id: E1, cantidad: 2, cana: true }] },
    arrastres: { taladros: 6, productos: [{ id: E5, cantidad: 7, atacado: true }, { id: E1, cantidad: 7 }] }, taco_m: 0.45 } })],
  disparos: [['16','2026-09-09','Día',46,4.10,3.60,175.00,808],['17','2026-09-10','Día',46,4.10,3.80,187.50,714],['18','2026-09-12','Día',46,4.10,3.60,155.32,587],
    ['19','2026-09-13','Día',45,4.10,3.50,148.44,563],['20','2026-09-14','Día',42,4.10,3.30,150.46,570],['21','2026-09-19','Noche',46,4.00,3.50,190.13,720],
    ['22','2026-09-20','Noche',42,4.00,2.70,135.21,512],['23','2026-09-21','Noche',46,4.00,3.50,159.95,607],['29','2026-09-25','Noche',47,4.00,4.00,162.50,617]]
    .map(([n,f,g,t,pe,av,kg,c]: any) => b({ id: 'd' + n, labor_id: 'l-cx400', seccion_id: 's-350', estandar_id: null, numero_voladura: n, fecha: f, guardia: g, estado: 'cerrado', origen: 'importado',
      rmr: 58, clase_roca_id: 'c-III A', taladros_cargados: t, perforacion_efectiva: pe, avance: av, kg_declarado: kg, cartuchos_declarados: c, taladros_con_taco: 0,
      extra: {}, calidad: ['RMR igual en todos los registros de la fuente', 'Carga por zona no registrada'] })),
  carga_zona: [], movimientos_explosivo: [], checklist_respuestas: [],
};

const tablas: Record<string, any[]> = data as any;
tablas.estandares[0].parametros = { broca_mm: { valor: 45, fuente: 'supuesto' }, rimado_mm: { valor: 102, fuente: 'supuesto' }, rimados_n: { valor: 4, fuente: 'dato' }, H: { valor: 4.06, fuente: 'dato' } };
const miembros: any[] = [{ user_id: 'demo', email: 'demo@local', nombre: 'Usuario demo', rol: 'admin', activo: true }, { user_id: 'd2', email: 'supervisor@demo', nombre: 'Supervisor demo', rol: 'supervisor', activo: true }];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!navigator.onLine) throw new TypeError('Failed to fetch');           // imita la falta de señal
  await new Promise((r) => setTimeout(r, 150));
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (url.pathname.startsWith('/auth/v1/')) {
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
    return json({ access_token: 'demo.eyJzdWIiOiJkZW1vIn0.demo', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400,
      refresh_token: 'demo', user: { id: 'demo', aud: 'authenticated', role: 'authenticated', email: 'demo@local', app_metadata: {}, user_metadata: {}, created_at: T } });
  }
  if (url.pathname.includes('/rest/v1/rpc/')) {
    const fn = url.pathname.split('/').pop(), a = JSON.parse(String(init?.body ?? '{}'));
    if (fn === 'miembros_unidad') return json(miembros);
    if (fn === 'asignar_rol') {
      const ex = miembros.find((x) => x.email === a.p_email.toLowerCase());
      if (ex) Object.assign(ex, { rol: a.p_rol, activo: true, nombre: a.p_nombre ?? ex.nombre });
      else miembros.push({ user_id: crypto.randomUUID(), email: a.p_email.toLowerCase(), nombre: a.p_nombre, rol: a.p_rol, activo: true });
      return json('ok');
    }
    if (fn === 'quitar_acceso') { const ex = miembros.find((x) => x.user_id === a.p_user); if (ex) ex.activo = false; return json('ok'); }
  }
  const tabla = url.pathname.split('/').pop()!;
  if (tabla === 'membresias') return json([{ unidad_id: SOT, rol: 'admin', unidad: { id: SOT, nombre: 'U.M. SOTRAMI · DEMO local', es_demo: false, sistema_geomecanico: 'RMR', config: { meta_fc: 40, meta_eficiencia: 95, tolerancia_carga: 5, costo_kg: null } } }]);
  const rows = (tablas[tabla] ??= []);
  if (method === 'POST') {
    const body = JSON.parse(String(init?.body ?? '[]'));
    for (const r of Array.isArray(body) ? body : [body]) {
      const i = rows.findIndex((x) => x.id === r.id);
      const fila = { ...(i >= 0 ? rows[i] : {}), ...r, updated_at: new Date().toISOString() };
      if (i >= 0) rows[i] = fila; else rows.push(fila);
    }
    return json([], 201);
  }
  const gte = (url.searchParams.get('updated_at') ?? '').replace(/^gte\./, '');
  const desde = gte ? new Date(gte).getTime() : 0;
  return json(rows.filter((r) => new Date(r.updated_at).getTime() >= desde));
}
