-- =====================================================================
-- Control P&V · Esquema multi-mina (Supabase / PostgreSQL 15+)
-- Archivo 1 de 3. Ejecutar en el SQL Editor de Supabase, en orden:
--   01_schema.sql → 02_storage.sql → 03_seed.sql
-- Reglas de diseño:
--   * Toda tabla de datos lleva unidad_id (aislamiento por mina con RLS).
--   * id uuid que puede generar el celular (sincronización offline idempotente).
--   * updated_at / deleted_at en todo (borrado lógico; compatible con PowerSync).
--   * El disparo es un hecho; los estudios lo "miran" mediante estudio_disparo.
--   * Cada dato declara su origen: medido / estimado / importado / simulado.
-- =====================================================================

-- ---------- Tipos ----------
create type rol_usuario   as enum ('cargador','supervisor','ingeniero','gerencia','admin');
create type estado_disparo as enum ('borrador','perforado','cargado','disparado','cerrado');
create type origen_dato    as enum ('medido','estimado','importado','simulado');
create type zona_malla     as enum ('arranque','ayudas','hastiales','corona','arrastres','sin_zona');
create type sentido_labor  as enum ('horizontal','negativo','positivo');
create type cat_producto   as enum ('emulsion','dinamita','anfo','agente_bombeable','iniciador','cordon','mecha','otro_accesorio');
create type mov_explosivo  as enum ('despacho','devolucion');
create type condicion_est  as enum ('linea_base','validacion','variante_a','variante_b','referencia','excluido');

-- ---------- Columnas comunes ----------
create or replace function public.tg_audit_cols() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end $$;

-- ---------- Organización ----------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ruc text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table unidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nombre text not null,
  ubicacion text,
  es_demo boolean not null default false,          -- datos simulados SOLO aquí
  sistema_geomecanico text not null default 'RMR', -- RMR | GSI | Q
  config jsonb not null default '{}'::jsonb,       -- metas, tolerancias, campos extra
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
comment on column unidades.config is
 'Ej.: {"meta_fc":40,"meta_eficiencia":95,"tolerancia_carga":5,"costo_kg":null,"campos_extra":[{"clave":"sostenimiento","tipo":"texto"}]}';

create table perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table membresias (
  user_id uuid not null references auth.users(id) on delete cascade,
  unidad_id uuid not null references unidades(id),
  rol rol_usuario not null,
  activo boolean not null default true,
  created_at timestamptz default now(),
  primary key (user_id, unidad_id)
);

-- ---------- Helpers de permisos (SECURITY DEFINER para no recursar RLS) ----------
create or replace function public.es_miembro(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from membresias m where m.unidad_id = u and m.user_id = auth.uid() and m.activo)
$$;

create or replace function public.tiene_rol(u uuid, roles rol_usuario[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from membresias m
                where m.unidad_id = u and m.user_id = auth.uid() and m.activo and m.rol = any(roles))
$$;

-- ---------- Catálogos por mina ----------
create table contratistas (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  nombre text not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table personal (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  nombre text not null,
  funcion text not null,                 -- operador_jumbo | cargador | supervisor | ...
  contratista_id uuid references contratistas(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table equipos (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  codigo text not null, tipo text not null, modelo text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table labores (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  codigo text not null,                  -- CX-400
  zona text, nivel text, tipo text,      -- crucero, galería, rampa...
  contratista_id uuid references contratistas(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (unidad_id, codigo)
);

create table secciones (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  nombre text not null,                  -- 3.50 x 3.50 negativo
  ancho numeric(5,2) not null check (ancho > 0),
  alto  numeric(5,2) not null check (alto > 0),
  flecha numeric(4,2) default 0,
  sentido sentido_labor not null,
  area numeric(6,2) generated always as (ancho * (alto - coalesce(flecha,0)) + 2.0/3.0 * ancho * coalesce(flecha,0)) stored,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

-- Clases de roca PROPIAS de cada mina: "III A" de una mina no es el de otra.
create table clases_roca (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  sistema text not null default 'RMR',
  clase text not null,                   -- III A
  valor_min numeric not null, valor_max numeric not null,
  descripcion text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  nombre text not null,                  -- Emulnor 5000 1¼"x12"
  fabricante text,
  categoria cat_producto not null,
  unidad_medida text not null default 'cartucho',
  kg_unidad numeric(8,5),                -- null en accesorios
  unid_caja int,
  densidad numeric(5,3),
  potencia_rel_anfo numeric(4,2),        -- potencia relativa en peso (ANFO = 1)
  diametro_mm numeric(5,1), largo_mm numeric(6,1),
  activo boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table plantillas_checklist (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  nombre text not null,
  items jsonb not null,                  -- [{"codigo":"A.I.1-7","texto":"Taco de arcilla en todos"}]
  vigente boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

-- Estándar (diseño de malla y carga) versionado por sección
create table estandares (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  seccion_id uuid not null references secciones(id),
  version int not null,
  metodo text not null default 'Holmberg',
  parametros jsonb not null,             -- cada parámetro con {"valor":..,"fuente":"dato|supuesto"}
  receta jsonb not null,                 -- por zona: taladros, productos, cantidades, taco
  kg_disparo numeric(8,2),
  avance_esperado numeric(5,2),
  vigente boolean not null default false,
  aprobado_por uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (seccion_id, version)
);

-- ---------- Disparo: ciclo completo ----------
create table disparos (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  labor_id uuid not null references labores(id),
  seccion_id uuid not null references secciones(id),
  estandar_id uuid references estandares(id),
  numero_voladura text not null,
  fecha date not null,
  guardia text,                          -- día / noche / A / B
  estado estado_disparo not null default 'borrador',
  origen origen_dato not null default 'medido',
  -- personas
  supervisor_id uuid references personal(id),
  cargador_id uuid references personal(id),
  operador_id uuid references personal(id),
  equipo_id uuid references equipos(id),
  -- geomecánica (por disparo, no por labor)
  rmr numeric(4,1), gsi numeric(4,1), q_barton numeric(8,3),
  clase_roca_id uuid references clases_roca(id),
  agua text check (agua in ('seco','humedo','goteo','flujo')),
  litologia text, estructuras text,
  -- perforación
  barra_pies numeric(4,1),
  broca_mm numeric(5,1),
  taladros_perforados int, taladros_cargados int,
  rimados_n int, rimados_mm numeric(5,1),
  perforacion_efectiva numeric(5,2),
  guiadores boolean, paralelismo boolean,
  -- voladura
  hora_disparo timestamptz,
  taladros_con_taco int,
  amarre_conforme boolean,
  -- resultado
  avance numeric(5,2),
  ancho_real numeric(5,2), alto_real numeric(5,2),
  tiros_fallados int, tacos_remanentes int,
  arranque_completo boolean,
  fragmentacion text check (fragmentacion in ('fina','adecuada','gruesa','bancos')),
  -- datos importados sin desglose de carga
  kg_declarado numeric(8,2),
  cartuchos_declarados int,
  observaciones text,
  extra jsonb not null default '{}'::jsonb,   -- campos configurables de la mina
  calidad jsonb not null default '[]'::jsonb, -- advertencias de importación
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (unidad_id, numero_voladura),
  constraint avance_ok check (avance is null or avance between 0 and 10),
  constraint cierre_requiere_avance check (estado <> 'cerrado' or avance is not null)
);
create index on disparos (unidad_id, fecha);
create index on disparos (labor_id);

-- tablas hijas: unidad_id se copia del disparo por trigger (no se confía en el cliente)
create table carga_zona (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  disparo_id uuid not null references disparos(id) on delete cascade,
  zona zona_malla not null,
  producto_id uuid not null references productos(id),
  cantidad numeric(8,2) not null check (cantidad >= 0),
  atacado boolean,
  n_taladros int,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index on carga_zona (disparo_id);

create table movimientos_explosivo (           -- vale de despacho y devolución
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  disparo_id uuid not null references disparos(id) on delete cascade,
  tipo mov_explosivo not null,
  producto_id uuid not null references productos(id),
  cantidad numeric(8,2) not null check (cantidad >= 0),
  numero_vale text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index on movimientos_explosivo (disparo_id);

create table checklist_respuestas (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  disparo_id uuid not null references disparos(id) on delete cascade,
  item_codigo text not null,
  cumple boolean,                        -- null = no aplica
  observacion text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (disparo_id, item_codigo)
);

create table fotos (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  disparo_id uuid not null references disparos(id) on delete cascade,
  tipo text not null check (tipo in ('perforado','cargado','disparado','otro')),
  storage_path text not null,            -- {unidad_id}/{disparo_id}/{id}.jpg
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

-- ---------- Estudios: separan proyectos y condiciones sin duplicar disparos ----------
create table estudios (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  nombre text not null,                  -- TAM Reducción FC CX-400
  objetivo text,
  indicador text not null default 'fc_lineal',
  meta numeric,
  fecha_inicio date, fecha_fin date,
  estado text not null default 'abierto' check (estado in ('abierto','cerrado')),
  linea_base_congelada jsonb,            -- snapshot de KPIs al iniciar
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table estudio_disparo (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  estudio_id uuid not null references estudios(id) on delete cascade,
  disparo_id uuid not null references disparos(id) on delete cascade,
  condicion condicion_est not null,
  motivo_exclusion text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (estudio_id, disparo_id)
);

-- Eventos que explican cambios en los resultados (broca nueva, otro cargador, lote...)
create table eventos_cambio (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid not null references unidades(id),
  labor_id uuid references labores(id),
  fecha date not null,
  tipo text not null,
  descripcion text not null,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

-- ---------- Auditoría ----------
create table auditoria (
  id bigint generated always as identity primary key,
  unidad_id uuid,
  tabla text not null, registro_id uuid, accion text not null,
  antes jsonb, despues jsonb,
  usuario uuid default auth.uid(), fecha timestamptz default now()
);

create or replace function public.tg_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria(unidad_id, tabla, registro_id, accion, antes, despues)
  values (coalesce(new.unidad_id, old.unidad_id), tg_table_name, coalesce(new.id, old.id), tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- Copia unidad_id desde el disparo padre (evita escribir en otra mina)
create or replace function public.tg_unidad_desde_disparo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select d.unidad_id into new.unidad_id from disparos d where d.id = new.disparo_id;
  if new.unidad_id is null then raise exception 'Disparo % no existe', new.disparo_id; end if;
  return new;
end $$;

create or replace function public.tg_unidad_desde_estudio() returns trigger
language plpgsql security definer set search_path = public as $$
declare u_d uuid;
begin
  select e.unidad_id into new.unidad_id from estudios e where e.id = new.estudio_id;
  select d.unidad_id into u_d from disparos d where d.id = new.disparo_id;
  if new.unidad_id is distinct from u_d then
    raise exception 'El disparo y el estudio pertenecen a unidades distintas';
  end if;
  return new;
end $$;

-- Disparo editable: cargador/supervisor mientras no esté cerrado; ingeniero/admin siempre
create or replace function public.disparo_editable(did uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from disparos d where d.id = did and (
      tiene_rol(d.unidad_id, array['ingeniero','admin']::rol_usuario[])
   or (tiene_rol(d.unidad_id, array['cargador','supervisor']::rol_usuario[]) and d.estado <> 'cerrado')))
$$;

-- Triggers
do $$
declare t text;
begin
  foreach t in array array['empresas','unidades','contratistas','personal','equipos','labores','secciones',
    'clases_roca','productos','plantillas_checklist','estandares','disparos','carga_zona',
    'movimientos_explosivo','checklist_respuestas','fotos','estudios','estudio_disparo','eventos_cambio']
  loop
    execute format('create trigger audit_cols before insert or update on %I for each row execute function tg_audit_cols()', t);
  end loop;
  foreach t in array array['disparos','carga_zona','movimientos_explosivo','estandares','estudio_disparo']
  loop
    execute format('create trigger auditoria after insert or update or delete on %I for each row execute function tg_auditoria()', t);
  end loop;
  foreach t in array array['carga_zona','movimientos_explosivo','checklist_respuestas','fotos']
  loop
    execute format('create trigger unidad_padre before insert or update on %I for each row execute function tg_unidad_desde_disparo()', t);
  end loop;
end $$;
create trigger unidad_padre before insert or update on estudio_disparo
  for each row execute function tg_unidad_desde_estudio();

-- ---------- Vista de indicadores ----------
create or replace view v_disparo_kpi with (security_invoker = true) as
with carga as (
  select c.disparo_id,
         sum(c.cantidad * p.kg_unidad) filter (where p.kg_unidad is not null) as kg_cargado,
         sum(c.cantidad) filter (where p.kg_unidad is not null) as cartuchos
  from carga_zona c join productos p on p.id = c.producto_id
  where c.deleted_at is null group by c.disparo_id
), mov as (
  select m.disparo_id,
         sum(m.cantidad * p.kg_unidad) filter (where m.tipo='despacho')   as kg_despachado,
         sum(m.cantidad * p.kg_unidad) filter (where m.tipo='devolucion') as kg_devuelto
  from movimientos_explosivo m join productos p on p.id = m.producto_id
  where m.deleted_at is null and p.kg_unidad is not null group by m.disparo_id
)
select d.id, d.unidad_id, d.labor_id, d.seccion_id, d.estandar_id, d.numero_voladura, d.fecha, d.guardia,
       d.estado, d.origen, d.rmr, d.agua, s.sentido, s.area as area_diseno,
       coalesce(c.kg_cargado, d.kg_declarado)                                   as kg_total,
       coalesce(c.cartuchos, d.cartuchos_declarados)                            as cartuchos,
       d.perforacion_efectiva, d.avance,
       round(coalesce(c.kg_cargado, d.kg_declarado) / nullif(d.avance,0), 2)    as fc_lineal,
       round(d.avance / nullif(d.perforacion_efectiva,0) * 100, 1)              as eficiencia,
       round(coalesce(c.kg_cargado, d.kg_declarado)
             / nullif(coalesce(d.ancho_real*d.alto_real, s.area) * d.avance, 0), 2) as fc_vol,
       round((d.ancho_real*d.alto_real - s.area) / nullif(s.area,0) * 100, 1)   as sobreexcavacion,
       round(d.taladros_con_taco::numeric / nullif(d.taladros_cargados,0) * 100, 1) as pct_taco,
       round((coalesce(c.kg_cargado,0) - e.kg_disparo) / nullif(e.kg_disparo,0) * 100, 1) as desviacion_carga,
       m.kg_despachado, m.kg_devuelto,
       round(m.kg_despachado - coalesce(m.kg_devuelto,0) - coalesce(c.kg_cargado,0), 2) as kg_sin_conciliar
from disparos d
join secciones s on s.id = d.seccion_id
left join carga c on c.disparo_id = d.id
left join mov m on m.disparo_id = d.id
left join estandares e on e.id = d.estandar_id
where d.deleted_at is null;

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  -- tablas con unidad_id: lectura para cualquier miembro de la unidad
  foreach t in array array['unidades','contratistas','personal','equipos','labores','secciones','clases_roca',
    'productos','plantillas_checklist','estandares','disparos','carga_zona','movimientos_explosivo',
    'checklist_respuestas','fotos','estudios','estudio_disparo','eventos_cambio','auditoria']
  loop
    execute format('alter table %I enable row level security', t);
    if t = 'unidades' then
      execute 'create policy lectura on unidades for select to authenticated using (es_miembro(id))';
    else
      execute format('create policy lectura on %I for select to authenticated using (es_miembro(unidad_id))', t);
    end if;
  end loop;

  -- catálogos y diseño: escriben ingeniero y admin
  foreach t in array array['contratistas','personal','equipos','labores','secciones','clases_roca','productos',
    'plantillas_checklist','estandares','estudios','estudio_disparo','eventos_cambio']
  loop
    execute format($p$create policy escritura on %I for insert to authenticated
      with check (tiene_rol(unidad_id, array['ingeniero','admin']::rol_usuario[]))$p$, t);
    execute format($p$create policy edicion on %I for update to authenticated
      using (tiene_rol(unidad_id, array['ingeniero','admin']::rol_usuario[]))
      with check (tiene_rol(unidad_id, array['ingeniero','admin']::rol_usuario[]))$p$, t);
  end loop;

  -- hijas del disparo: escriben quienes pueden editar el disparo
  foreach t in array array['carga_zona','movimientos_explosivo','checklist_respuestas','fotos']
  loop
    execute format('create policy escritura on %I for insert to authenticated with check (disparo_editable(disparo_id))', t);
    execute format('create policy edicion on %I for update to authenticated using (disparo_editable(disparo_id)) with check (disparo_editable(disparo_id))', t);
  end loop;
end $$;

-- disparos
create policy escritura on disparos for insert to authenticated
  with check (tiene_rol(unidad_id, array['supervisor','ingeniero','admin']::rol_usuario[]));
create policy edicion on disparos for update to authenticated
  using (tiene_rol(unidad_id, array['ingeniero','admin']::rol_usuario[])
         or (tiene_rol(unidad_id, array['cargador','supervisor']::rol_usuario[]) and estado <> 'cerrado'))
  with check (tiene_rol(unidad_id, array['supervisor','ingeniero','admin']::rol_usuario[])
         or (tiene_rol(unidad_id, array['cargador']::rol_usuario[]) and estado <> 'cerrado'));

-- unidades: solo admin edita la configuración
create policy edicion on unidades for update to authenticated
  using (tiene_rol(id, array['admin']::rol_usuario[])) with check (tiene_rol(id, array['admin']::rol_usuario[]));

-- empresas: visibles si el usuario pertenece a alguna de sus unidades
alter table empresas enable row level security;
create policy lectura on empresas for select to authenticated
  using (exists(select 1 from unidades u where u.empresa_id = empresas.id and es_miembro(u.id)));

-- perfiles: cada uno el suyo; se ven los de compañeros de unidad
alter table perfiles enable row level security;
create policy propio on perfiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy companeros on perfiles for select to authenticated using (exists(
  select 1 from membresias a join membresias b on a.unidad_id = b.unidad_id
  where a.user_id = auth.uid() and b.user_id = perfiles.user_id));

-- membresias: cada uno ve las suyas; el admin de la unidad las gestiona
alter table membresias enable row level security;
create policy propias on membresias for select to authenticated
  using (user_id = auth.uid() or tiene_rol(unidad_id, array['admin']::rol_usuario[]));
create policy gestion on membresias for all to authenticated
  using (tiene_rol(unidad_id, array['admin']::rol_usuario[]))
  with check (tiene_rol(unidad_id, array['admin']::rol_usuario[]));

-- Sin DELETE para nadie desde la app: se usa deleted_at (borrado lógico).

-- ---------- Permisos de la API (explícitos; Supabase suele darlos por defecto) ----------
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
