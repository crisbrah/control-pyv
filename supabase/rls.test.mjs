// Pruebas del esquema en PostgreSQL embebido (PGlite), simulando el entorno de Supabase.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
const S = (f) => fs.readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
let ok = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); ok++; console.log('  ✔', name); } catch (e) { fail++; console.log('  ✘', name, '\n     ', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m ?? ''} esperado ${b}, obtenido ${a}`); };

// --- Stub mínimo de Supabase ---
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text unique);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
`);
await db.exec(S('01_schema.sql'));
await db.exec(`grant usage on schema public to authenticated;
  grant select, insert, update on all tables in schema public to authenticated;
  grant usage on all sequences in schema public to authenticated;`);
await db.exec(S('03_seed.sql'));
await db.exec(S('04_admin.sql'));

const SOT = '11111111-1111-1111-1111-111111111111', DEMO = '22222222-2222-2222-2222-222222222222';
const U = { sup: 'aaaaaaaa-0000-0000-0000-000000000001', ger: 'aaaaaaaa-0000-0000-0000-000000000002',
            demo: 'aaaaaaaa-0000-0000-0000-000000000003', car: 'aaaaaaaa-0000-0000-0000-000000000004',
            ing: 'aaaaaaaa-0000-0000-0000-000000000005' };
await db.exec(`insert into auth.users values
  ('${U.sup}','sup@x'),('${U.ger}','ger@x'),('${U.demo}','demo@x'),('${U.car}','car@x'),('${U.ing}','ing@x');
  insert into membresias values
  ('${U.sup}','${SOT}','supervisor',true),('${U.ger}','${SOT}','gerencia',true),
  ('${U.demo}','${DEMO}','admin',true),('${U.car}','${SOT}','cargador',true),('${U.ing}','${SOT}','ingeniero',true);`);

// Ejecuta como usuario autenticado dentro de una transacción
async function as(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid}', true);`);
    return (await tx.query(sql, params)).rows;
  });
}
const rejects = async (p) => { try { await p; } catch { return; } throw new Error('debía ser rechazado'); };

console.log('\nAislamiento entre minas');
await t('supervisor SOTRAMI ve sus 9 disparos', async () => eq((await as(U.sup, 'select count(*)::int n from disparos'))[0].n, 9));
await t('supervisor SOTRAMI NO ve los disparos DEMO', async () =>
  eq((await as(U.sup, `select count(*)::int n from disparos where unidad_id='${DEMO}'`))[0].n, 0));
await t('usuario DEMO NO ve nada de SOTRAMI (disparos, productos, unidad)', async () => {
  eq((await as(U.demo, 'select count(*)::int n from disparos'))[0].n, 1, 'disparos');
  eq((await as(U.demo, `select count(*)::int n from productos where unidad_id='${SOT}'`))[0].n, 0, 'productos');
  eq((await as(U.demo, `select count(*)::int n from unidades`))[0].n, 1, 'unidades');
});
await t('usuario DEMO no puede crear disparos en SOTRAMI', async () => rejects(as(U.demo,
  `insert into disparos (unidad_id,labor_id,seccion_id,numero_voladura,fecha) values
   ('${SOT}','11111111-0000-0000-0000-00000000a400','11111111-0000-0000-0000-00000000b350','X1','2026-11-01')`)));
await t('carga enviada con unidad_id falso queda en la unidad del disparo', async () => {
  const d = (await as(U.sup, `insert into disparos (unidad_id,labor_id,seccion_id,numero_voladura,fecha) values
     ('${SOT}','11111111-0000-0000-0000-00000000a400','11111111-0000-0000-0000-00000000b350','100','2026-11-01') returning id`))[0].id;
  const r = await as(U.sup, `insert into carga_zona (unidad_id,disparo_id,zona,producto_id,cantidad)
     values ('${DEMO}','${d}','arranque','11111111-0000-0000-0000-0000000e5000',176) returning unidad_id`);
  eq(r[0].unidad_id, SOT);
});

console.log('\nRoles y estados');
await t('gerencia es solo lectura', async () => rejects(as(U.ger,
  `insert into disparos (unidad_id,labor_id,seccion_id,numero_voladura,fecha) values
   ('${SOT}','11111111-0000-0000-0000-00000000a400','11111111-0000-0000-0000-00000000b350','X2','2026-11-01')`)));
await t('supervisor no puede editar un disparo cerrado', async () => {
  const r = await as(U.sup, `update disparos set avance = 9 where numero_voladura='17' and unidad_id='${SOT}' returning id`);
  eq(r.length, 0, 'filas actualizadas');
});
await t('ingeniero sí puede corregir un disparo cerrado (queda en auditoría)', async () => {
  const r = await as(U.ing, `update disparos set observaciones='corregido' where numero_voladura='17' and unidad_id='${SOT}' returning id`);
  eq(r.length, 1);
  const a = await db.query(`select count(*)::int n from auditoria where accion='UPDATE' and tabla='disparos'`);
  eq(a.rows[0].n, 1, 'auditoría');
});
await t('cargador no puede cerrar un disparo', async () => rejects(as(U.car,
  `update disparos set estado='cerrado', avance=3.5 where numero_voladura='100' and unidad_id='${SOT}'`)));
await t('no se puede cerrar sin avance medido', async () => rejects(as(U.sup,
  `update disparos set estado='cerrado' where numero_voladura='100' and unidad_id='${SOT}'`)));
await t('número de voladura duplicado rechazado', async () => rejects(as(U.sup,
  `insert into disparos (unidad_id,labor_id,seccion_id,numero_voladura,fecha) values
   ('${SOT}','11111111-0000-0000-0000-00000000a400','11111111-0000-0000-0000-00000000b350','17','2026-11-01')`)));
await t('reenvío offline idempotente (mismo uuid, upsert)', async () => {
  const id = 'bbbbbbbb-0000-0000-0000-000000000001';
  const sql = `insert into disparos (id,unidad_id,labor_id,seccion_id,numero_voladura,fecha) values
    ('${id}','${SOT}','11111111-0000-0000-0000-00000000a400','11111111-0000-0000-0000-00000000b350','101','2026-11-02')
    on conflict (id) do update set fecha = excluded.fecha`;
  await as(U.sup, sql); await as(U.sup, sql);
  eq((await as(U.sup, `select count(*)::int n from disparos where numero_voladura='101'`))[0].n, 1);
});

console.log('\nIndicadores (línea base CX-400)');
await t('FC medio 46.6 kg/m y eficiencia media 86.3 %', async () => {
  const r = (await as(U.ger, `select round(avg(fc_lineal),2)::float fc, round(avg(eficiencia),1)::float ef, count(*)::int n
     from v_disparo_kpi k join estudio_disparo e on e.disparo_id=k.id where e.condicion='linea_base'`))[0];
  eq(r.n, 9, 'n'); eq(r.fc, 46.65, 'FC'); eq(r.ef, 86.3, 'eficiencia');
});
await t('disparo 17: kg desde el desglose = 187.5', async () => {
  const r = (await as(U.ger, `select kg_total::float kg from v_disparo_kpi where numero_voladura='17' and unidad_id='${SOT}'`))[0];
  eq(Math.round(r.kg * 10) / 10, 187.5);
});
await t('conciliación: despacho − carga − devolución', async () => {
  const d = (await as(U.sup, `select id from disparos where numero_voladura='100'`))[0].id;
  await as(U.sup, `insert into movimientos_explosivo (disparo_id,tipo,producto_id,cantidad) values
    ('${d}','despacho','11111111-0000-0000-0000-0000000e5000',188),('${d}','devolucion','11111111-0000-0000-0000-0000000e5000',10)`);
  const r = (await as(U.sup, `select kg_sin_conciliar::float x from v_disparo_kpi where id='${d}'`))[0];
  eq(r.x, Math.round((188 - 10 - 176) * 0.26596 * 100) / 100);
});
await t('la vista KPI respeta RLS (DEMO no ve SOTRAMI)', async () =>
  eq((await as(U.demo, `select count(*)::int n from v_disparo_kpi where unidad_id='${SOT}'`))[0].n, 0));

console.log('\nUsuarios y catálogos (04_admin.sql)');
await db.exec(`insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000009','nuevo@x'), ('aaaaaaaa-0000-0000-0000-000000000006','adm@x');
  insert into membresias values ('aaaaaaaa-0000-0000-0000-000000000006','${SOT}','admin',true);`);
const ADM = 'aaaaaaaa-0000-0000-0000-000000000006';
await t('admin asigna rol por correo', async () => {
  await as(ADM, `select asignar_rol('NUEVO@x', '${SOT}', 'cargador', 'Pedro')`);
  eq((await as(ADM, `select count(*)::int n from miembros_unidad('${SOT}') where email='nuevo@x' and rol='cargador'`))[0].n, 1);
});
await t('supervisor no puede asignar roles', async () => rejects(as(U.sup, `select asignar_rol('nuevo@x', '${SOT}', 'admin')`)));
await t('usuario de otra mina no ve los miembros de SOTRAMI', async () => rejects(as(U.demo, `select * from miembros_unidad('${SOT}')`)));
await t('correo inexistente da un mensaje claro', async () => { try { await as(ADM, `select asignar_rol('nadie@x', '${SOT}', 'cargador')`); throw new Error('no falló'); } catch (e) { if (!/No existe un usuario/.test(e.message)) throw e; } });
await t('admin no puede quitarse su propio acceso', async () => rejects(as(ADM, `select quitar_acceso('${ADM}', '${SOT}')`)));
await t('quitar acceso desactiva al usuario', async () => {
  await as(ADM, `select quitar_acceso('aaaaaaaa-0000-0000-0000-000000000009', '${SOT}')`);
  eq((await as('aaaaaaaa-0000-0000-0000-000000000009', 'select count(*)::int n from disparos'))[0].n, 0);
});
await t('ingeniero crea una sección nueva', async () => eq((await as(U.ing, `insert into secciones (unidad_id,nombre,ancho,alto,flecha,sentido) values ('${SOT}','4.00 x 4.00 horizontal',4,4,0.5,'horizontal') returning area`))[0].area !== null, true));
await t('supervisor no puede crear secciones', async () => rejects(as(U.sup, `insert into secciones (unidad_id,nombre,ancho,alto,sentido) values ('${SOT}','x',3,3,'horizontal')`)));
await t('enviar la columna calculada area falla (la app debe omitirla)', async () => rejects(as(U.ing, `insert into secciones (unidad_id,nombre,ancho,alto,sentido,area) values ('${SOT}','y',3,3,'horizontal',9)`)));

console.log(`\n${ok} pruebas correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
