// Reportes PDF generados en el dispositivo (funcionan sin señal).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import type { Analisis } from './analisis';
import type { Kpi } from './calc';
import type { CargaZona, Disparo, Movimiento, Producto, Respuesta, Plantilla } from './types';
import { ZONA_NOMBRE } from './types';

// Las fuentes estándar de PDF no traen algunos símbolos: se reemplazan
const T = (s: unknown) => String(s ?? '—').replace(/•/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/−/g, '-').replace(/≈/g, '~').replace(/⅛/g, '1/8').replace(/…/g, '...').replace(/Δ/g, 'Var.').replace(/α/g, 'alfa').replace(/[–—]/g, '-').replace(/[^\x20-\xFF]/g, '');
const n = (v: number | null | undefined, d = 1) => (v == null || !isFinite(v) ? '—' : v.toFixed(d));
const AMBAR: [number, number, number] = [214, 137, 16], GRIS: [number, number, number] = [90, 98, 106];

function encabezado(doc: jsPDF, titulo: string, sub: string) {
  doc.setFillColor(12, 16, 19); doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(243, 168, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(T(titulo), 14, 11);
  doc.setTextColor(220, 226, 230); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(T(sub), 14, 18);
  doc.setTextColor(20, 20, 20);
}
function pie(doc: jsPDF, nota: string) {
  const p = doc.getNumberOfPages();
  for (let i = 1; i <= p; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
    doc.text(T(`${nota} · Generado ${new Date().toLocaleString('es-PE')} · Control P&V`), 14, 290);
    doc.text(`${i} / ${p}`, 196, 290, { align: 'right' });
  }
}
function titulo(doc: jsPDF, y: number, t: string) {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20); doc.text(T(t), 14, y);
  doc.setDrawColor(...AMBAR); doc.setLineWidth(0.6); doc.line(14, y + 1.5, 40, y + 1.5);
  doc.setFont('helvetica', 'normal'); return y + 5;
}
const ultimoY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
const tabla = (doc: jsPDF, y: number, head: string[], body: (string | number)[][], opt: Record<string, unknown> = {}) => {
  autoTable(doc, { startY: y, head: [head.map(T)], body: body.map((r) => r.map(T)), theme: 'grid', margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 1.6 }, headStyles: { fillColor: [28, 36, 43], textColor: 240 }, ...opt });
  return ultimoY(doc) + 7;
};

export async function guardarPdf(doc: jsPDF, nombre: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = doc.output('datauristring').split(',')[1];
    const f = await Filesystem.writeFile({ path: nombre, data, directory: Directory.Cache });
    await Share.share({ title: nombre, url: f.uri, dialogTitle: 'Compartir reporte' });
  } else doc.save(nombre);
}

export interface CtxDisparo {
  unidad: string; labor: string; seccion: string; estandar: string | null; d: Disparo; k: Kpi; tol: number; meta?: number;
  carga: CargaZona[]; movs: Movimiento[]; resp: Respuesta[]; plantilla?: Plantilla; prods: Map<string, Producto>;
  diseno: Partial<Record<string, { kg: number; lineas: { producto_id: string; cantidad: number }[] }>>; alertas: { nivel: string; texto: string }[];
}

export function reporteDisparo(c: CtxDisparo) {
  const { d, k } = c, doc = new jsPDF({ unit: 'mm', format: 'a4' });
  encabezado(doc, `Reporte de voladura N.° ${d.numero_voladura}`, `${c.unidad} · ${c.labor} · ${c.seccion} · ${d.fecha} · Guardia ${d.guardia ?? '—'} · Estado ${d.estado} · Origen ${d.origen}`);
  let y = 32;
  y = titulo(doc, y, 'Indicadores');
  y = tabla(doc, y, ['FC lineal', 'Eficiencia', 'Explosivo', 'Desv. vs estándar', 'FC volum.', 'Sobreexc.', 'Taco', 'Checklist'],
    [[`${n(k.fc)} kg/m`, `${n(k.eficiencia)} %`, `${n(k.kg)} kg`, k.desvTotal == null ? '—' : `${k.desvTotal > 0 ? '+' : ''}${n(k.desvTotal)} %`, `${n(k.fcVol, 2)} kg/m³`, `${n(k.sobreexc)} %`, `${n(k.pctTaco, 0)} %`, `${n(k.checklist, 0)} %`]],
    { styles: { fontSize: 9, halign: 'center', cellPadding: 2 } });
  if (c.meta) { doc.setFontSize(8.5); doc.setTextColor(...GRIS); doc.text(T(`Meta FC ≤ ${c.meta} kg/m · Tolerancia de carga ±${c.tol} % · Estándar: ${c.estandar ?? 'sin estándar'}`), 14, y - 3); y += 3; }

  y = titulo(doc, y, 'Macizo y perforación');
  y = tabla(doc, y, ['Concepto', 'Valor', 'Concepto', 'Valor'], [
    ['RMR / GSI / Q', `${d.rmr ?? '—'} / ${d.gsi ?? '—'} / ${d.q_barton ?? '—'}`, 'Agua', d.agua ?? '—'],
    ['Barra', d.barra_pies ? `${d.barra_pies} pies` : '—', 'Broca', d.broca_mm ? `${d.broca_mm} mm` : '—'],
    ['Taladros perforados / cargados', `${d.taladros_perforados ?? '—'} / ${d.taladros_cargados ?? '—'}`, 'Rimados', `${d.rimados_n ?? '—'} × ${d.rimados_mm ?? '—'} mm`],
    ['Perforación efectiva', d.perforacion_efectiva ? `${d.perforacion_efectiva} m` : '—', 'Guiadores / paralelismo', `${d.guiadores == null ? '—' : d.guiadores ? 'Sí' : 'No'} / ${d.paralelismo == null ? '—' : d.paralelismo ? 'Sí' : 'No'}`],
  ]);

  y = titulo(doc, y, 'Carga por zona frente al estándar');
  const zonas = Array.from(new Set([...Object.keys(c.diseno), ...c.carga.map((x) => x.zona)]));
  const kgDe = (ls: { producto_id: string; cantidad: number }[]) => ls.reduce((a, l) => a + Number(l.cantidad) * Number(c.prods.get(l.producto_id)?.kg_unidad ?? 0), 0);
  const cuerpo = zonas.map((z) => {
    const real = c.carga.filter((x) => x.zona === z), dis = c.diseno[z];
    const kr = kgDe(real), kd = dis?.kg ?? null, dv = kd ? ((kr - kd) / kd) * 100 : null;
    const det = real.map((x) => `${x.cantidad} ${c.prods.get(x.producto_id)?.nombre ?? ''}`).join(' + ') || '—';
    return [ZONA_NOMBRE[z as keyof typeof ZONA_NOMBRE] ?? z, det, n(kr, 2), kd == null ? '—' : n(kd, 2), dv == null ? '—' : `${dv > 0 ? '+' : ''}${n(dv)} %`];
  });
  y = tabla(doc, y, ['Zona', 'Cartuchos registrados', 'kg real', 'kg diseño', 'Desviación'], cuerpo.length ? cuerpo : [['—', 'Sin carga registrada', '—', '—', '—']],
    { didParseCell: (h: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor: number[] } } }) => {
      if (h.section === 'body' && h.column.index === 4) { const v = parseFloat(String(h.cell.raw)); if (isFinite(v) && Math.abs(v) > c.tol) h.cell.styles.textColor = [200, 50, 40]; } } });
  doc.setFontSize(8.5); doc.setTextColor(...GRIS); doc.text(T(`Taladros con taco de arcilla: ${d.taladros_con_taco ?? 0} de ${d.taladros_cargados ?? '—'} · Amarre según estándar: ${d.amarre_conforme == null ? '—' : d.amarre_conforme ? 'Sí' : 'No'}`), 14, y - 3); y += 3;

  y = titulo(doc, y, 'Conciliación del explosivo');
  y = tabla(doc, y, ['Despachado', 'Cargado', 'Devuelto', 'Sin conciliar', 'N.° de vale'],
    [[`${n(k.kgDespachado, 2)} kg`, `${n(k.kg, 2)} kg`, `${n(k.kgDevuelto, 2)} kg`, `${n(k.sinConciliar, 2)} kg`, String(d.extra?.numero_vale ?? '—')]]);

  y = titulo(doc, y, 'Resultado');
  y = tabla(doc, y, ['Avance', 'Ancho / alto real', 'Tiros fallados', 'Tacos remanentes', 'Arranque completo', 'Fragmentación'],
    [[d.avance ? `${d.avance} m` : '—', `${d.ancho_real ?? '—'} / ${d.alto_real ?? '—'} m`, d.tiros_fallados ?? '—', d.tacos_remanentes ?? '—', d.arranque_completo == null ? '—' : d.arranque_completo ? 'Sí' : 'No', d.fragmentacion ?? '—']]);

  if (c.plantilla) {
    y = titulo(doc, y, 'Checklist de control');
    y = tabla(doc, y, ['Código', 'Ítem', 'Resultado'], c.plantilla.items.map((it) => {
      const r = c.resp.find((x) => x.item_codigo === it.codigo);
      return [it.codigo, it.texto, r == null ? 'Sin registrar' : r.cumple == null ? 'N.A.' : r.cumple ? 'Cumple' : 'No cumple'];
    }));
  }
  y = titulo(doc, y, 'Alertas y observaciones');
  doc.setFontSize(9); doc.setTextColor(20, 20, 20);
  const lineas = [...(c.alertas.length ? c.alertas.map((a) => `• ${a.texto}`) : ['• Sin alertas.']),
    ...(d.calidad?.length ? [`• Calidad del dato: ${d.calidad.join('; ')}`] : []), ...(d.observaciones ? [`• Observaciones: ${d.observaciones}`] : [])];
  for (const l of lineas) { const w = doc.splitTextToSize(T(l), 182); if (y + w.length * 4.5 > 280) { doc.addPage(); y = 20; } doc.text(w, 14, y); y += w.length * 4.5 + 1; }
  if (d.origen !== 'medido') { doc.setTextColor(200, 50, 40); doc.text(T(`Dato de origen "${d.origen}": no corresponde a una medición directa de campo.`), 14, y + 3); }
  pie(doc, `Voladura ${d.numero_voladura} · ${c.unidad}`);
  return doc;
}

export interface CtxAnalisis { unidad: string; seccion: string; meta: number; tol: number; A: Analisis; labores: Map<string, string> }

export function reporteAnalisis({ unidad, seccion, meta, tol, A, labores }: CtxAnalisis) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const fechas = A.sel.map((x) => x.fecha).sort();
  encabezado(doc, `Análisis de ${A.sel.length} voladuras`, `${unidad} · ${seccion} · ${fechas[0]} a ${fechas[fechas.length - 1]} · Meta FC ≤ ${meta} kg/m · Tolerancia ±${tol} %`);
  let y = 32;
  y = titulo(doc, y, 'Conclusiones');
  doc.setFontSize(9);
  for (const c of A.conclusiones) {
    const w = doc.splitTextToSize(T(`• ${c.texto}`), 182);
    if (y + w.length * 4.5 > 280) { doc.addPage(); y = 20; }
    doc.setTextColor(...(c.tono === 'bien' ? [30, 130, 70] : c.tono === 'mal' ? [190, 50, 40] : [30, 30, 30]) as [number, number, number]);
    doc.text(w, 14, y); y += w.length * 4.5 + 1;
  }
  y += 3;
  y = titulo(doc, y, 'Resumen estadístico');
  const fila = (l: string, s: Analisis['s']['fc'], b: Analisis['b']['fc'] | undefined, u: string) =>
    [l, s ? n(s.media) : '—', s ? n(s.mediana) : '—', s ? n(s.de) : '—', s ? `${n(s.cv)} %` : '—', s ? `${n(s.min)}–${n(s.max)}` : '—', b ? n(b.media) : '—', u];
  y = tabla(doc, y, ['Indicador', 'Media', 'Mediana', 'DE', 'CV', 'Rango', 'Base', 'Unidad'], [
    fila('FC lineal', A.s.fc, A.b.fc, 'kg/m'), fila('Eficiencia', A.s.ef, A.b.ef, '%'), fila('Explosivo', A.s.kg, A.b.kg, 'kg'), fila('Avance', A.s.av, A.b.av, 'm'),
    fila('Desv. vs estándar', A.s.desv, undefined, '%'), fila('Taco de arcilla', A.s.taco, undefined, '%'), fila('Checklist', A.s.check, undefined, '%'),
  ]);
  y = titulo(doc, y, 'FC lineal por voladura');
  y = grafico(doc, y, A, meta) + 4;
  y = titulo(doc, y, 'Detalle por voladura');
  y = tabla(doc, y, ['N.°', 'Fecha', 'Labor', 'kg', 'Avance', 'FC', 'Efic.', 'Desv.', 'Taco', 'Sin concil.', 'Checklist'],
    A.sel.map((x) => [x.numero, x.fecha, labores.get(x.labor_id) ?? '—', n(x.kg), n(x.avance, 2), n(x.fc), n(x.eficiencia), x.desv == null ? '—' : `${n(x.desv)} %`, n(x.pctTaco, 0), n(x.sinConciliar, 2), n(x.checklist, 0)]),
    { styles: { fontSize: 7.8, cellPadding: 1.3 } });
  if (A.zonas.length) {
    y = titulo(doc, y, 'Cumplimiento de la receta por zona');
    y = tabla(doc, y, ['Zona', 'Desviación media', 'Voladuras'], A.zonas.map((z) => [ZONA_NOMBRE[z.zona as keyof typeof ZONA_NOMBRE] ?? z.zona, `${z.media > 0 ? '+' : ''}${n(z.media)} %`, z.n]));
  }
  y = titulo(doc, y, 'Método');
  doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
  const met = [
    `Línea base: voladuras reales cerradas de la misma sección sin estándar aplicado (${A.base.length}).`,
    A.control ? `Límites de control I-MR (Montgomery, 2013): media ± 2.66 · MR medio = ${n(A.control.lci)}–${n(A.control.lcs)} kg/m, calculados con ${A.base.length >= 3 ? 'la línea base' : 'la selección'}.` : '',
    'Comparación con la base: prueba U de Mann-Whitney bilateral (exacta para muestras pequeñas).',
    'Descomposición: para cambios pequeños, la variación % del FC ≈ variación % de la carga − variación % del avance.',
  ].filter(Boolean);
  for (const l of met) { const w = doc.splitTextToSize(T(`• ${l}`), 182); doc.text(w, 14, y); y += w.length * 4 + 1; }
  pie(doc, `Análisis · ${unidad}`);
  return doc;
}

function grafico(doc: jsPDF, y0: number, A: Analisis, meta: number) {
  if (y0 > 200) { doc.addPage(); y0 = 20; }
  const x0 = 24, w = 170, h = 55, pts = A.sel.filter((x) => x.fc != null);
  const vals = [...pts.map((p) => p.fc!), meta, ...(A.control ? [A.control.lcs, A.control.lci] : [])];
  const lo = Math.floor(Math.min(...vals) - 3), hi = Math.ceil(Math.max(...vals) + 3);
  const Y = (v: number) => y0 + h - ((v - lo) / (hi - lo)) * h, X = (i: number) => x0 + (pts.length === 1 ? w / 2 : (i / (pts.length - 1)) * w);
  doc.setDrawColor(200); doc.setLineWidth(0.2); doc.rect(x0, y0, w, h);
  doc.setFontSize(7); doc.setTextColor(...GRIS);
  for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) { doc.line(x0, Y(v), x0 + w, Y(v)); doc.text(String(v), x0 - 2, Y(v) + 1, { align: 'right' }); }
  const hline = (v: number, col: [number, number, number], lbl: string, dash = true) => {
    doc.setDrawColor(...col); doc.setLineWidth(0.5); if (dash) doc.setLineDashPattern([1.5, 1.2], 0); doc.line(x0, Y(v), x0 + w, Y(v)); doc.setLineDashPattern([], 0);
    doc.setTextColor(...col); doc.text(T(`${lbl} ${v.toFixed(1)}`), x0 + w + 1, Y(v) + 1);
  };
  hline(meta, [30, 130, 70], 'Meta');
  if (A.control) { hline(A.control.lcs, [190, 50, 40], 'LCS'); hline(A.control.lci, [190, 50, 40], 'LCI'); hline(A.control.media, [120, 120, 120], A.base.length >= 3 ? 'Base' : 'Media'); }
  doc.setDrawColor(...AMBAR); doc.setLineWidth(0.8);
  pts.forEach((p, i) => { if (i) doc.line(X(i - 1), Y(pts[i - 1].fc!), X(i), Y(p.fc!)); });
  pts.forEach((p, i) => {
    const fuera = A.fuera.includes(p.numero);
    doc.setFillColor(...(fuera ? [190, 50, 40] : AMBAR) as [number, number, number]); doc.circle(X(i), Y(p.fc!), 1.3, 'F');
    doc.setTextColor(40, 40, 40); doc.text(p.numero, X(i), y0 + h + 4, { align: 'center' });
  });
  doc.setTextColor(...GRIS); doc.text('kg/m', x0 - 2, y0 - 2, { align: 'right' }); doc.text('N.° de voladura', x0 + w / 2, y0 + h + 8, { align: 'center' });
  return y0 + h + 10;
}
