export type Rol = 'cargador' | 'supervisor' | 'ingeniero' | 'gerencia' | 'admin';
export type Estado = 'borrador' | 'perforado' | 'cargado' | 'disparado' | 'cerrado';
export type Origen = 'medido' | 'estimado' | 'importado' | 'simulado';
export type Zona = 'arranque' | 'ayudas' | 'hastiales' | 'corona' | 'arrastres' | 'sin_zona';
export const ZONAS: Exclude<Zona, 'sin_zona'>[] = ['arranque', 'ayudas', 'hastiales', 'corona', 'arrastres'];
export const ZONA_NOMBRE: Record<Zona, string> = {
  arranque: 'Arranque', ayudas: 'Ayudas', hastiales: 'Hastiales', corona: 'Corona', arrastres: 'Arrastres', sin_zona: 'Sin zona',
};

export interface Base { id: string; unidad_id: string; updated_at?: string; deleted_at?: string | null }

export interface Unidad {
  id: string; nombre: string; es_demo: boolean; sistema_geomecanico: 'RMR' | 'GSI' | 'Q' | string;
  config: { meta_fc?: number; meta_eficiencia?: number; tolerancia_carga?: number; costo_kg?: number | null };
}
export interface Membresia { unidad_id: string; rol: Rol; unidad: Unidad }

export interface Labor extends Base { codigo: string; zona?: string | null; tipo?: string | null }
export interface Seccion extends Base { nombre: string; ancho: number; alto: number; flecha: number | null; sentido: string; area?: number }
export interface Producto extends Base {
  nombre: string; categoria: string; unidad_medida: string; kg_unidad: number | null; activo: boolean;
}
export interface ClaseRoca extends Base { sistema: string; clase: string; valor_min: number; valor_max: number }
export interface Plantilla extends Base { nombre: string; items: { codigo: string; texto: string }[]; vigente: boolean }
export interface RecetaLinea { id: string; cantidad: number; atacado?: boolean; cana?: boolean }
export interface Receta { [zona: string]: { taladros: number; productos: RecetaLinea[] } | number | undefined; taco_m?: number }
export interface Estandar extends Base {
  seccion_id: string; version: number; metodo: string; receta: Receta; kg_disparo: number | null;
  avance_esperado: number | null; vigente: boolean;
}

export interface Disparo extends Base {
  labor_id: string; seccion_id: string; estandar_id?: string | null;
  numero_voladura: string; fecha: string; guardia?: string | null; estado: Estado; origen: Origen;
  rmr?: number | null; gsi?: number | null; q_barton?: number | null; clase_roca_id?: string | null;
  agua?: string | null; litologia?: string | null;
  barra_pies?: number | null; broca_mm?: number | null; taladros_perforados?: number | null; taladros_cargados?: number | null;
  rimados_n?: number | null; rimados_mm?: number | null; perforacion_efectiva?: number | null;
  guiadores?: boolean | null; paralelismo?: boolean | null;
  taladros_con_taco?: number | null; amarre_conforme?: boolean | null;
  avance?: number | null; ancho_real?: number | null; alto_real?: number | null;
  tiros_fallados?: number | null; tacos_remanentes?: number | null; arranque_completo?: boolean | null;
  fragmentacion?: string | null; kg_declarado?: number | null; cartuchos_declarados?: number | null;
  observaciones?: string | null; extra?: Record<string, unknown>; calidad?: string[];
}
export interface CargaZona extends Base { disparo_id: string; zona: Zona; producto_id: string; cantidad: number; atacado?: boolean | null }
export interface Movimiento extends Base { disparo_id: string; tipo: 'despacho' | 'devolucion'; producto_id: string; cantidad: number }
export interface Respuesta extends Base { disparo_id: string; item_codigo: string; cumple: boolean | null; observacion?: string | null }

export const TABLAS_CATALOGO = ['labores', 'secciones', 'productos', 'clases_roca', 'plantillas_checklist', 'estandares'] as const;
export const TABLAS_DATOS = ['disparos', 'carga_zona', 'movimientos_explosivo', 'checklist_respuestas'] as const;
export type Tabla = typeof TABLAS_CATALOGO[number] | typeof TABLAS_DATOS[number];

export const puedeCrear = (r: Rol) => r === 'supervisor' || r === 'ingeniero' || r === 'admin';
export const puedeEditar = (r: Rol, e: Estado) =>
  r === 'ingeniero' || r === 'admin' || ((r === 'supervisor' || r === 'cargador') && e !== 'cerrado');
export const puedeCerrar = (r: Rol) => r === 'supervisor' || r === 'ingeniero' || r === 'admin';
