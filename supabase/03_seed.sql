-- =====================================================================
-- Archivo 3 de 3. Datos iniciales: SOTRAMI (real) + DEMO (separada).
-- Ejecutar como postgres (SQL Editor). Ids fijos para poder referenciarlos.
-- =====================================================================
insert into empresas (id, nombre) values
 ('00000000-0000-0000-0000-000000000001','SOTRAMI S.A.'),
 ('00000000-0000-0000-0000-000000000002','Empresa DEMO (datos simulados)');

insert into unidades (id, empresa_id, nombre, ubicacion, es_demo, sistema_geomecanico, config) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','U.M. SOTRAMI',
  'Sancos, Lucanas, Ayacucho', false, 'RMR',
  '{"meta_fc":40,"meta_eficiencia":95,"tolerancia_carga":5,"costo_kg":null}'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000002','Mina DEMO',
  'Ficticia', true, 'RMR', '{"meta_fc":40,"meta_eficiencia":95,"tolerancia_carga":5}');

-- ---------------- SOTRAMI ----------------
insert into contratistas (id, unidad_id, nombre) values
 ('11111111-0000-0000-0000-00000000c001','11111111-1111-1111-1111-111111111111','Sector IV S.A.');

insert into labores (id, unidad_id, codigo, zona, tipo, contratista_id) values
 ('11111111-0000-0000-0000-00000000a400','11111111-1111-1111-1111-111111111111','CX-400','Santa Rosa','crucero',
  '11111111-0000-0000-0000-00000000c001');

insert into secciones (id, unidad_id, nombre, ancho, alto, flecha, sentido) values
 ('11111111-0000-0000-0000-00000000b350','11111111-1111-1111-1111-111111111111','3.50 x 3.50 negativo',3.50,3.50,0.50,'negativo');

-- Rangos de clase: SUPUESTO (práctica peruana habitual). Confirmar con geomecánica de la unidad.
insert into clases_roca (unidad_id, clase, valor_min, valor_max, descripcion) values
 ('11111111-1111-1111-1111-111111111111','I',   81,100,'Muy buena'),
 ('11111111-1111-1111-1111-111111111111','II',  61, 80,'Buena'),
 ('11111111-1111-1111-1111-111111111111','III A',51, 60,'Regular A'),
 ('11111111-1111-1111-1111-111111111111','III B',41, 50,'Regular B'),
 ('11111111-1111-1111-1111-111111111111','IV A',31, 40,'Mala A'),
 ('11111111-1111-1111-1111-111111111111','IV B',21, 30,'Mala B'),
 ('11111111-1111-1111-1111-111111111111','V',    0, 20,'Muy mala');

insert into productos (id, unidad_id, nombre, fabricante, categoria, kg_unidad, unid_caja, densidad, potencia_rel_anfo, diametro_mm, largo_mm) values
 ('11111111-0000-0000-0000-0000000e1000','11111111-1111-1111-1111-111111111111','Emulnor 1000 1¼"x12"','FAMESA','emulsion',0.25000,100,1.13,0.85,31.75,304.8),
 ('11111111-0000-0000-0000-0000000e3000','11111111-1111-1111-1111-111111111111','Emulnor 3000 1¼"x12"','FAMESA','emulsion',0.26596, 94,1.14,1.00,31.75,304.8),
 ('11111111-0000-0000-0000-0000000e5000','11111111-1111-1111-1111-111111111111','Emulnor 5000 1¼"x12"','FAMESA','emulsion',0.26596, 94,1.16,1.05,31.75,304.8),
 (default,'11111111-1111-1111-1111-111111111111','Emulnor 1000 1⅛"x12"','FAMESA','emulsion',0.21552,116,1.13,0.85,28.6,304.8),
 (default,'11111111-1111-1111-1111-111111111111','Emulnor 3000 1"x12"', 'FAMESA','emulsion',0.17361,144,1.14,1.00,25.4,304.8),
 (default,'11111111-1111-1111-1111-111111111111','Emulnor 5000 1½"x12"','FAMESA','emulsion',0.40323, 62,1.16,1.05,38.1,304.8),
 (default,'11111111-1111-1111-1111-111111111111','Emulnor 5000 1"x12"', 'FAMESA','emulsion',0.17606,142,1.16,1.05,25.4,304.8);
insert into productos (unidad_id, nombre, fabricante, categoria, unidad_medida) values
 ('11111111-1111-1111-1111-111111111111','Fanel LP 4.8 m','FAMESA','iniciador','unidad'),
 ('11111111-1111-1111-1111-111111111111','Cordón detonante 5P','FAMESA','cordon','m'),
 ('11111111-1111-1111-1111-111111111111','Carmex','FAMESA','iniciador','unidad'),
 ('11111111-1111-1111-1111-111111111111','Mecha rápida','FAMESA','mecha','m');

insert into plantillas_checklist (unidad_id, nombre, items) values
 ('11111111-1111-1111-1111-111111111111','Control de ejecución CX-400 v1','[
  {"codigo":"A.I.1-3a","texto":"Malla marcada en el frente según el estándar"},
  {"codigo":"A.I.1-3b","texto":"Uso de guiadores y taladros paralelos"},
  {"codigo":"A.I.1-4a","texto":"Rimados completos con el diámetro de diseño"},
  {"codigo":"A.I.1-6","texto":"Retardos según el estándar"},
  {"codigo":"A.I.1-8a","texto":"Arranque: carga según receta"},
  {"codigo":"A.I.1-8b","texto":"Ayudas y arrastres: carga según receta"},
  {"codigo":"A.I.1-8c","texto":"Contorno: carga desacoplada con caña"},
  {"codigo":"A.I.1-7","texto":"Taco de arcilla en todos los taladros"},
  {"codigo":"A.I.1-4b","texto":"Arranque completo después del disparo"},
  {"codigo":"SEG-1","texto":"Verificación de tiros fallados"}]');

-- Estándar propuesto (no vigente hasta su aprobación). Parámetros marcados dato/supuesto.
insert into estandares (unidad_id, seccion_id, version, parametros, receta, kg_disparo, avance_esperado, vigente) values
 ('11111111-1111-1111-1111-111111111111','11111111-0000-0000-0000-00000000b350',1,
  '{"broca_mm":{"valor":45,"fuente":"supuesto"},"rimado_mm":{"valor":102,"fuente":"supuesto"},"rimados_n":{"valor":4,"fuente":"dato"},
    "H":{"valor":4.06,"fuente":"dato"},"alfa":{"valor":0.01,"fuente":"supuesto"},"emboquille":{"valor":0.02,"fuente":"supuesto"},
    "gamma_grados":{"valor":3,"fuente":"supuesto"},"c":{"valor":0.4,"fuente":"supuesto"},"K_contorno":{"valor":15,"fuente":"supuesto"}}',
  '{"arranque":{"taladros":16,"productos":[{"id":"11111111-0000-0000-0000-0000000e5000","cantidad":11,"atacado":false}]},
    "ayudas":{"taladros":7,"productos":[{"id":"11111111-0000-0000-0000-0000000e5000","cantidad":7,"atacado":true},{"id":"11111111-0000-0000-0000-0000000e1000","cantidad":7,"atacado":false}]},
    "hastiales":{"taladros":8,"productos":[{"id":"11111111-0000-0000-0000-0000000e5000","cantidad":1},{"id":"11111111-0000-0000-0000-0000000e1000","cantidad":2,"cana":true}]},
    "corona":{"taladros":7,"productos":[{"id":"11111111-0000-0000-0000-0000000e5000","cantidad":1},{"id":"11111111-0000-0000-0000-0000000e1000","cantidad":2,"cana":true}]},
    "arrastres":{"taladros":6,"productos":[{"id":"11111111-0000-0000-0000-0000000e5000","cantidad":7,"atacado":true},{"id":"11111111-0000-0000-0000-0000000e1000","cantidad":7,"atacado":false}]},
    "taco_m":0.45}', 105.3, 3.86, false);

-- Línea base: 9 disparos reales importados del Excel (setiembre 2026)
insert into disparos (unidad_id, labor_id, seccion_id, numero_voladura, fecha, guardia, estado, origen,
  rmr, clase_roca_id, barra_pies, taladros_cargados, rimados_n, perforacion_efectiva, guiadores, paralelismo,
  taladros_con_taco, avance, kg_declarado, cartuchos_declarados, extra, calidad)
select '11111111-1111-1111-1111-111111111111','11111111-0000-0000-0000-00000000a400','11111111-0000-0000-0000-00000000b350',
  v.n, v.f::date, v.g, 'cerrado', 'importado', 58,
  (select id from clases_roca where unidad_id='11111111-1111-1111-1111-111111111111' and clase='III A'),
  14, v.tal, v.rim, v.perf, v.gui, true, 0, v.av, v.kg, v.cart,
  jsonb_build_object('sobreexcavacion_pct', v.sob),
  '["RMR igual en todos los registros de la fuente","Carga por zona no registrada"]'::jsonb
from (values
 ('16','2026-09-09','Día',  46,4,4.10,false,3.60,175.00,808,30.6),
 ('17','2026-09-10','Día',  46,4,4.10,false,3.80,187.50,714,19.0),
 ('18','2026-09-12','Día',  46,4,4.10,true, 3.60,155.32,587,21.0),
 ('19','2026-09-13','Día',  45,4,4.10,true, 3.50,148.44,563,17.9),
 ('20','2026-09-14','Día',  42,5,4.10,true, 3.30,150.46,570,19.4),
 ('21','2026-09-19','Noche',46,4,4.00,true, 3.50,190.13,720,22.6),
 ('22','2026-09-20','Noche',42,4,4.00,true, 2.70,135.21,512,17.9),
 ('23','2026-09-21','Noche',46,4,4.00,true, 3.50,159.95,607,11.8),
 ('29','2026-09-25','Noche',47,5,4.00,true, 4.00,162.50,617,16.3)
) as v(n,f,g,tal,rim,perf,gui,av,kg,cart,sob);

-- Desglose disponible solo para el N.° 17
insert into carga_zona (disparo_id, zona, producto_id, cantidad)
select d.id, 'sin_zona', p.pid, p.c
from disparos d,
 (values ('11111111-0000-0000-0000-0000000e1000'::uuid,150),
         ('11111111-0000-0000-0000-0000000e3000'::uuid,141),
         ('11111111-0000-0000-0000-0000000e5000'::uuid,423)) p(pid,c)
where d.unidad_id='11111111-1111-1111-1111-111111111111' and d.numero_voladura='17';

insert into estudios (id, unidad_id, nombre, objetivo, indicador, meta, fecha_inicio) values
 ('11111111-0000-0000-0000-0000000057a1','11111111-1111-1111-1111-111111111111',
  'TAM Reducción FC lineal CX-400','Reducir el FC lineal con estándar Holmberg y control digital del carguío',
  'fc_lineal',40,'2026-09-09');
insert into estudio_disparo (estudio_id, disparo_id, condicion)
select '11111111-0000-0000-0000-0000000057a1', id, 'linea_base' from disparos
where unidad_id='11111111-1111-1111-1111-111111111111';

-- ---------------- DEMO (todo simulado) ----------------
insert into labores (id, unidad_id, codigo, tipo) values
 ('22222222-0000-0000-0000-00000000a001','22222222-2222-2222-2222-222222222222','GL-100 DEMO','galería');
insert into secciones (id, unidad_id, nombre, ancho, alto, flecha, sentido) values
 ('22222222-0000-0000-0000-00000000b001','22222222-2222-2222-2222-222222222222','4.00 x 4.00 horizontal',4,4,0.5,'horizontal');
insert into disparos (unidad_id, labor_id, seccion_id, numero_voladura, fecha, estado, origen, perforacion_efectiva, avance, kg_declarado)
values ('22222222-2222-2222-2222-222222222222','22222222-0000-0000-0000-00000000a001','22222222-0000-0000-0000-00000000b001',
        'D-001','2026-10-01','cerrado','simulado',4.0,3.8,150);

-- =====================================================================
-- USUARIOS: crea los usuarios primero en Authentication > Users y luego
-- descomenta y ajusta los correos. Roles: cargador, supervisor, ingeniero, gerencia, admin.
-- =====================================================================
-- insert into membresias (user_id, unidad_id, rol)
-- select id, '11111111-1111-1111-1111-111111111111', 'admin' from auth.users where email = 'crisbrah@gmail.com';
-- insert into membresias (user_id, unidad_id, rol)
-- select id, '22222222-2222-2222-2222-222222222222', 'admin' from auth.users where email = 'crisbrah@gmail.com';
-- insert into perfiles (user_id, nombre)
-- select id, 'Cristiam Perez' from auth.users where email = 'crisbrah@gmail.com';
