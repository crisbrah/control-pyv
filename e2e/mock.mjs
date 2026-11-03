// Simula Supabase para probar la app sin red: login, catálogos SOTRAMI, 9 disparos reales y escrituras.
const SOT = '11111111-1111-1111-1111-111111111111', T = '2026-11-02T10:00:00.000000+00:00';
const b = (o) => ({ unidad_id: SOT, updated_at: T, deleted_at: null, ...o });
const E1 = 'p-e1000', E3 = 'p-e3000', E5 = 'p-e5000';
export const data = {
  labores: [b({ id: 'l-cx400', codigo: 'CX-400', zona: 'Santa Rosa', tipo: 'crucero' })],
  secciones: [b({ id: 's-350', nombre: '3.50 x 3.50 negativo', ancho: 3.5, alto: 3.5, flecha: 0.5, sentido: 'negativo', area: 11.67 })],
  productos: [
    b({ id: E1, nombre: 'Emulnor 1000 1¼"x12"', categoria: 'emulsion', unidad_medida: 'cartucho', kg_unidad: 0.25, activo: true, densidad: 1.13, potencia_rel_anfo: 0.85, largo_mm: 304.8 }),
    b({ id: E3, nombre: 'Emulnor 3000 1¼"x12"', categoria: 'emulsion', unidad_medida: 'cartucho', kg_unidad: 0.26596, activo: true, densidad: 1.14, potencia_rel_anfo: 1.0, largo_mm: 304.8 }),
    b({ id: E5, nombre: 'Emulnor 5000 1¼"x12"', categoria: 'emulsion', unidad_medida: 'cartucho', kg_unidad: 0.26596, activo: true, densidad: 1.16, potencia_rel_anfo: 1.05, largo_mm: 304.8 }),
    b({ id: 'p-fanel', nombre: 'Fanel LP 4.8 m', categoria: 'iniciador', unidad_medida: 'unidad', kg_unidad: null, activo: true }),
  ],
  clases_roca: [['III A', 51, 60], ['III B', 41, 50], ['II', 61, 80]].map(([c, a, z]) => b({ id: 'c-' + c, sistema: 'RMR', clase: c, valor_min: a, valor_max: z })),
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
    .map(([n,f,g,t,pe,av,kg,c]) => b({ id: 'd' + n, labor_id: 'l-cx400', seccion_id: 's-350', estandar_id: null, numero_voladura: n, fecha: f, guardia: g, estado: 'cerrado', origen: 'importado',
      rmr: 58, clase_roca_id: 'c-III A', taladros_cargados: t, perforacion_efectiva: pe, avance: av, kg_declarado: kg, cartuchos_declarados: c, taladros_con_taco: 0,
      extra: {}, calidad: ['RMR igual en todos los registros de la fuente', 'Carga por zona no registrada'] })),
  carga_zona: [], movimientos_explosivo: [], checklist_respuestas: [],
};
export const escrituras = [];
export async function instalar(page) {
  await page.route('**/auth/v1/**', (r) => r.fulfill({ json: {
    access_token: 'x.eyJzdWIiOiJ1MSJ9.x', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
    user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'crisbrah@gmail.com', app_metadata: {}, user_metadata: {}, created_at: T } } }));
  await page.route('**/rest/v1/**', async (r) => {
    const u = new URL(r.request().url()), tabla = u.pathname.split('/').pop();
    if (r.request().method() === 'POST') { escrituras.push({ tabla, body: r.request().postDataJSON() }); return r.fulfill({ status: 201, json: [] }); }
    if (tabla === 'membresias') return r.fulfill({ json: [{ unidad_id: SOT, rol: 'admin', unidad: { id: SOT, nombre: 'U.M. SOTRAMI', es_demo: false, sistema_geomecanico: 'RMR', config: { meta_fc: 40, meta_eficiencia: 95, tolerancia_carga: 5 } } }] });
    const primera = (u.searchParams.get('updated_at') ?? '').includes('1970');
    return r.fulfill({ json: primera ? (data[tabla] ?? []) : [] });
  });
}
